---
title: "Counting tokens in Foundation Models"
description: "Understanding Apple’s Foundation Models Context Window: A Comparison with OpenAI’s Tokenization."
pubDate: 2025-08-26
draft: false
heroImage: "/assets/2025-08-26/image.jpg"
---

# Apple’s Foundation Models: context limits, missing tokenizers, and a practical way to measure usage

Apple’s Foundation Models cap the context window at 4,096 tokens (per Apple’s developer guidance). There’s no public tokenizer API or usage metadata; tokenization happens internally and crossing the limit throws an error.

External providers take the opposite approach. OpenAI publishes tokenizers, returns usage in API responses. That exists partly because usage is billable, but even if Apple does not bill per token, the 4096 hard stop still damages UX when you misestimate.

Below is the measurement setup I used to make sense of this in production code without relying on Apple-internal tokenization.

---

## Estimating context in FoundationModels

I attach a session listener and sum visible text segments across instructions, prompts, and responses. That yields a simple character baseline. It ignores structured output / tool calls (and obviously will result in undercounting).

```swift
public var estimatedTextCharacters: Int {
    var total = 0
    for entry in self {
        switch entry {
        case .instructions(let instructions):
            total += Self.characters(in: instructions.segments)
        case .prompt(let prompt):
            total += Self.characters(in: prompt.segments)
        case .response(let response):
            total += Self.characters(in: response.segments)
        case .toolCalls, .toolOutput:
            break
        }
    }
    return total
}
```

Apple’s rule of thumb: 3–4 characters per token. My English‑only runs averaged ~4.2; to keep the text I concatenate the visible segments like so:

```swift
public var estimatedTotalText: String {
    reduce(into: "", { result, entry in
        switch entry {
        case .instructions(let instructions):
            result.append(Self.text(in: instructions.segments))
        case .prompt(let prompt):
            result.append(Self.text(in: prompt.segments))
        case .response(let response):
                result.append(Self.text(in: response.segments))
        case .toolCalls, .toolOutput:
            break
        @unknown default:
            break
        }
    })
}
```

---

## Cross-checking with OpenAI tokenizers, including GPT-OSS

Heuristics are not enough for careful benchmarks, so I also tokenize the same transcript with OpenAI’s encoders via [TiktokenSwift](https://github.com/narner/TiktokenSwift) (Swift bindings to OpenAI’s `tiktoken`). This gives precise counts for `cl100k_base` (GPT-3.5/4), `o200k_base` (GPT-4o family), and `o200k_harmony` used by GPT-OSS.

```swift
public enum TokenCountModel {
    case gpt4        // cl100k_base
    case gpt4o       // o200k_base
    case o3          // o200k_base
    case gptOSS      // o200k_harmony
}

public func estimatedTokenCount(per model: TokenCountModel) async -> Int {
    do {
        let cache = TokenEncoderCache.shared
        let bpe = switch model {
        case .gpt4:   try await cache.cl100kBase()
        case .gpt4o:  try await cache.o200kBase()
        case .o3:     try await cache.o200kBase()
        case .gptOSS: try await cache.o200kHarmony()
        }
        return bpe.encodeText(estimatedTotalText).count
    } catch {
        return 0
    }
}
```

OpenAI open‑sourced `o200k_harmony` with GPT‑OSS, so you can validate locally (see the GPT‑OSS announcement and Modal’s deep dive if you want background theory).

---

## What triggered this write‑up

Across English prose, OpenAI encoders counted ~25% fewer tokens than the Apple‑side heuristic implied; the same text fits further in the window when measured precisely. It’s an observation from my runs, not a constant. Content type matters: English prose compresses well; other languages, emoji, and code do not.

---

## Stream-time guardrail in the app

I surface a running estimate and a short status line during generation. Goal: trim or restart before the hard stop.

```swift
let result = await TokenUsageEstimator.buildSummary(
    for: session.transcript,
    maxContextTokens: maxContextTokens
)
await MainActor.run {
    self.stableEstimatedTokens = result.stableEstimatedTokens
    self.tokenEstimatesSummary = result.summary
}
```

We approximate proactively instead of reacting after a failure (no public tokenizer or usage counts). OpenAI, by contrast, returns usage inline and ships tokenizers you can run locally.

In a follow‑up I’ll cover strategies to stretch effective context—sliding windows, opportunistic summarization near a threshold, hierarchical condensation of older turns, selective retention of tool outputs—so you degrade gracefully instead of slamming into 4,096. Stay tuned.

---

## Practical implications

* Treat 4096 as a strict budget; add preflight checks and stream telemetry. The failure mode is abrupt.
* Benchmark with real tokenizers. `tiktoken` (via TiktokenSwift) lets you profile `cl100k_base`, `o200k_base`, `o200k_harmony` locally, but will perform way better than what you will likely see with Apple Foundation Model.

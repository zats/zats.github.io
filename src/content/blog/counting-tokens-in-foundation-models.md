---
title: "Counting tokens in Foundation Models"
description: "Understanding Apple’s Foundation Models Context Window: A Comparison with OpenAI’s Tokenization."
pubDate: 2025-08-26
draft: true
---

# Apple’s Foundation Models: context limits, missing tokenizers, and a practical way to measure usage

Apple’s Foundation Models cap the context window at **4,096 tokens**. Apple’s docs also say a token is roughly **3–4 characters** for Latin scripts. Apple does not expose a tokenizer API, and there is no response metadata with token usage. The framework handles tokenization under the hood, and if you cross the budget you receive an error. ([Apple Developer](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models?utm_source=chatgpt.com "Generating content and performing tasks with Foundation ..."))

External providers take the opposite approach. OpenAI publishes tokenizers, returns usage in API responses, and even ships multiple encodings you can select for analysis and benchmarking. That exists in part because usage is billable, but even if Apple does not bill per token, the **4096** hard stop still damages UX when you misestimate. ([OpenAI Cookbook](https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken?utm_source=chatgpt.com "How to count tokens with Tiktoken"), [OpenAI Platform](https://platform.openai.com/docs/api-reference?utm_source=chatgpt.com "API Reference - OpenAI API"))

Below is the measurement setup I used to make sense of this in production code without relying on Apple-internal tokenization.

---

## Estimating context in FoundationModels

I attach a listener to the `LanguageModelSession` stream and aggregate only visible text across instructions, prompts, and responses. That gives me a consistent character baseline.

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

Apple’s rule of thumb is 3–4 characters per token. In my English-only tests, the empirical average was closer to **4.2** characters per token, so I use a simple heuristic estimator:

```swift
public func estimatedTokenCount(charsPerToken: Double = 4.2) -> Int {
    guard charsPerToken > 0 else { return 0 }
    let chars = Double(estimatedTextCharacters)
    return Int(ceil(chars / charsPerToken))
}
```

This catches most cases before you hit the framework’s `exceededContextWindowSize` error. ([Apple Developer](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models?utm_source=chatgpt.com "Generating content and performing tasks with Foundation ..."))

To keep the text I am actually counting aligned with what the user sees, I also concatenate the visible segments:

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

Heuristics are not enough for careful benchmarks, so I also tokenize the same transcript with OpenAI’s encoders via **TiktokenSwift** (Swift bindings to OpenAI’s `tiktoken`). This gives precise counts for `cl100k_base` (GPT-3.5/4), `o200k_base` (GPT-4o family), and **`o200k_harmony` used by GPT-OSS**. ([GitHub](https://github.com/narner/TiktokenSwift?utm_source=chatgpt.com "narner/TiktokenSwift: Swift bindings for OpenAI's tiktoken ..."), [OpenAI](https://openai.com/index/introducing-gpt-oss/?utm_source=chatgpt.com "Introducing gpt-oss"))

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

OpenAI documented and open-sourced the `o200k_harmony` tokenizer with the GPT-OSS release, which is why you can validate against it locally. ([OpenAI](https://openai.com/index/introducing-gpt-oss/?utm_source=chatgpt.com "Introducing gpt-oss"), [Modal](https://modal.com/blog/what-is-o200k-harmony?utm_source=chatgpt.com "What is o200k Harmony? OpenAI's latest edition to their ..."))

---

## Result that motivated this post

Across English prose, OpenAI encoders consistently counted about **25% fewer tokens** than the Apple-side heuristic would imply, which means the same text fits noticeably further within the window when measured by OpenAI’s tokenizers. Treat this as a practical observation from my runs, not a universal constant. Content type matters: prose is efficient, emoji and code are not.

---

## Stream-time guardrail in the app

I surface a running estimate and a short status line during generation, so I can trim or restart before the hard stop:

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

This pattern exists because Apple does not let you replace or query the tokenizer, and there is no usage field in responses to rely on. By contrast, OpenAI returns usage in API responses and ships official tokenizers you can run offline for exact counts. ([Apple Developer](https://developer.apple.com/forums/forums/topics/machine-learning-and-ai?utm_source=chatgpt.com "Machine Learning & AI - Apple Developer Forums"), [OpenAI Cookbook](https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken?utm_source=chatgpt.com "How to count tokens with Tiktoken"))

---

## Practical implications

* Treat **4096** as a strict budget and build preflight checks plus stream-time telemetry. Apple’s guidance is approximate, the failure mode is abrupt. ([Apple Developer](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models?utm_source=chatgpt.com "Generating content and performing tasks with Foundation ..."))
* Validate with real tokenizers when you benchmark or compare models. The **`tiktoken`** family, including the **GPT-OSS** `o200k_harmony` encoding, is available through **TiktokenSwift** for Swift projects. ([GitHub](https://github.com/narner/TiktokenSwift?utm_source=chatgpt.com "narner/TiktokenSwift: Swift bindings for OpenAI's tiktoken ..."), [OpenAI](https://openai.com/index/introducing-gpt-oss/?utm_source=chatgpt.com "Introducing gpt-oss"))

If you want, I can add a compact table that contrasts counts for prose, emoji-heavy text, and code across `cl100k_base`, `o200k_base`, and `o200k_harmony`, using your transcript collector and the exact snippets above.

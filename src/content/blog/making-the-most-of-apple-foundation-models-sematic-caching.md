---
title: "Making the Most of Apple Foundation Models: Semantic Caching"
description: "Reuse answers for meaning‑equivalent requests by matching embeddings instead of raw strings, cutting cost and latency safely."
pubDate: 2025-09-16
draft: true
heroImage: "/assets/2025-09-16/caching.jpg"
---

Inference time is scarce. When a request is expensive, doing the same work again wastes latency and compute. Semantic caching lets us reuse a previous answer when a new request means the same thing as one we already processed. The payoff: lower cost and faster responses without sacrificing correctness or privacy (as long as we scope entries properly).

<img src="/assets/2025-09-16/example.gif" width="70%"/>

## The core idea

Receive a user message, make a fast guess about whether the full answer will be “expensive,” attempt to find a prior answer that means the same thing (semantic, not literal), and if there is a strong match return it immediately; otherwise generate normally, measure cost, and if it was expensive and allowed, store the new pair for next time. Signals that often correlate with “expensive” include elapsed milliseconds, input and output token counts, inferrence time, external tool or API calls, and downstream spend. Start with a single simple threshold, then refine using real telemetry - not intuition.


```swift
func handle(_ text: String, ctx: Context) async -> String {
    if let hit = cache.lookup(text, minCosine: 0.92, context: ctx) {
        metrics.recordCacheHit(score: hit.score)
        return hit.entry.response
    }
    // A few metrics to make caching decision
    let startMs = Date.now
    let answer = try await llm.reply(to: text)
    let inputTk = estimateTokens(text)
    let outputTk = estimateTokens(answer)
    let deltaMs = ms(since: startMs)

    if CostMeter.isExpensive(wallMs: deltaMs, inTokens: inputTk, outTokens: outputTk),
       CachePolicy.canStore(text, answer, context: ctx) 
    {
        // Cache if expensive
        cache.store(prompt: text, response: answer, ttl: CachePolicy.ttl(for: text), context: ctx)
    }
    return answer
}
```

## Matching by meaning, not by string

Literal string matching rarely helps, even small wording shifts cause a cache miss. Instead, we embed the new request, search a small in‑memory vector index of past prompts for the same user and execution context, and if we find a close enough match we reuse its answer; otherwise we generate a fresh one.

```swift
final class SemanticCache {
    private var entries = [Entry]()
    private let embedding = NLEmbedding.sentenceEmbedding(for: .english)!

    func lookup(_ text: String, minCosine: Double, context: Context) -> (entry: Entry, score: Double)? {
        guard let qv = vector(for: text) else { return nil }
        var best: (Entry, Double)?
        for e in entries where e.contextKey == context.key && isFresh(e, .now) {
            let s = dot(qv, e.vector)
            if s >= minCosine && (best == nil || s > best!.1) { best = (e, s) }
        }
        return best
    }

    func store(prompt: String, response: String, ttl: TimeInterval?, context: Context) {
        guard let v = vector(for: prompt) else { return }
        entries.append(.init(prompt: prompt, response: response, vector: v,
                             contextKey: context.key, createdAt: .now, ttl: ttl))
    }

    private func vector(for text: String) -> [Double]? {
        guard let raw = embedding.vector(for: text.trimmingCharacters(in: .whitespacesAndNewlines)) else { return nil }
        let n = sqrt(raw.reduce(0) { $0 + $1 * $1 })
        return n > 0 ? raw.map { $0 / n } : raw
    }

    private func isFresh(_ entry: Entry, _ now: Date) -> Bool {
        guard let ttl = entry.ttl else { return true }
        return entry.createdAt.addingTimeInterval(ttl) > now
    }
}
```

Reusing answers benefits from a few guardrails: let time‑sensitive prompts expire quickly or just skip caching them, keep outputs scoped to the same user, avoid cross‑user mixing. Prompts that lean on earlier turns usually still need regeneration unless you intentionally encode that prior state in the cache key.

```swift
enum CachePolicy {
    static func canStore(_ prompt: String, _ response: String, context: Context) -> Bool {
        !(context.userID.isEmpty
         || containsSensitive(response)
         || isConversationDependent(prompt))
    }

    static func ttl(for prompt: String) -> TimeInterval? {
        if looksTimeSensitive(prompt) { 
            300 
        } else {
            3600
        }
    }
}
```

## A minimal flow

You only need one hook in the chat loop: look up before generating, optionally store after. Stream generation as normal; the cache path is just the short‑circuit.

```swift
final class ChatViewModel {
    func send(_ query: String) {
        let ctx = Context(/* model/system/tools/user */)

        // 1. Fast path: semantic reuse
        if let hit = semanticCache.lookup(query, minCosine: 0.92, context: ctx) {
            display(hit.entry.response)
            return
        }

    // 2. Slow path: generation
    let t0 = Date.now
    let answer = session.respond(to: query)
    display(answer)

        // 3. Conditional store only if it was "expensive" and policy allows
        if CostMeter.isExpensive(wallMs: msSince(t0),
                                 inTokens: estimateTokens(query),
                                 outTokens: estimateTokens(answer)),
           CachePolicy.canStore(query, answer, context: ctx)
        {
            semanticCache.store(prompt: query, response: answer, ttl: CachePolicy.ttl(for: query), context: ctx)
        }
    }
}
```

## Implementation notes that pay off

Decide at write time whether an entry is worth keeping: drop cheap, low‑value, or risky outputs so the cache stays clean. Use a context key (pick heuristics that makes sense for you) so that answers never bleed across incompatible setups. Store the raw response now; if you later need structured output you can layer it on without changing lookup logic.

```swift
func contextHash(model: String, systemPrompt: String, tools: [String], userID: String) -> String {
    return [
        model,
        systemPrompt.sha1(),
        tools.joined(separator: "+"),
        userID
    ].joined(separator: "|")
}
```

Semantic caching isn’t magic: let dynamic questions expire, use a conservative similarity threshold, isolate by user + model + system prompt, and skip answers that depend on prior turns unless you encode that state into the key. Resist the lure of a shared global cache early - it’s mostly risk. Be picky about what you store so memory tracks real wins. Start narrow, instrument hit rate vs. size, then widen only where data justifies it.

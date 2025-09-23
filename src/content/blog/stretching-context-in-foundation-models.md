---
title: "Stretching Context in Apple’s Foundation Models"
description: "Strategies to estimate usage and gracefully manage Apple’s 4,096-token limit."
pubDate: 2025-09-15
draft: true
---

# Stretching Context in Apple’s Foundation Models

When I published Counting Tokens in Foundation Models, I showed a practical way to approximate usage inside Apple’s 4,096-token hard limit. That post ended with a promise: a follow-up on how to stretch effective context so your app degrades gracefully instead of slamming into the ceiling. This is that follow-up.

## Why Token Estimation Matters

Apple’s Foundation Models don’t expose a tokenizer or usage telemetry. You only find out you’ve crossed the boundary when generation fails. That’s not acceptable for production apps.

The fix is to build a guardrail: track characters across prompts, instructions, and responses, then convert to an estimated token count. In my runs, ~4.2 characters per token was a reliable baseline for English prose. Cross-checking with OpenAI’s tiktoken confirmed the trend: Apple heuristics overstate usage, but the failure mode is still abrupt.

Here’s the pattern I use:

```swift
let result = await TokenUsageEstimator.buildSummary(
    for: session.transcript,
    maxContextTokens: 4096
)
self.stableEstimatedTokens = result.stableEstimatedTokens
self.tokenEstimatesSummary = result.summary
```

That single number — `stableEstimatedTokens` — becomes the trigger for every context management decision downstream.

## Strategy 1: Sliding Windows

The simplest way to avoid blowing the budget is to keep only the last few turns. Drop the oldest once you cross a threshold (say, 3000 tokens).

```swift
if estimator.stableEstimatedTokens > 3000 {
    transcript = transcript.keepRecentTurns(count: 6)
}
```

This works well for short, focused exchanges. But if your app supports longer conversations, you’ll need more than blunt trimming.

## Strategy 2: Opportunistic Summarization

Instead of throwing away history, compress it. When the budget tightens, collapse older turns into compact summaries: “User asked about X, model replied Y.” This preserves semantic continuity while making room for new input.

```swift
if estimator.stableEstimatedTokens > 3200 {
    transcript = transcript.summarizeOlderEntries()
}
```

The key is to do this proactively, before you hit the wall. Summarization itself consumes tokens, so keep the summaries short and role-aware.

## Strategy 3: Hierarchical Condensation

Flat summaries only take you so far. A better pattern is layered condensation:

- First pass: shorten individual messages. For example:
  - Original: “Sure, I can walk you through the setup of the provisioning API step by step with full code examples and background theory.”
  - Condensed: “Explained provisioning API setup with examples.”
- Second pass: roll multiple compressed messages into topic summaries. For example:
  - Original thread of 10 turns about debugging SQLite.
  - Topic summary: “Resolved SQLite concurrency issues, recommended using read-only connections and GRDB notifications.”

This gives you a semantic spine of the conversation that survives multiple rounds of compression, while still retaining the key technical outcomes.

## Strategy 4: Selective Retention

Not all context is equally important. Tool outputs and logs can eat your budget quickly. The trick is to retain essential state while discarding noise.

- **Keep:** parameters, IDs, results that the model must reuse. For example: “Calendar event created: ID 87213, date 2025-09-15.”
- **Drop:** verbose logs like JSON payloads, intermediate HTTP traces, or multi-line stack traces, unless they’re required for reasoning.

Code-wise, this can look like:

```swift
transcript = transcript.retainImportantTools { toolCall in
    return toolCall.isCritical || toolCall.containsIdentifiers
}
```

By treating structured data as state rather than dialogue, you prevent irrelevant clutter from consuming tokens.

## A Graceful Degradation Policy

Put these strategies together into a pipeline:

1. Monitor tokens continuously.
2. Trim the earliest turns above 75% of budget.
3. Summarize mid-aged turns above 85%.
4. Apply hierarchical condensation if history is long and repetitive.
5. Strip tool chatter above 90%.
6. Fail-safe: block input or force summarization if >95%.

The goal isn’t to never hit 4096 — it’s to never hit it suddenly.

## Closing Thoughts

In this post we covered the why and how of token estimation, and walked through strategies to stretch context without tripping over Apple’s hard 4096 limit. Estimation provides the guardrail; context management provides the steering wheel. Together they turn an abrupt ceiling into a manageable budget.

Next time I’ll focus on Strategy 2 — opportunistic summarization — as a happy medium between complexity and efficiency, and show how to implement it cleanly in production.


---
title: "Making the most of Apple Foundation Models: Majority voting"
description: "Making non-reasoning model smarter using a lightweight majority‑voting loop for higher answer quality."
pubDate: 2025-09-12
draft: true
heroImage: "/assets/2025-09-12/majority-voting.jpg"
---

Majority voting is a simple ensemble-style technique to improve answer quality. You generate multiple answers to the same user question, then use a separate language model session to judge which answer best fits the question. You return the winning answer.

LLM outputs are probabilistic. Ask the same question multiple times and you will get variations that differ in completeness, nuance, and correctness. Showing raw variations to a person invites subjective preference and inconsistency. Majority voting formalizes selection: the model that judges is prompted to evaluate answers against the original question and pick the best one.

![](/assets/2025-09-12/example.gif)

## The basic loop

We start with the user’s question. Instead of betting on a single pass, you sample the answering model K times to get a small set of independent takes—slight variations in phrasing, completeness, and focus. Then you spin up a clean judging session. Hand it the original question plus those candidates and ask it, briefly, to pick the one that best answers the question and to justify the choice in a sentence or two. The judge returns a winner; that’s what you surface back to the user.

Keep the judging session independent from the answering session. Treat it as a clean evaluator with its own prompt and constraints.

```swift
// Build a small transcript window with the last 3 visible messages excluding the typing placeholder
let (window, usedCount) = buildTranscriptWindow(lastN: 3, latestQuestion: latestQuestion)

// Three parallel candidate answers using separate sessions
let candidateInstructions = "You are one of three independent experts answering the same user question. Provide the single best answer you can. Be precise, grounded, and concise. Do not mention other candidates. Output only the final answer text."

async let a = generateCandidate(instructions: candidateInstructions, input: window)
async let b = generateCandidate(instructions: candidateInstructions, input: window)
async let c = generateCandidate(instructions: candidateInstructions, input: window)
// Allow sessions to run independantly, collect all results when finish
let answers = try await [a, b, c]

// Finally have a separate judge LLM session
let judge = buildJudgeSession(instructions: "You are an impartial judge. Given a short conversation snippet (for context), the user's question, and candidate answers A, B, and C, pick exactly one best answer based on correctness, completeness, clarity, and usefulness. Consider factual accuracy first. Return a JSON with fields: winner (0 for A, 1 for B, 2 for C) and reason. Do not rewrite or improve answers.")

// Assemble all options and the context into single prompt
var lines: [String] = []
lines.append(window)
lines.append("---")
lines.append("Candidate A:\n\(answers[0])")
lines.append("Candidate B:\n\(answers[1])")
lines.append("Candidate C:\n\(answers[2])")
let judgePrompt = lines.joined(separator: "\n\n")

let selection = try await judge.respond(to: judgePrompt, generating: MajorityVoteSelection.self).content
let idx = max(0, min(2, selection.winner))
return (answers[idx], selection, answers, usedCount)
```

Finally the structure representing judge decision is quite simple:

```swift
@Generable
struct MajorityVoteSelection {
    @Guide(description: "Index of the best answer among candidates A,B,C where A=0, B=1, C=2.")
    var winner: Int

    @Guide(description: "One‑sentence justification for the choice.")
    var reason: String
}
```

Now we can return it back to the consumer to render either single wining option or to show the result and reasoning behind it.

## Working within small context windows

On constrained on‑device foundation models, watch the context budget. Keep questions and candidate answers concise, steering the answering model to stay direct and scoped to the exact ask. Keep the judging prompt compact: request a single choice plus a one‑ or two‑sentence justification and nothing more. When K grows or answers get long, judge in batches, then run a final among batch winners. For questions that are complex or long‑lived, tag them and allow a slightly larger K or a two‑pass plan. In lab and conference settings, a light cross‑examination variant works well: first every candidate answers, then each gets a brief self‑critique or opponent critique before judging. That contrast yields extra signal without blowing up the window.

## Why it can beat a single pass

Ensembling reduces variance. Even if every single pass has a chance to miss a key detail, the probability that at least one of K captures it is higher. A competent judge then selects that candidate. Self-consistency and majority voting results in the literature show sizable gains over single-sample baselines.

Use majority voting for user questions that benefit from completeness or precision but do not require external tools. It pairs well with local LLMs when you want higher reliability without invoking networked services. For tool-using pipelines, you can still apply majority voting to the reasoning or final answer stage, but control total tokens to avoid crowding out tool outputs.

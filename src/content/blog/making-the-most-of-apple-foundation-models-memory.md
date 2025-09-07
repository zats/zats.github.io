---
title: "Making the Most of Apple Foundation Models: Memory"
description: "Teach Apple Foundation Models to retain user-specific facts on‑device with a lightweight write/read memory pattern."
pubDate: 2025-09-14
draft: true
heroImage: "/assets/2025-09-14/memories.jpg"
---

Large language models do not remember prior conversations by themselves. Every new request is stateless, so we keep context alive by resending chat history. On-device this is expensive. It also hits the context window ceiling quickly. If the user force-quits or reboots an app, we still want important facts to persist. That is the job of memories.

## What is memory?

![](/assets/2025-09-14/example.gif)

A memory is a compact fact that the model decides is likely to matter later. Instead of stuffing full transcripts back into the prompt, we keep a small scratchpad of durable facts. When the user asks about something that was said before, we look it up and answer from that scratchpad. The idea itself is not a research breakthrough and is relatively simple: it shifts long‑term context from prompts to a persistent store. A lot of innovation is happening in the actual storage approaches.

## The basic interface

We expose two tools to the model: `write_memory` and `read_memory`.
* `write_memory` records a fact when the model believes it is important for the future.
* `read_memory` retrieves relevant facts when the user’s question appears to reference prior information.

We describe when each tool should be used so the model does not write on every message. Overwriting the prompt budget with noise is easy and harmful. We guide the model to write only when a fact is about the user, their preferences, identities, recurring commitments, or long‑term projects. The model should also avoid duplicates and should upgrade or merge facts when confidence is high.

Initial implementations are quite naive: write simply appends to a plain text document saved on disk; read returns the entire memory. This of course won't scale—especially with context‑window‑constrained models such as `LanguageModelSession`.

```swift
let prompt = """
You are a helpful general assistant with access to two tools: write_memory and read_memory. Use these only for the user's personal facts/preferences.

Policy:
- Default: answer questions normally without using tools.
- Save: if the user explicitly asks you to remember/memorize/save something for later, call write_memory with the exact fact text (no paraphrase).
- Recall: if the user asks what they told you before, about their profile/preferences/plans, or your answer requires a previously saved fact, call read_memory (pass a short hint in `query` if useful). Use the returned text to answer.
- Style for recall: answer directly, as if you remembered it. Do NOT say things like “according to your memories”, “I found in memory”, or mention tool names.
- If the memory isn’t present, say you don’t have that yet and ask whether to save it if appropriate.
- Never invent or assume memories. Only store user-related facts (not general knowledge). Keep answers concise and avoid dumping the whole memory file.
"""
let tools: [any Tool] = [WriteMemoryTool(), ReadMemoryTool()]
session = LanguageModelSession(model: .default, tools: tools, instructions: prompt)
// then use regular session.respond(to: userPrompt)
```

the tools are, as mentioned before, quite naive:

```swift
struct WriteMemoryTool: Tool {
    let name: String = "write_memory"
    let description: String = "Append a memory line to the user's persistent memory file. Use ONLY when the user explicitly asks to remember / memorize / save something. Argument: { text: String } The assistant should acknowledge briefly after saving (e.g., “Got it, I’ll remember that.”)."

    var includesSchemaInInstructions: Bool { true }

    @Generable
    struct Arguments { @Guide(description: "The text to memorize.") var text: String }

    @Generable
    struct Result { @Guide(description: "Echo of the stored text") var stored: String }

    func call(arguments: Arguments) async throws -> Result {
        await MemoryService.shared.append(arguments.text)
        return Result(stored: arguments.text)
    }
}

struct ReadMemoryTool: Tool {
    let name: String = "read_memory"
    let description: String = "Read the full memory file. Use when the user asks to recall/list/check memories, or when a saved fact is required to answer. Argument: { query: String } — optional hint words to help you focus. Important: Use the result silently. Answer the user’s question directly without saying “according to your memories” or mentioning tools. Avoid dumping unrelated memory content."
    
    var includesSchemaInInstructions: Bool { true }

    @Generable
    struct Arguments { @Guide(description: "Optional hint for what to look for.") var query: String }

    @Generable
    struct Result { @Guide(description: "Full memory text contents.") var text: String }

    func call(arguments: Arguments) async throws -> Result {
        let text = await MemoryService.shared.text
        return Result(text: text)
    }
}
```

## Where to go from here

That's it, the core idea is very simple. But of course there is a lot to optimize here:

* First and foremost we should enable single‑memory retrieval to avoid polluting the context with the entire memory content.

Real memory is quite messy: facts get stale or are reversed. If you want to make memories more robust you need to think through the following (and yes, there are plenty of startups working on this):

* Degrading confidence over time
* Overwriting with newer statements
* Conflict resolution when two memories disagree
* Optional expiration for short lived facts

A simple example covering these: a user saying yesterday that they like bananas and today that they prefer strawberries should result in one active preference.

Of course the quality of the memory depends on the storage choices. A flat text file is enough for a minimal build, but it only supports crude string matching. For anything nontrivial we add a vector index so we can retrieve semantically related memories, not just exact matches. That keeps lookups robust to phrasing differences and lets us rank by relevance rather than position in a file.

The core idea stays the same: keep important facts out of the prompt and in a persistent, searchable store, and teach the model when to write and when to read.

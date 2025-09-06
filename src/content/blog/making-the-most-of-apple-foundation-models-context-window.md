---
title: "Making the most of Apple Foundation Models: Context Window"
description: "How to manage Apple’s 4096-token limit with sliding windows, summarization, and selective retention."
pubDate: 2025-09-03
draft: false
heroImage: "/assets/2025-09-03/image.jpg"
---

## Managing context window

People who work with large language models know that one important way in which they differ is the size of the context window. Google has been consistently impressing the developer community by releasing LLMs with increasingly large context windows, [1 million tokens and beyond](https://blog.google/technology/ai/google-gemini-next-generation-model-february-2024/). What this means in reality is that you can ingest more information and interact with LLMs about ever larger corpora of information. Great examples of use cases include ingesting your entire codebase and asking questions about it or putting a lot of documents relevant to your business into the window and asking the model to cross-reference them.

When Apple released their Foundation Models, they came with a relatively small [4096‑token context window](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models#Consider-context-size-limits-per-session) which, to be frank, is not big enough for many serious tasks. This is a trade-off of running the model on device and, hopefully, will improve in the future.

In this article, I take a look at different strategies developers can use to overcome this limitation. The way Apple deals with an over-long prompt is to throw an error, there is no selectable overflow strategy, which is frustrating (it simply returns an error rather than trimming). So what are the different strategies LLMs out there employ?

## Sliding context window

The easiest way to conceptualize it is that you have a window the size of your token limit and it keeps sliding with each new message, which means that in practice your LLM effectively forgets the earliest parts of the conversation. This might be fine depending on your use case, but it will not work if a user refers to some part of the conversation that is now outside the window. 

### How to

* Ring buffer implementation to keep relevant part of the conversation.
* UI affordances to show truncation points (if you prefer).

## Opportunistic summarization

This strategy means that once you get to a threshold, for example 75% of your context window, you kick off a summarization. You have probably seen this in tools like Cursor or GitHub Copilot where, once the context limit is reached, a second LLM is run with a different task on the content. The task is to create a distilled version of the conversation. Once done, you reset your main LLM and inject a message similar to "this conversation is too long, here is a brief summary of what happened before: …" This is a bit of sleight-of-hand, but it allows you to continue the conversation indefinitely. Because the summary is supposed to mention the important parts of the previous conversation, the user can refer to points from before the cutoff for as long as they want. The downside is the lost granularity, so if specific details did not make it into the summary, the LLM will not be able to recall them.

### How to

* Trigger policy at 70-80% with token budget guardrails.
* Prompt template for dense, faithful summaries, include constraints and citations.
* Reset main LLM context to the original prompt + summary message.

## Hierarchical condensation

This is a more nuanced approach to opportunistic summarization. In a similar way, it creates a terse table of contents for previous information, but in addition it creates a more detailed representation for each topic. Once these are ready, you inject only the terse index with instructions that, if a user refers to something that is not currently in the conversation, the model should check for a matching record in the table of contents. If there is one, you instruct the LLM to use a tool to retrieve the detailed record for that topic.

### How to
* Pick a schema for TOC entries and per-topic detail blobs.
* Design tool-calling contract to fetch a topic’s details on demand.
* Archotect propmt to formulate retrieval policy and guardrails for when to expand.

## Selective retention

Not all information in a chat is equally important. As the LLM receives information from the user and generates responses, it can decide whether a specific piece is important for the longer conversation or if it is chatter the user is unlikely to reference later. In examples where your LLM makes many tool calls, it is possible that only the conclusion from the tool call is important, and retaining full tool call I/O wastes context. Here you examine each message and make a judgment about whether to retain it or discard it. This approach is not bulletproof, and eventually you still run out of space and need one of the other approaches.

### How to

* Pick heuristics to mark messages keep, compress, or drop.
* Build a reducer that preserves decisions and outcomes, drops intermediate messages.

## Deep dive, opportunistic summarization with Apple Foundation Models

We start by building on a [previous post](/blog/counting-tokens-in-foundation-models/) where I use a token estimation technique (heuristic length estimation — Apple does not expose a tokenizer publicly). Sadly, it is not as precise as I would like, and this is still a big gap for robust solutions. Apple does not publish a tokenizer or usage metadata, so any estimator is heuristic. You should be aware that the context can run out quicker if you use characters that tokenize into many pieces, for example emojis, or if you generate code or text in non-Latin languages. There is no public “Apple embeddings dictionary,” so treat this as an empirical note rather than a guarantee (see lack of published tokenizer details in the same [documentation](https://developer.apple.com/documentation/foundationmodels)).

Once we reach an arbitrary threshold of 70 percent, we take the transcript of the conversation and reduce it into text. A critical detail about the threshold is that if you do it too late, the second LLM you set up to summarize will fail with the same out-of-context error. Be conservative if you expect long-running conversations. Here is one way to implement it, specifics will depend on your product use cases:

```swift
extension Transcript {
    var estimatedText: String {
        reduce(into: "") { result, entry in
            switch entry {
            case .instructions(let instructions):
                // ignore system prompt, if you think you need it, you can add it here
                break
            case .prompt(let prompt):
                result.append("User:" + Self.text(from: prompt.segments))
            case .response(let response):
                result.append("AI: " + Self.text(from: response.segments))
            case .toolCalls, .toolOutput:
                // similarly for the example we ignore tool calls
                break
            }
        }
    }
}
```

Once the textual representation of the conversation is ready, it is up to you to choose whether it should include non-visual aspects like tool calls, structured responses, and system messages. For many apps, capturing the tools’ final results and the decisions made is enough.

We create a new session and instruct it to summarize the conversation. The specifics of the prompt are left as an exercise because summarization style is unique to your tasks. For example, GitHub Copilot ensures it includes recent files touched and changes made while keeping the overall conversation high level (see the [github implementation](https://github.com/microsoft/vscode-copilot-chat/blob/8ac54c7b101531a6302afe56f3b1906f8eb7e72d/src/extension/prompts/node/agent/summarizedConversationHistory.tsx#L158-L173) for how it surfaces recent context). If you have heuristics for what is important in your conversation, inject them here.

### How to
* Create a fresh LanguageModelSession configured for summarization
* Prompt template with objectives, length budget, and must-include fields
* Optional structured output, for example JSON with sections and bullets

```swift
func generateSummary(from text: String) async throws -> String {
    let summarizer = LanguageModelSession(instructions: summarizationSystemPrompt)
    let result = try await summarizer.respond(to: text).content
    return "\(summaryExplainerPrefix)\n\(result)"
}

// later at the callsite recreate session with the content of summary
session = LanguageModelSession(transcript: Transcript(entries: [
    .instructions(.init(segments: [.text(.init(content: systemPrompt))], toolDefinitions: [])),
    .prompt(.init(segments: [.text(.init(content: summary))]))
]))
```

Once the summarizer LLM is done, you get a more concise, dense representation of the conversation. At this point, re-create your main LLM session, injecting the newly created summary with basic instructions so the model knows it is not a normal user message. You also need to ensure your UI does not render the summary as if it came from the user.

If you paused the conversation mid-flight, resume the main LLM. You will not start with a perfectly blank window. Your main session now has a system prompt and the summary resident in the context. That is the trade-off for handling small windows. This process can repeat as many times as you want. You can also add extra handling for:
* The hard out-of-context error, detect and retry with an earlier summarization cutoff
* Fail-safes like throwing away a few of the earliest messages if you keep hitting the same error while trying to summarize

These are not the only solutions. There are many others based on vector "memory” stores and [RAG](https://arxiv.org/abs/2005.11401), etc. In the context of this article, I focus on opportunistic summarization as a strategy that provides a good balance between complexity and the quality of conversation you retain after compaction.

That is it for today. I hope this has been helpful, and it definitely allows you to create an illusion of infinite conversation even with constrained Apple Foundation Models.
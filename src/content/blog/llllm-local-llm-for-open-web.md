---
title: "llllm - LocalLLM for Open Web"
description: "A cross-platform macOS and iOS app that unlocks Apple’s on-device LLMs for any website, offering OpenAI-compatible APIs for privacy-preserving, low-latency AI directly in Safari, Chrome, and beyond. It bridges native-only limitations with a seamless developer and user experience."
pubDate: 2025-07-08
draft: false
---

![llllm logo](/assets/2025-07-08/brain_dev.png)

## Introduction

At WWDC 2025 Apple unveiled [Foundation](https://developer.apple.com/videos/play/wwdc2025/286/) [Models](https://developer.apple.com/videos/play/wwdc2025/301/), a [framework](https://developer.apple.com/documentation/foundationmodels) that lets third-party developers run the same on-device LLMs that power features like Notification summaries, Email categorization, and Writing tools. Everything happens locally, so latency is measured in milliseconds, and no personal data ever leaves the device. The trade-offs: the models are compact (a few billion parameters), and the context window tops out around 4k tokens — plenty for lightweight tasks, but nowhere near state-of-the-art-class reasoning depth.

Apple users upgrade fast (iOS 18 reached 82%, and macOS 15.5 70% in just 90 days). Even though on-device LLM requires modern hardware, the total market is still quite significant. That means in the next 3 months, many people will have access to on-device LLM, many without even knowing it.

Despite that reach, Apple exposes the new models only to native apps. As of writing the blog post, there are no announcements around making the API available to Safari or, god forbid, Chrome-based browsers. Imagine all the client-side smarts that don’t require users downloading multi-gigabyte models that can’t be shared between different websites. Imagine all the private on-device use cases this unlocks: like an e-commerce site instantly summarizing lengthy customer reviews, helping users quickly make buying decisions; or small business websites responding immediately to common visitor questions (such as store hours or product availability) without costly cloud calls.

This is where I saw the opportunity to build something fun!

## The Solution

To bridge the gap Apple left open, I built an app that unlocks on-device LLM power for the web. Simply install it for macOS or iOS and get guided through the setup. No matter if you use Safari, Chrome or any of the Chromium siblings such as Arc, Brave, or Dia, you’ll be up and running in seconds.

The API mirrors OpenAI’s chat/completions JavaScript API, so developers can drop it into existing web code with minimal changes — no new SDK, no rearchitecting your web app. OpenAI-compatible JSON in, streamed tokens out.

After setup, the app fades into the background. Users just browse, and any site that opts in can tap Apple’s local model with no extra downloads or privacy trade-offs. Developers pop open the built-in playground, probe the model, and copy a two-line snippet straight into their code.

## Behind the Scenes

Halfway into the project, I realized that one of the biggest challenges is maintaining two product surfaces (any website accessing API and extension playground), as well as two different browsers (Chrome and Safari) and two platforms (macOS and iOS). The number of combinations of various underlying technologies, security sandbox models etc quickly got out of hand. While obvious in retrospect, I had to take a step back and re-architect the solution to share as much code as possible with some elaborate syncing scripts generating shared code (JS and native) in the right folders since Apple’s development toolchain is so opinionated.

An unexpected challenge was the Chrome Extension Store. Recently, Google introduced an extension review process, meaning that it is harder to distribute Chrome extensions than Safari extensions, which is sort of crazy. Saying that — it did help to catch me asking for permission that I misunderstood and the extension didn’t need. Everything is a trade-off!

Another more expected challenge was shipping the iOS app. We want to provide the highest quality experience on each platform. On macOS it means shipping a non-sandboxed notarized desktop app so that we can help users install all the necessary files with fewer clicks. Needless to say, it wouldn’t fly on iOS. Orchestrating the idiosyncrasies of the platforms while making sure that browser-specific flows stay unaffected took some effort, but it was absolutely worth it.

## Looking Ahead

This is just the beginning. I am looking forward to connecting with folks who are excited to help shape up the future of on-device LLM for the Open Web. Here are a few directions I believe are promising:

- **Unlocking more foundation models, features such as tool calling and serialized outputs** — tapping into more and more features as Apple makes them available will raise the bar for everyone.
- **Enabling custom on-device LLMs** — there is an enthusiastic community of folks using tools such as [ollama](https://ollama.com/) and [LM Studio](https://lmstudio.ai/) to host their own models. Being able to seamlessly bridge those using the same consistent API for the web will unlock extra power for those who need it.
- I am curious if there any existing open standards out there this work can get plugged into. If you are familiar with in-browser on-device LLM efforts, please drop me a line!

Reach out on Twitter: [https://x.com/zats](https://x.com/zats)  
Follow the project on GitHub: [https://github.com/zats/local-llm](https://github.com/zats/local-llm)

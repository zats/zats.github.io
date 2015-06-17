---
layout: post
title: Improving view debugging in Xcode
categories: []
tags: []
published: True

---

Normally view debugging in Xcode is somewhat hard: each `UIViewController` by default comes with an instance of `UIView`, representing it in a view hierarchy. Here is a before and after:

![](/assets/2015-06-16/view-debugging-xcode.png)

And the code that made it possible:

{% gist zats/b4c7da22a076a751b279 %}

Obviously this code is guarded to run only in `DEBUG` mode.

Although I can think of obscure cases when proposed solution might cause bugs, we've been using it in our app for a while and haven't seen any problems. But please tweet me if you run into any problems!
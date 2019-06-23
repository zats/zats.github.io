---
layout: post
title: Improving view debugging in Xcode
categories: []
tags: []
published: True

---

Normally view debugging in Xcode is somewhat hard: you have to attribute bunch of faceless `UIViews` to relevant view controller. Here is a before and after:

![](/assets/2015-06-16/view-debugging-xcode-before.png)

![](/assets/2015-06-16/view-debugging-xcode-after.png)

And the code that made it possible:

Obviously this code is guarded to run only in `DEBUG`.

Although I can think of obscure cases when proposed solution might cause bugs, we've been using it in our app for a while and haven't seen any problems yet. Please do tweet me if you can think of or will run into any issues!
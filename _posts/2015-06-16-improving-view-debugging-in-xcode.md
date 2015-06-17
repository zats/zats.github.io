---
layout: post
title: Improving view debugging in Xcode
categories: []
tags: []
published: True

---

Normally view debugging in Xcode is somewhat hard: it is hard to attribute bunch of faceless `UIViews` to view controller. Here is a before and after:

![](/assets/2015-06-16/view-debugging-xcode-before.png)

![](/assets/2015-06-16/view-debugging-xcode-after.png)

And the code that made it possible:

{% gist zats/339380006894da2c4759 %}

Obviously this code is guarded to run only in `DEBUG` mode.

Although I can think of obscure cases when proposed solution might cause bugs, we've been using it in our app for a while and haven't seen any problems. But please tweet me if you run into any problems!
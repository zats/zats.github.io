---
title: "Radar: Xcode version editor not showing all commits"
description: "Starting from Xcode 4, IDE comes with a version editor allowing (in theory) to browse commits, diffs, blames, logs etc"
pubDate: 2014-04-12
draft: false
heroImage: "/assets/2014-03-04/xcode.png"
---

Starting from Xcode 4, IDE comes with a version editor allowing (in theory) to browse commits, diffs, blames, logs etc

Xcode 5.1 (at least) seems to find itself confused after pulling and jumping between branches several times.

As you can see, commit `edad969c…` is not the latest commit (even if we count only commits affecting current file).

![Xcode Comparison view](/assets/2014-03-04/xcode.png)

![SourceTree](/assets/2014-03-04/sourcetree.png)

To be honest, I can't find a sure way to reproduce the bug. This exact bug affects every team member at the moment. Using 3rd-party git tools (including command line `git`) shows all commits, Xcode – doesn't.

You can duplicate the bug at [rdar://16511277](http://openradar.appspot.com/radar?id=5790409678651392).

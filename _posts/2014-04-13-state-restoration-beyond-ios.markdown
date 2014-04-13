---
layout: post
title: "State restoration: beyond iOS"
date: 2014-04-13
---
Just a brief thought on [Preservation & Restoration API](https://developer.apple.com/library/ios/documentation/iphone/conceptual/iphoneosprogrammingguide/StatePreservation/StatePreservation.html). It occurred to me that extending this technology to Mac OS might give us much more seamless experience when switching between apps on Mac OS and iOS apps.

Imagine moving your Face Time call from your laptop to your phone when you have to run to work. Or peeking up a draft of a document you sketched on your iPad lying on the couch. Or just stepping into the game you started in the bus on your phone and now want to enjoy on your desktop.

There is a partial solution provided by iCloud, but it requires time to sync. Major difference from what (I think) is possible with Restoration API is to take a snapshot of a state in your app and move it entirely to another platform. Obviously it implies your interface and data being highly decoupled. Obviously it requires finding a common denominator between two platforms functionalities.

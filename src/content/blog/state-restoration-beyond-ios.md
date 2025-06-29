---
title: "State restoration: beyond iOS"
description: "Just a brief thought on Preservation & Restoration API. It occurred to me that extending this technology to Mac OS might give us much more seamless experience when switching between apps on Mac OS and iOS apps."
pubDate: 2014-04-13
draft: false
---
Just a brief thought on [Preservation & Restoration API](https://developer.apple.com/library/ios/documentation/iphone/conceptual/iphoneosprogrammingguide/StatePreservation/StatePreservation.html). It occurred to me that extending this technology to Mac OS might give us much more seamless experience when switching between apps on Mac OS and iOS apps.

Possible applications are:

* Moving your Face Time call from your laptop to your phone when you have to run to work.
* Peeking up a draft of a document you sketched on your iPad lying on the couch.
* Continuing the song or a movie you were enjoying on your desktop when you have to run.
* Stepping into the game you started in the bus on your phone and now want to enjoy on your desktop.

There is a partial solution provided by iCloud, but it requires time to sync. The major difference of this approach is you are giving an explicit cue to the app through the UI: move my state now to a particular client (ocontrary to the continues syncing that iCloud does). Obviously it implies your interface and data being highly decoupled. Obviously it requires finding a common denominator between two platforms functionalities.

**Update** One of those cases when Apple [introduced API](https://developer.apple.com/library/prerelease/ios/documentation/UserExperience/Conceptual/Handoff/Introduction/Introduction.html) serving the same purpose but implemented with Bluetooth LTE

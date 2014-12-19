---
layout: post
title: "Signing ipa for different team ids"
date: "2014-07-02"
---

As soon as you leave the cozy Xcode's build process, you find yourself fiddling with [`codesign`](https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man1/codesign.1.html) dealing with, well, code signing. There are many tools that suppose to ease up the process: [ota-tools](https://github.com/RichardBronosky/ota-tools), [shenzhen](https://github.com/nomad/shenzhen) and [gists](https://gist.github.com/mediabounds/1367348) to name a few. However, once in a while you find yourself in need of more flexible solution.

Our flow includes distributing betas from one Apple account and submitting to the App Store from another. This calls for:

* Modifying whole bunch of resources (visual and internal such as bundle id);
* Obtaining new entitlements file;
* Sign ipa again.

Modify resources is easy – everyone used [`PlistBuddy`](https://developer.apple.com/library/mac/documentation/Darwin/Reference/Manpages/man8/PlistBuddy.8.html) to change the app version. The trickier part is to obtain new entitlements. Remember new app id and a team id? Old entitlements simply won't work (think keychain access etc).

Most of the articles on the internet cover signing of the apps with the same bundle ids. Therefore, no issues were noticed.

So where to find an entitlements file? "Capabilities" pane, introduced in Xcode 5, took away the pane of dealing with most of routine. But it comes with a price: unless you explicitly create an entitlements file or trigger one of the capabilities that would do it for you, you will never see it in your project folder.

The file is still being generated when "Code Signing" project setting demands so. Even if you add an entitlements file explicitly to your project, by default it will contain placeholders that would be populated according to the selected team, app id etc but only during the build. This file is generated at `$DERIVED_FILES_DIR/$PRODUCT_NAME.xcent`.

On the day of writing this post I have not received any answer nor on Apple [developer](https://devforums.apple.com/message/995715#995715) [forums](https://devforums.apple.com/message/995748#995748) nor on [Stack Overflow](http://stackoverflow.com/questions/24477305/extracting-entitlements-from-xcode-capabilities). That brought me to two possible solutions, either generate plist on the fly during signing or simply use the one that was generated previously by Xcode.

So the workflow itself is quite trivial:

0. Unzip existent ipa;
0. Replace bundle ids, versions, display and product names;
0. Replace all resources that might be App Store unsafe (e.g. we watermark beta builds with versions to point to Jenkins jobs, which, in turn, points to a particular commit on GitHub);
0. Obtain / generate new entitlements file (stil unclear what is the best way to do it, for now it's hardcoded);
0. Sign using `codesign` tool;
0. Ship it!

Here is a ruby script that is tailored for our needs, but I'm sure, you can tweak it to a certain extent.

By the way, if you know an answer to my question, please drop me a line.

---
layout: post
title: "Moarfonts after upgrading Xcode"
date: 2014-04-14
---
We are using [moarfonts](http://pitaya.ch/moarfonts/) for WSYIWYG-style preview in Interface Builder. And if you'r not doing it yet, you really should. However, after upgrading to Xcode 5.1.1 some of the team members started seeing a strange error while building the project.

> Failed to install XXX: The file “XXX.ttf” couldn’t be opened because there is no such file.
<excerpt/>

After fruitless googling for possible solutions, we took a closer look at the binary that makes moarfonts magic possible. Trying to run `$ moarfonts` in the command line revealed `moarfonts reset`. And although there is no documentation, it looked promising. However you can't run it if you don't have an `SDKROOT` environment variable set. So we ended up with the following cure:

```bash
export SDKROOT=/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator7.1.sdk
moarfonts reset
```

That's it. Clean Derived Data and build folder, restart Xcode and re-run your build. Hope it helps!

**Update**: Cédric Luthi published [troubleshooting guide](http://pitaya.ch/moarfonts/#troubleshooting) you should refer to

**Update** Hail Xcode 6, the script is not needed anymore!

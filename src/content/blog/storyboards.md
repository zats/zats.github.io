---
title: "Storyboards"
description: "I've seen people quoting this Stack Overflow answer a lot when they need to convince someone not to use storyboards. I understand that it's a somewhat a flamewar topic, but I'd like to address the points author makes."
pubDate: 2014-03-12
draft: false
---

I've seen people quoting this [Stack Overflow answer](http://stackoverflow.com/questions/9404471/when-to-use-storyboard-and-when-to-use-xibs/19457257#19457257) a lot when they need to convince someone not to use storyboards. I understand that it's a somewhat a flamewar topic, but I'd like to address the points author makes.

> Storyboards fail at runtime, not at compile time

So does AutoLayout, CoreData or KVO if misused

> Storyboards get confusing fast

It's only common sense to split storyboards into logical groups

> Storyboards make working in a team harder

This is something I have heard a lot. But storyboards are not binary blobs anymore. Merging a storyboard is not any harder than a regular class. Although I heard that it's still challenging even with XML, I'd like to see those merge conflicts, clearly I was dealing with a fairly trivial cases.

> Storyboards make code reviews hard or nearly impossible

True, reviewing storyboard as XML doesn't make much sence

> Storyboards hinder code reuse

True, hopefully will be addressed in the future, and if `Container View` doesn't solve you problem, there is a workaround `nibs` + `awakeAfterUsingCoder:`

> Storyboards make you do everything twice [for iPad and iPhone]

That is a where AppStore shines by offering experiences tailored for iPad and not just streched iPhone apps. If you're reusing your view controllers from iPhone to iPad one to one it might be a bad sign.

> Storyboards require constant context switches

True, it depends on your mindset. For me it's not harder than switch between photoshop mockup and the code. Maybe it's due to my designer past.

Storyboards are hard to refactor – let's face it, Xcode is much worse than App Code when it comes to refactoring, although it always finds outlets and actions.

> Storyboards are not searchable

True, hopefully will be addressed in the future updates of Xcode or maybe you will be the author of a [clever plugin](http://alcatraz.io/) that does that?

> Storyboards are less flexible [than code]

Well, code is always more flexible. Are you setting up your core data scheme in code, too?

> Storyboards don't let you change the type of special view controllers

The argument that it's much easier to make this kind of change in code is questionable to say the least.

> Storyboards add two extra liabilities to your project [XML source and compiled storyboards]

I can see author of the answer using assembly to write his next submission to the App Store, because objective-c is an extra liability. It's just a matter of whether the advantages outweigh the complication certain technology brings.

> Storyboards don't allow you to add a subview to a UIImageView

Normally, I would say if you're adding a subview to `UIImageView`, it's a good sign that you better to have a custom class instead. It's no coincidence that `userInteractionEnabled` is `NO` by default for image views, if you're adding subview just for the sake of alignment, consider using AutoLayout instead.

What wasn't mentioned, is that storyboards (and nibs) introduce a problem of responsibility separation. It becomes yet another point where the views (and now with segues, even more than just views) might be configured. But, like with other code practices such as [`UIAppearance`](https://developer.apple.com/library/ios/documentation/uikit/reference/UIAppearance_Protocol/Reference/Reference.html) or IOC, it's all about being consistent.

All and all I see storyboards as a future with tools that are in the active development, meaning you might want to become an (not so) early adapter and dial with imperfection of the tools but benefit from the technology itself. On The bright side, there are many projects out there that help to dial with shortcomings:

* [objc-codegenutils](https://github.com/square/objc-codegenutils) similar to [mogenerator](https://github.com/rentzsch/mogenerator) in a way, spits files with strongly typed images, string constants etc.
* [StoryboardLint](https://github.com/jfahrenkrug/StoryboardLint) a lint tool for UIStoryboard to find wrong classes and wrong storyboard/segue/reuse identifiers.

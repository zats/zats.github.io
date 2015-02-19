---
layout: post
title: Generational analysis for tests
categories: []
tags: []
published: True
---

# TL;DR

* Execute a typical scenario, returning to the original state.
* Repeat the scenario several (≥ 4) times. 
* Call `-[LeaksInstrument measure]` after each run.
* Assert on `-[LeaksInstrument hasLeaksInRepresentativeSession]` being `NO`.

[Source code](https://github.com/zats/Generational-Analysis)

# Intro

Whether you test your code or not, you've probably heard of [generational analysis](https://developer.apple.com/library/ios/recipes/Instruments_help_articles/FindingAbandonedMemory/FindingAbandonedMemory.html). In short, it's an invaluable tool that allows you to detect if you have a retain cycle or a leak, and some nasty objects are not being released when you expect them to. The way you can test it is:

* Run app, you're profiling in Instruments.app.
* Go through a logically complete flow and return to starting point.
* Click "Mark generation".
* Repeat several times.

What is a logically complete flow? That depends on what your app is doing. For example you're building one-more-note-taking-app. You have a list of notes, tapping on a note takes you to the editing screen. In this case one of the possible flows would be:

* Start from the list view
* Tap one of the notes
* Edit it (preferably do the same editing every time)
* Return back to the list

Why would we want to run this several times? Well, depending on your app, first time you might need to warm up some caches and such. While the last time some objects might naturally still persist in memory - either due to autorelease scope, or a particular framework quirks. That's why you want to take in account all the runs except for the first one and the last one.

As a good practise you should fire this tool once in a while and walk over your application checking if you introduce any retain cycles. While very useful, this can be quite annoying. Once, an iOS engineer told me how he wrote a test checking for retain cycle in a particular scenario. While we didn't discuss any specifics, from what I understood there was a particular reference (let's assume a view controller) that was not released. My assumption, is that the test was simply checking for a particular weak variable to turn `nil`:

```objectivec
__weak id obj = ...; // this is what we expect to become nil if there are no retain cycles
[self _executeScenario1]; // our typical user-flow
XCTAssertNil(obj);
```

# Automate all the things!

Some time ago I stumbled upon a brilliant library by [Richard Heard](http://rheard.com/blog/), called [Objective Beagle](https://github.com/heardrwt/RHObjectiveBeagle). It is a great tool for debugging. It searches all allocated instances, and finds those, matching specified class:

```
(lldb) po beagle(@"UISwitch")
<__NSCFArray 0x8f2e6c0>(
<UISwitch: 0x8f73aa0; frame = (93 226; 51 31); opaque = NO; autoresize = RM+BM; layer = <CALayer: 0x8f73bd0>>,
<UISwitch: 0x8e6fa50; frame = (171 226; 51 31); opaque = NO; autoresize = RM+BM; layer = <CALayer: 0x8c6a760>>
)
```

I figured that this is just what I needed. After slight refactoring, I had a running prototype, here is how to use it:

```objectivec
- (void)testLeakingExample {
    XCTestExpectation *leaksExpectation = [self expectationWithDescription:@"No leaks detected"];
    [self _runFlowNTimes:5 progressHandler:^{
        [self.instrument measure];
    } completionHandler:^{
        XCTAssertFalse(self.instrument.hasLeaksInRepresentativeSession, @"%@", self.instrument);
        [leaksExpectation fulfill];
    }];
    [self waitForExpectationsWithTimeout:10 handler:nil];
}
```

1. We set up an expectation (new awesome feature of XCTest, works in pair with `waitForExpectationsWithTimeout:handler:`).
2. We run our test scenario (editing a note in the example above).
3. After finishing each run, we measure memory footprint with our `instrument`
4. Finally, we assert on a property `hasLeaksInRepresentativeSession` returning `YES` if at least one leak was found.

So all you need to do, is to implement your flow ([KIF](https://github.com/kif-framework/KIF) or any BDD library might come handy), make sure you are returning into the starting point, measure the leaks after each run and assert on leaks once you finish.

Why do I believe this is a great test to have? As time passes by, you will add more features to your app or simply redesign underlying architecture. But until the flow exists, this test will make sure that your refactoring did not introduce any leaks.

# The guts

Now a bit more about the way it works internally. Every recorded session is being diffed against its predecessors, so it contains only the newly added leaks. While you can access `allSessions` to get list of leaks from all the measured sessions, most of the times, you want to use `representativeSessions` instead. As mentioned above, it returns only meaningful measurements, i.e. `allSessions` excluding the first and the last one.

Currently leaks are stored as weakly referenced objects in a `NSHashTable`. I'm still experimenting with it, but the current approach is that the instrument will not extend the lifecycle of the object whether it's leaking or not. However, you might see the `hasLeaksInRepresentativeSession` returning `YES` while enumeration over the leaks in `representativeSessions` will return nothing.

Original implementation in Object Beagle goes to great length to avoid using private or potentially unsafe classes[^1]. In the current implementation, I decided to workaround this problem by limiting classes to those coming from the `[UIBundle mainBundle]`. It is both an improvement and a limitation: e.g. current implementation will ignore classes from shared frameworks.

# TODOs

One of the biggest improvements possible would be to allow a more flexible `measure` call. E.g. if I know that every run of my scenario produces `X` objects of cache, I could've specified something like

```objectivec
[self.instruments measureIgnoring:@{ 
	[XYZImageCache class]: @(NSRangeMake(0,3)) 
}];
```

Where passed dictionary contains a map of classes to the range of instances I expect to persist.[^2] In this case, I expect from 0 to 3 instance of `XYZImageCache` to survive each run.


[^1]: for example if you try to call any method on `_NSZombie_` class you will explode. It's a private class used, as you might've guessed, for detecting zombies.

[^2]: `@(NSRange...)` suppose to be `[NSValue valueWithRange:...]`
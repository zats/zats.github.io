---
layout: post
title: "Target-action for non-ui components. There is an easier way!"
date: "2014-12-23"
---

# TL;DR

Use `-[UIApplication sendAction:to:from:forEvent:]` instead of calling action on target directly if you want responder chain behaviour for free.

# Typical target-action pattern

Often enough, I found myself using this pattern to communicate between a non-ui objects. A simple case might look like this:

```objective-c
@interface Foo : NSObject
@property (nonatomic, weak) id target;
@property (nonatomic) SEL action;
@end

// somehwere in .m
@implementation Foo
- (void)bar {
	[self.target performSelector:self.action];
}
@end
```

Several details worth mentioning here:

* Your target **must** be weak, it's no different from delegate.
* Calling selector on a target requires either silencing the compiler complaining (reasonably so) about ARC not knowing semantics of the call.
* You can get away with using `NSInvocation` or other technics instead.

Now, let's take a look at `UIControl` behaviour. You probably noticed how `-[UIControl addTarget:action:forControlEvents:]` accepts `nil` as a target parameter. What happens then is control, upon firing the event, will walk the responder chain starting from the `firstResponder` up to `UIWindow`, looking for someone who can handle specified `action`. This is what happening when you drag action to the first responder in your storyboard or nib files.

# UIKit to the rescue!

So how do we get this behaviour without traversing responder chain manually?[^1] Luckily, apple got us covered, and, this time, it's relatively straight forward. Let's modify our example above:

```objective-c
// somehwere in .m
@implementation Foo
- (void)bar {
    [[UIApplication sharedApplication] sendAction:self.action to:self.target from:self forEvent:nil];
}
@end
```

As a bonus you can use one of following forms for action for free:

* `- (void)action`
* `- (void)action:(id)sender`
* `- (void)action:(id)sender forEvent:(UIEvent *)event`

UIKit takes care of passing the right parameters for you!

In my example, I consider writing a non-ui feature, so I'm passing `nil` as the event. This technic allows a less-coupled design. However, you should be careful and try to avoid creating a mess of unidentified actions flying around a-la NSNotification-hell

[^1]: which is, apparently, not that easy on iOS http://optshiftk.com/2014/08/implementing-uiapplication-targetforactiontofrom
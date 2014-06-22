---
layout: post
title: "Partial mocking"
date: 2014-06-22
---

This one is going to be about meta programming. I love meta programming in objective-c, `#import <objc/runtime.h>` is one the most exciting imports I might have in the project. This particular adventure came from trying out two mocking libraries out: [OCMock](https://github.com/erikdoe/ocmock) and [OCMockito](https://github.com/jonreid/OCMockito). In particular, I needed partial mock feature. On the moment of writing this post, OCMock claims to have it implemented, OCMockito use to have it but author removed it due to confusing nature (you can still see relevant [issues](https://github.com/jonreid/OCMockito/issues/38) and [pull requests](https://github.com/jonreid/OCMockito/pull/41)). So why all the confusion?
<excerpt/>

As [Jon Reid](https://github.com/jonreid) summarizes the issue[^original-issue]:

> …the spied-on object could delegate to a spy, but its notion of `self` still pointed to the original spied-on object. So anything that invoked `self` would affect the original, not the spy.

To clarify, consider following example[^stubbing-code-ocmockito]

```objective-c
@implementation SUT
- (id)methodA {
    return [self methodB];
}
- (id)methodB {
    return nil;
}
@end

// …in your test class
- (void)testIndirectPartialMock {
    partialMock = partialMock(sut);
    [given([partialMock methodB]) willReturn:@"foo"];
    assertThat([spy methodA], is(@"foo"));
}
```

Consider normal `NSProxy`-based implementation when, using `forwardInvocation:`, you trampoline `methodA` to the actual instance. `NSInvocation` will successfully redirect call to `sut` since `methodA` was not stubbed, but then, inside of it, when it's time to call `methodB`, `self` would point to `sut`, `methodB` as a result, would still return `nil` and not `@"foo"` as we specified. Why is that?

As you probably know, any method in objective-c has two implicit arguments: `self` and `_cmd`, and, as you guessed by now, `self` matches `NSInvocation`'s target: `sut`. Therefore by the time we need to call `methodB`, information about the original `partialMock` is irretrievably lost.

# Diverse `self`

After several attempts to fiddle with `NSInvocation` object I quickly realized, that there is no direct way to set `target` to `sut` yet to keep first argument pointing to my `partialMock`. From here there is only one road: `class_getMethodImplementation`. It returns dynamically resolved function pointer as if message was sent to an instance of a class[^class_getMethodImplementation-for-class-methods].

```objective-c
IMP barkIMP = class_getMethodImplementation([Dog class], @selector(bark));
barkIMP(buddyTheDog, @selector(bark));
```

it's quite obvious from here, that nothing stops us from modifying code above to:

```objective-c
IMP barkIMP = class_getMethodImplementation([Dog class], @selector(bark));
barkIMP(whiskers, @selector(bark));
```

This gives us the actual ability to spoof `self` inside of the `bark` method! Exactly what we were looking for. Except for the fact that it didn't feel right: first of all, we diverged from `NSInvocation` api exposed by `forwardMessage:` argument; second, it's quite easy to find yourself switching over number of arguments in the method, since you might have no parameters or 10 of them. Lastly, dealing with return types, retainig arguments etc would be pain. That is exactly why Apple incapsulated all this into `NSInvocation` class.

# Back to `NSInvocation`

I was back to the square one: desperately trying to find a way to make `NSInvocation` work. After several vain attempts with target and arguments, I fired [Hopper Disassembler](http://www.hopperapp.com), and, o joy: `-[NSInvocation invokeUsingIMP:]`! Lovely private method that has two advantages over regular `invoke`: it allows to call a particular implementation directly, rather than resolving it using `invocation.selector` and provides freedom of the previous implementation without a headache of dealing with all the nuts and bolts manually.

```objective-c
- (void)forwardInvocation:(NSInvocation *)anInvocation {
    // TODO: handle class methods, too
    invocation.target = whiskers;
    Method method = class_getInstanceMethod(object_getClass(buddyTheDog), invocation.selector);
    IMP implementation = method_getImplementation(method);
    [invocation invokeUsingIMP:implementaion];
}
```

Then, a nasty crash appeared. Spoofing worked just fine until a property would be involved into the method body. It would simply crash with `doesNotRecognizeSelector:` or `EXC_BAD_ACCESS`. As I realized, autosynthesized properties would include call to an instance variable, that would effectively transform into

```objective-c
- (NSString *)dogSays {
    return self->_dogSays;
}
```

The new challenge was to get the original `self` when it comes to ivars access, currently it was my `partiallyMockedObject`.

# Ivars

While thinking about implementation, I came to a sad conclusion: there is no way to differentiate between a regular call versus call to a property resulting in ivar access. Furthermore, unlike with method passing, ivar access does not allow any interruption. `->` is a C operator used to access members of a structure.

Classes in Objective C are effectively structures. Among other things, they contain manually created ivars along with the ones generated by `@synthesize`. Therefore this issue was looking to become a fundamental issue of accessing structure member without ability of overloading `->` operator.

[^stubbing-code-ocmockito]: All the testing code uses OCMockito syntax.
[^original-issue]: https://github.com/jonreid/OCMockito/issues/38#issuecomment-26232125
[^class_getMethodImplementation-for-class-methods]: To resolve class method, just pass a [meta class](http://en.wikipedia.org/wiki/Metaclass#In_Objective-C) instead of a regular class.

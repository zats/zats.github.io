---
layout: post
title: "Advanced NSProxy"
date: 2014-07-15
---

Imagine your `Dog` class has a following method:

```objective-c
- (void)greetIfAwake {
  if ([self isAwake]) {
    [self bark];
    [self jump];
  }
}
```

Now imagine a mischievous `Cat` (a subclass of `NSProxy` obviously) wishing to get in a way…
<excerpt/>

Normally your flow would looks like this:

![regular NSProxy flow](/assets/nsproxy-flow/regular-nsproxy-flow.svg)

But what if we want to alter it to be more like this:

![advanced NSProxy flow](/assets/nsproxy-flow/advanced-nsproxy-flow.svg)

e.g. every time method on `self` is invoked, we want our proxy to be consulted prior to execution.

**TL;DR** version can be found in [this gist](https://gist.github.com/zats/c74f38fd5658970d5060)

# Spoofing `self`

First, let's replace `self` within the scope of the original method. As you know, `self` is nothing more than a convention: it's a regular reference passed to each method as a first implicit argument[^self-argument] (so it doesn't affect user-defined arguments). Normally, replacing an argument would be as easy as calling `[invocation setArgument:&argument atIndex:index];`, but, as I mentioned, `self` is a special one. If we follow a regular `forwardInvocation:` pattern, `invocation.target` is used to find receiver for `invocation.selector` and becomes `self` within the scope of the implementation.

```objective-c
- (void)forwardInvocation:(NSInvocation *)invocation {
  [invocation invokeWithTarget:self.originalObject];
}
```

## Forwarding invocation

[Documentation](https://developer.apple.com/library/ios/documentation/Cocoa/Reference/Foundation/Classes/NSObject_Class/Reference/Reference.html#//apple_ref/occ/instm/NSObject/forwardInvocation:) is not clear on the topic of calling `forwardInvocation:` directly on `NSObject` subclasses.

Objective C [runtime code](http://www.opensource.apple.com/source/objc4/objc4-551.1/runtime/NSObject.mm) states that `- [NSObject forwardInvocation:]` simply calls `doesNotRecognizeSelector:` however, iOS Simulator version of `libobjc.dylib` actually calls the original selector if it's found instead. Therefore

```objective-c
- (void)forwardInvocation:(NSInvocation *)invocation {
  [self.originalObject forwardInvocation:invocation];
}
```

works on simulator but throws an exception on devices. I wonder what is the reason to have such a dramatic difference runtime versions.

## A private way

Obviously, I want my code to run both on simulator and on a real device. For that we will need to dive into private `NSInvocation` API:

```objective-c
@interface NSInvocation ()

- (void)invokeUsingIMP:(IMP)implementation;

@end

@implementation HyperspaceAwareSpaceship

- (void)forwardInvocation:(NSInvocation *)invocation {
  Method method = class_getInstanceMethod(object_getClass(self.originalObject), invocation.selector);
  IMP implementation = method_getImplementation(method);
  [invocation invokeUsingIMP:implementation];
}

@end
```

Here we have a bit more explicit story: invocation was clearly designated for our `NSProxy` subclass but instead of `invokeWithTarget:` that figures out implementation of specified `selector` for you, we take over and supplying implementation we believe is right. Besides, this approach works both with simulator and devices.

The downside is the usage of a private API. So, once again, this is definitely not an App Store-friendly code. However, at this point we can spoof `self` on any method.

# Ivars

Another challenge when spoofing `self` lies in synthesized properties. Consider following implementation of `hasEnoughFuel` from our initial example:

```objective-c
- (BOOL)isAwake {
  return !self.isAsleep || self.isPlayingDead;
}
```

Our proxy code is going to crash due to ivar access. Here is autosynthesized implementation of `isPlayingDead` getter:

```objective-c
- (BOOL)isPlayingDead {
  return self->_playingDead;
}
```

which is what compiler turns your `_playingDead` ivar access statements[^ivar-access-statements] into.

Now let's step aside for a second, how did we get here? What does the `->` operator have to do with our objective oriented world? All the classes in objective-c are pointers to structures[^objc_class] and ivars are nothing more than additional fields in the struct. And since Objective C is a strict superset of C, nothing stops us from accessing those fields directly just like this:

```objective-c
CGRect rect = CGSizeMake(3, 14, 15, 92);
CGRect *rectPointer = &rect;
rectPointer->size = (CGSize){65, 35};
```

All we have to do is just to detect `->` operator being used on our "fake" `self` instance. I don't know a first thing about operators overloading (which seems possible with Objective C++). However I was interested in the solution from Objective C domain.

# Dynamic subclassing

One of the benefits of Objective C is ability to create classes at runtime. Now all I need is to create a right superclass to inherit from. Barebones of the `DynamicProxy` are quite trivial: forwarding `respondsToSelector:` and `methodSignatureForSelector:` to the original object and call implementation of the original object in `forwardInvocation:` just as we discussed before.

Next we create a subclass for supplied `originalObject`. Here we have two options.

## KVO's way

First one is to use function called when you register first KVO observer on an instance, `objc_duplicateClass`:

```objective-c
static inline Class DynamicProxyClassForClass(Class objectClass) {
    Class baseClass = [DynamicProxy class];
    NSString *newClassName = [NSString stringWithFormat:@"%@_%@", objectClass, baseClass];
    Class dynamicProxyClass = objc_duplicateClass(objectClass, [newClassName UTF8String], 0);
    class_setSuperclass(dynamicProxyClass, baseClass);
    return dynamicProxyClass;
}
```

This is a fairly straight forward solution except for the `class_setSuperclass` which is deprecated, although being by Foundation's KVO itself. Besides `objc_duplicateClass` has a warning next to it "Used by Foundation's Key-Value Observing. Do not call this function yourself". Which brings us to

## A proper way

Creating a new subclass from scratch, at runtime:

```objective-c
static inline Class DynamicProxyClassForClass(Class objectClass) {
    Class baseClass = [DynamicProxy class];
    NSString *newClassName = [NSString stringWithFormat:@"%@_%@", objectClass, baseClass];
    Class dynamicProxyClass = objc_allocateClassPair(baseClass, [newClassName UTF8String], 0);
    class_setIvarLayout(dynamicProxyClass, class_getIvarLayout(objectClass));
    class_setWeakIvarLayout(dynamicProxyClass, class_getWeakIvarLayout(objectClass));
    CopyAllIvars(objectClass, dynamicProxyClass);
    objc_registerClassPair(dynamicProxyClass);
    return dynamicProxyClass;
}
```

Here we have a bit more going on, but it's all fairly standard class allocation / registration dance except, probably, for copying ivar layouts and ivars (`CopyAllIvars`) from the object class over to the new dynamic class. Without copying layouts and ivars from the base class we will crash every time we're trying to access them.

# Making it all click

The only thing that left to do is to copy all the ivar values from original class over to the dynamic proxy prior to execution of any method to copy them back after (that is if you want original object to be in sync with our proxy). Sadly designated `object_setIvar` / `object_getIvar` pair doesn't handle ivars of primitive types. This is why I had to implement my own set ivar method

```objective-c
static inline void SetIvar(id destination, Ivar ivar, void *originalValue) {
    ptrdiff_t ivarOffset = ivar_getOffset(ivar);
    void **ivarPosition = ((__bridge void*)destination + ivarOffset);
    *ivarPosition = originalValue;
}
```

Consider implementing some sort of `-[DynamicProxy performWithoutUpdatingIvars:]` method so you can avoid this behavior when necessary.

# A word of warning: ivars in a base class

I tried several approaches to make ivars in `DynamicProxy` play nicely with our dynamic subclass. When I would set first ivar from an original class on my proxy it would override first ivar from the proxy's superclass. My guess is that pointer math doesn't add up, so I used an old trick from the categories book: implementing properties using associated objects, e.g.:

```objective-c
- (void)setZts_object:(id)zts_object {
    objc_setAssociatedObject(self, @selector(zts_object), zts_object, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}

- (id)zts_object {
    return objc_getAssociatedObject(self, @selector(zts_object));
}
```

You really should prefix your properties with whatever `xyz` you prefer, since you never know which class are you going to copy over.

# Afterword

Although it seems like a highly theoretical excursive, this technic might be a useful for partial mocking or just for cases when you want to proxy all calls to a particular instance of a class, not just the initial one performed on the proxy directly. Although, I have to acknowledge, this code most likely does not belong to your App Store branch, it is still highly useful for unit tests and debugging purposes.

[^import-runtime]: Use your best judgment to include this kind of code into your production builds!
[^self-argument]: Second implicit parameter is `_cmd` being a selector that is executing, then all your arguments.
[^ivar-access-statements]: You probably remember it from accessing ivars from within certain blocks, when compiler warns you that `self->_ivar` might create a     retain cycle.
[^objc_class]: Since `Class` is a merely `typedef struct objc_class *Class;`, we're basically operating on struct pointers.

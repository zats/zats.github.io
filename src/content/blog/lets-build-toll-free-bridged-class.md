---
title: "Let's build toll-free bridged class"
description: "Source code for this blog post can be found at github: https://github.com/NSFW-Objective-C/Toll-Free-Bridging"
pubDate: 2015-02-14
draft: false
---

Source code for this blog post can be found at github: https://github.com/NSFW-Objective-C/Toll-Free-Bridging

## Intro 

You know technology is well executed when it disappears completely. [Toll-free bridging](http://developer.apple.com/library/ios/#documentation/CoreFoundation/Conceptual/CFDesignConcepts/Articles/tollFreeBridgedTypes.html) is a great example of "invisible" technology. You're using it extensively if you're wiring any Objective-C code probably without even knowing it. So what is toll-free bridging?

> Data types that can be used interchangeably are also referred to as toll-free bridged data types.

In Cocoa, often, by calling a certain method, you get a Core Foundation class where you expected an Objective-C class instead. The beauty is, you don't even know about it: `array.count` works on `CFArrayRef` as well as on `NSArray`. Furthermore, `NSError`, `NSCalendar`, `NSLocale` and others extend the list of bridged classes beyond simple data structures.

The technology manifested itself as a migration path from Core Foundation to NeXTSTEP framework during the creation of the first version of Mac OS X. Apple wanted neither to through away, nor to port all the CF-goodness they accumulated over years[^1]. One might think that technology should've served its purpose during the transitioning period, but obscure [`CFStringTransform`](https://developer.apple.com/library/prerelease/ios/documentation/CoreFoundation/Reference/CFMutableStringRef/index.html#//apple_ref/c/func/CFStringTransform), flexible [`CFArrayCreateMutable`](https://developer.apple.com/library/mac/documentation/CoreFoundation/Reference/CFMutableArrayRef/index.html#//apple_ref/c/func/CFArrayCreateMutable) and many other APIs are still unmatched.

## Creating bridged class

If you're not familiar with general way the technology works, I suggest reading [Mike Ash's post](https://mikeash.com/pyblog/friday-qa-2010-01-22-toll-free-bridging-internals.html). One particular sentence stood out to me though:

> You can't bridge an existing, unbridged CoreFoundation class because it requires massive cooperation on the CoreFoundation side.

Fair enough, I though, after all, Apple is known for keeping their secrets well-guarded and internals untouchable. But I kept coming back to it over and over again, until, finally, I had a whole intercontinental flight to myself and nothing but 11 hours to kill.

There are several not bridged classes I could've chosen. But since [`CFBitVectorRef`](https://developer.apple.com/documentation/CoreFoundation/Reference/CFBitVectorRef/index.html) seemed a bit too esoteric for my day-to-day needs, I decided to go with [`CFBinaryHeapRef`](https://developer.apple.com/library/prerelease/ios/documentation/CoreFoundation/Reference/CFBinaryHeapRef/index.html)[^2].

So just like you might'd guessed, this project was going to have two major pieces: making C API aware of Objective-C counterpart and vice versa. 

### Core Foundation

Here we simply need to "swizzle" C functions, and, after making sure the subject (a first argument in any CF API) is an Objective-C class, we'd call an appropriate method of our Objective-C API. Here is what `CFBinaryHeapGetCount` might look like:

```objc
CFIndex CFBinaryHeapGetCount(CFBinaryHeapRef heap) {
	if (CFGetTypeID(heap) == CFBinaryHeapGetTypeID()) {
		return _CFBinaryHeapGetCount(heap);
	}
	return (CFIndex)[(__bridge BinaryHeap *)heap count];
}
```

I used [fishhook](https://github.com/facebook/fishhook) by Facebook to do just this. Although, implemented inline, it is quite tedious, and there is a room for preprocess macro optimisation left as an exercise for a reader.

### Objective-C

This part is quite easy, it boils down to symmetrical actions on Objective-C side: verifying that `self` is pointing to a CF instance, and, if so, calling corresponding CF function instead of my Objective-C implementation:

```objc
- (void)count {
	if (CFGetTypeID((__bridge CFTypeRef)self) == CFBinaryHeapGetTypeID()) {
		return CFBinaryHeapGetCount((__bridge CFBinaryHeapRef)self);
	}
	return _count;
}
```

Now, consider following code:

```objc
CFBinaryHeapRef heap = CFBinaryHeapCreate(NULL, 64, &callBacks, &context);
[(__bridge BinaryHeap *)heap addObject:@20];
```

Executing it at this point would cause a crash 

```
-[__NSCFType addObject:]: unrecognized selector sent to instance
```

### Bridge

It is not too hard to see the tricky part. In the last snippet of `count` method for `self` to be an instance of `CFBinaryHeapRef` we have to send an Objective-C method to CF class. But Objective-C runtime is not aware of my plans to bridge two classes at this point. Somehow, I had to register my intention first. Looking through [Core Foundation Lite](http://opensource.apple.com/source/CF/) gave me nothing. After all, bridging is a part of a secret souse. Once again, Hopper Disassembler[^3] to the rescue.

After a little research I found `void _CFRuntimeBridgeClasses(CFTypeID cfType, const char *className)` in `CoreFoundation.framework`. The way it works is brilliantly simple. It creates a lookup table between corresponding `CFTypeID` and a class. Now, since all CF instances are being created using `_CFRuntimeCreateInstance` function, its proprietary version includes a lookup through bridged classes table. If it finds a class, registered for bridging, it makes sure that Objective-C will trampoline all method calls to the corresponding class (i.e. `-[CFArrayRef count]` would effectively become `-[NSArray count]`).

So, all we had to do to leverage all the goodness is:

```objc
_CFRuntimeBridgeClasses(CFBinaryHeapGetTypeID(), class_getName([BinaryHeap class]));
```

After that, code above "magically" started to forward messages to Objective-C. 

## Quirks

Following are several interesting observations I've made during this experiment.

### Tail optimisation

If you are to break in any bridged method that has been called on a CF class, you won't see anything in the stack trace between the caller and the implementation. CF uses `objc_setClass` in a proprietary version of `_CFRuntimeCreateInstance`, mentioned above. That's why to the runtime it's equivalent of calling a regular method where implicit first argument, representing `self` is replaced with CF instance. So as for performance overhead, it's negligible.

### Structure

As we know from Objective-C runtime[^4], `NSObject` has one ivar called `isa`[^5] that points to the Class, representing the instance. All CF classes designed to match `NSObject`'s basic ivars structure and to point to `__NSCFType` in the `isa` field[^6]. So the actual magic of `_CFRuntimeBridgeClasses` is to simply call `object_setClass` with a registered bridged class, effectively replacing `isa`'s pointer from `__NSCFType` to let's say `__NSCFArray`.

### Mutability

Now, when we know how to register a class with toll-free bridging system, you might want to know how exactly does it work with mutable and immutable counterpart? After all, both for `CFGetTypeID(cfStr)` and `CFGetTypeID(cfMutableStr)` return the same `CFStringGetTypeID`. Given, that this is a key for lookup of a bridged Objective-C class to forward method calls to, it might be a bit confusing at first how does it differentiate between mutable and immutable versions. I realised this problem while porting `CFBitVectorRef` since it has both flavours. Solution is obvious though: we have to register against mutable Objective-C class. And, while a bit surprising, `__NSCFString`[^7], is, in reality, a subclass of `NSMutableString`. 

---

As an epilogue, I have to admit that this is more of an exercise, sole purpose of which is to test what's possible and to better understand the technology we use every day. As for practical applications, I don't see that many, but it never stopped me from writing code before.


[^1]: For more details, read the post by Peter Ammon http://ridiculousfish.com/blog/posts/bridge.html

[^2]: Often implemented as maximum (minimum) heap. For more information, see http://en.wikipedia.org/wiki/Priority_queue

[^3]: This is an unmatched tool if you're curious to learn about how Objective-C code works, but you don't have sources to a particular binary. If you're into this kind of adventures, definitely check it out http://www.hopperapp.com.

[^4]: The open source flavour of it http://opensource.apple.com/source/objc4

[^5]: Not to mention tagged pointers and Apple discouraging you using `isa` directly.

[^6]: See `CFRuntimeBase` in Core Foundation Lite http://opensource.apple.com/source/CF/CF-855.17/CFRuntime.h.

[^7]: `__NSCFString` is a private subclass of `NSString`, responsible for solely for bridging with `CFStringRef`.




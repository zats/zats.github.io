---
layout: post
title: "Designing your own class cluster. Initializers."
---
I found myself creating a class cluster. Not just a notoriously studied subclass of `NSArray` or `UIButton` but a class cluster base class itself.

After fruitless attempts to google "the right way" of creating such a class, I found little to none information (probably due to lack of a correct search term).

So, I decided to find my own way of doing things. Starting point was `NSArray.h`:

```objective-c
@interface NSArray (NSArrayCreation)
// ...
- (instancetype)init;	/* designated initializer */
- (instancetype)initWithObjects:(const id [])objects count:(NSUInteger)cnt;	/* designated initializer */
// ...
@end
```
So two designated initializers, ha? Documentation is [not conclusive](https://developer.apple.com/library/mac/documentation/general/conceptual/devpedia-cocoacore/ClassCluster.html) [either](https://developer.apple.com/library/ios/documentation/general/conceptual/CocoaEncyclopedia/ClassClusters/ClassClusters.html), it only mentions subclassing class clusters and states that you have to override designated constructors.

Let's try to deconstruct what's happening when we initialize class cluster, for example following code

```objective-c
NSString *strings[3] = {@"foo", @"bar", @"baz"};
id concreteClass = NSClassFromString(@"NSArray");
NSArray *arr = [[concreteClass alloc] initWithObjects:strings count:3];
```

creates an instance of `__NSArrayI` class and fills it with 3 objects.
Now, we can try replacing array class with `__NSArrayI` (a subclass used for immutable arrays) directly of with `_PFArray` (a subclass used by Core Data framework) and result is going to be predictable. But it's not a default behavior we used to when dealing with subclasses: If you message superclass with init, you get an instance of a superclass. If you message a subclass – an instance of a subclass.

So how do we insure this behavior without causing nasty infinite lopps? Well, it's rather simple, but involves one violation of a good object-oriented design. I ended up with following code in my initializers so far:

```objective-c
@implementation ZTSStack

- (instancetype)init {
    if ([self isMemberOfClass:[ZTSStack class]]) {
        return [[_ZTSStack alloc] init];
    }
    return [super init];
}

- (instancetype)initWithCapacity:(NSUInteger)capacity {
    if ([self isMemberOfClass:[ZTSStack class]]) {
        return [[_ZTSStack alloc] initWithCapacity:capacity];
    }
    return [self init];
}
```

Just several things to note:

* Superclass has to know who is the "default implementation" subclass.
* I don't have the regular `if (!self) return nil;` routine since I do nothing in the "abstract" base class.
* I check for `isMemberOfClass:` rather then `isKindOfClass:` to enbale strict equality.

By implementing initializers like that I get the same behavior as when using `NSArray`:

* Address the base class directly and you get a default subclass implementation.
* Address a (non-default) subclass with initialization method and you will "follow through" up to the `NSObject` in initialization chain.

Now I can safely add convenience methods such as

```objective-c
+ (instancetype)stackWithCapacity:(NSUInteger)capacity {
    return [[self alloc] initWithCapacity:capacity];
}

+ (instancetype)stackBackedByTwoQueuesWithCapacity:(NSUInteger)capacity {
    return [[_ZTSStackBackedByTwoQueues alloc] initWithCapacity:capacity];
}

+ (instancetype)stackBackedByLinkedListWithCapacity:(NSUInteger)capacity {
    return [[_ZTSStackBackedByLinkedList alloc] initWithCapacity:capacity];
}
```

I'm still not sure why `NSArray`, for example, has two designated initializers. Solution, implemented above, works for my current (limited) set of use-cases and I will keep investigation.

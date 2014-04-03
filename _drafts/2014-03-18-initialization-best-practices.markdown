---
layout: post
title:  "Initialization best practices"
---
Recently I read a very interesting article by Twitter's Jake Jennings [How To: Objective C Initializer Patterns](https://blog.twitter.com/2014/how-to-objective-c-initializer-patterns). It got me into thinking and led me to the Apple's documentation on [objects allocation](https://developer.apple.com/library/ios/documentation/general/conceptual/CocoaEncyclopedia/ObjectAllocation/ObjectAllocation.html#//apple_ref/doc/uid/TP40010810-CH7-SW1) and [objects initialization](https://developer.apple.com/library/ios/documentation/general/conceptual/CocoaEncyclopedia/Initialization/Initialization.html#//apple_ref/doc/uid/TP40010810-CH6-SW1).

Turns out, I forgot very important concepts of the two step initialization: why do we write `[[MyClass alloc] init]` in one statement. I got this question on one of the interviews in the past.

Consider following code

```objective-c
Phoo *foo = [Phoo alloc];
[foo init];
[foo bar];  
```

It seems like it does exactly the same thing, but let's go through it line by line.

By the end of the first line we have an empty object with retain count of +1, instance variables initialized to `nil` (or its' equivalent if primitive), `isa` pointer set to the corresponding `Class` object.

The second line actually initializes variables according to the internal logic of the class and its superclass chain.

The third line obviously performs some highly complicated task.

Now, normally, this code would work, but remember that new class template you fill in so aptly?

```objective-c
- (instancetype)init {
    self = [super init];
    if (self) {
      // initialization
    }
    return self;
}
```

What happens if `[super init]` returns `nil`? That's right, we will just return `nil`. But getting `nil` in my previous sample code is not registered anywhere. So the next line `[foo bar]` would be performed on an allocated and not initialized object. It won't necessarily result in a crash, but it definitely imposes an unpredictable behavior. Those kind of bugs are much worse since they are harder to debug. According to [clang documentation](http://clang-analyzer.llvm.org/annotations.html#attr_ns_consumes_self) `init` group of methods annotated with `NS_REPLACES_RECEIVER` that tells to the compiler that receiver might be changed by this function (macro above expands into `NS_CONSUMES_SELF` combined with `NS_RETURNS_RETAINED`). Another example is a proper implementation of a singleton, in this case `init` returns the same instance, while alloc would return instance.

`- [NSObject awakeAfterUsingCoder:]` marked with `NS_REPLACES_RECEIVER`


```objective-c
Phoo *obj = [[Phoo alloc] initWithBar:@"Foo"];
obj = [obj initWithBar:@"Baz"];
```

According to [Issues with Initializers](https://developer.apple.com/library/ios/documentation/general/conceptual/CocoaEncyclopedia/Initialization/Initialization.html#//apple_ref/doc/uid/TP40010810-CH6-SW57) should throw an exception. Try

```objective-c
NSString *string = @"Hello";
string = [string initWithFormat:@"%@ world", string];

NSArray *array = [[NSArray alloc] init];
[array initWithCapacity:10];

UIView *view = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 10, 10)];
view = [view initWithFrame:CGRectMake(0, 0, 20, 20)];
```

Funny enough, note in the docs says

> Although, for the sake of simplicity, this example returns nil if the parameter is nil, the better Cocoa practice is to raise an exception

Have never seen anyone doing that

# Where to go from here

* Lovely post by folks from twitter about designated initializers https://blog.twitter.com/2014/how-to-objective-c-initializer-patterns
* An answer by bbum if it's ok to call just `[MyClass alloc]` instead of `[[MyClass alloc] init]` if your init doesn't do much http://stackoverflow.com/questions/22662810/if-i-do-nothing-in-init-is-it-the-same-as-just-calling-myclass-alloc/22699634#22699634

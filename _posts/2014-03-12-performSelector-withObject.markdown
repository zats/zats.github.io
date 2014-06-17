---
layout: post
title:  "RTFM performSelector:withObject:"
---

Recently, while going through the code review, I stumbled upon a curious bug that manifested itself on iOS 7.1 64 bit simulator. A committer had a boolean setter that he wanted to call with a delay, so he had a following code

```objective-c
@property (nonatomic, assign) BOOL splashFinishedDisplaying;

[self performSelector:@selector(setSplashFinishedDisplaying:)
           withObject:@YES
           afterDelay:2];

```

This code didn't work on iOS 7.1 in 64 bit simulator. The workaround he offered was to declare a wrapper method `setSplashFinishedDisplayingWithNumber:` and use that with `performSelector:…`.
<excerpt/>

I didn't really like this approach for several reasons, and proposed to use `dispatch_after` instead. The major reason is it produces ARC-friendly analyzable code where `performSelector:` does not (also creating a proxy method feels kinda kind of dirty).

While I, personally, don't like the `performSelector:` group of methods, I was curious what is the deal with it. I wrote a simple code to debug the case and ran it in several environment combinations of iOS version and 64 / 32 bit systems.

```objective-c
- (void)setFrame:(CGRect)frame {
    NSLog(@"Frame: %@", NSStringFromCGRect(frame));
}

- (void)setInteger:(NSInteger)integer {
    NSLog(@"Integer: %i", integer);
}

- (void)setBoolean:(BOOL)boolean {
    NSLog(@"Boolean: %@", boolean ? @"YES" : @"NO");
}

- (void)testCase {
    NSValue *frameValue = [NSValue valueWithCGRect:CGRectMake(3, 14, 15, 92)];
    NSLog(@"Rect value %@ %p", frameValue, frameValue);
    [self performSelector:@selector(setFrame:) withObject:frameValue];

    NSNumber *integerValue = @300;
    NSLog(@"Integer number %@ %p", integerValue, integerValue);
    [self performSelector:@selector(setInteger:) withObject:integerValue];

    NSNumber *booleanValue = @YES;
    NSLog(@"Boolean value %@ %p", booleanValue, booleanValue);
    [self performSelector:@selector(setBoolean:) withObject:booleanValue];
}
```

32 bit, iOS 6 console output is

```
Rect value NSRect: {3, 14}, {15, 92} 0xacb8820
Frame: {1.95994e-32, 2.1209e-35}, {1.95994e-32, 4.03828e-37}
Integer number 300 0xacb8800
Integer: 181110784
Boolean value 1 0x30d795c
Boolean: YES
```

Replacing string format for integer with `%li`, console output for 64 bit, iOS 7.1 is

```
Rect value NSRect: {3, 14}, {15, 92} 0x10e635bb0
Frame: {3, 14}, {15, 92}
Integer number 300 0xb0000000000012c2
Integer: 4802
Integer number 1 0x103d2e0e0
Boolean: NO
```

The test case produces randomly wrong / right results depending on the iOS version and 64 / 32 bit. As you can see, I added the address of the variable I'm sending to the selector. I didn't have it at first, but added in the second round of tests and it proved my guess. Method simply interprets the address variable as the primitive type it expects. That's why `setInteger:` with `300` with address `0xacb8800` receives `181110784`. The Big Nerd Ranch has a [very good article](blog.bignerdranch.com/564-bools-sharp-corners/) about craziness of boolean defined as `char` on 32 bit systems.

Only after that I went into the documentation for the `performSelector:withObject:`

> This method is the same as `performSelector:` except that you can supply an argument for `aSelector`. `aSelector` should identify a method that takes a single argument of type `id`. For methods with other argument types and return values, use `NSInvocation`.

Here is a [stack overflow answer](http://stackoverflow.com/questions/904515/how-to-use-performselectorwithobjectafterdelay-with-primitive-types-in-cocoa/1735045#1735045), illustrating usage of `NSInvocation`. I believe that invocation doesn't produce ARC-friendly code in a sense of an arbitrary executed code, but the application for invocation is much broader, while `dispatch_after` solves a very particular task.

Another case of RTFM. What still doesn't make much sense is that structure randomly works with 64 bit system.

---
layout: post
title:  "Initialization best practices"
---

Case 1: partial initialization, init returned `nil`

```objective-c
Phoo *foo = [Phoo alloc];
[foo init];
[foo bar];  
```

Case 2:

```objective-c
Phoo *obj = [[Phoo alloc] initWithBar:@"Foo"];
obj = [obj initWithBar:@"Baz"];
```

According to [Issues with Initializers](https://developer.apple.com/library/ios/documentation/general/conceptual/CocoaEncyclopedia/Initialization/Initialization.html#//apple_ref/doc/uid/TP40010810-CH6-SW57) should throw an exception. Try

```objective-c
NSString *string = @"Hello";
string = [string initWithFormat:@"%@ world", string];
```

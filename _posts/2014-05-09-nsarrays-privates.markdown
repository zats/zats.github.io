---
layout: post
title: "NSArray's privates"
date: 2014-05-09
---

Some methods that didn't make it in the `NSArray`'s public API, however they are easy to implement. Most of them are based around `NSFastEnumeration`.

# `containsObjectIdenticalTo:`

Where `containsObject:` uses `isEqual:` to find if array contains specified object, this method uses pointer equality only. It might give you speed boost in certain cases.

```objective-c
NSDictionary *person1 = @{ @"name" : @"Bob" };
NSDictionary *person2 = @{ @"name" : @"John" };
NSArray *array = @[ person1, person2 ];

// using isEqual:
[array containsObject:person1]; // YES
[array containsObject:@{ @"name" : @"Bob" }]; // YES

// using ==
[array containsObjectIdenticalTo:person1]; // YES
[array containsObjectIdenticalTo:@{ @"name" : @"Bob" }]; // NO
```

# `arrayByApplyingSelector:`

This method provides semi-mapping. Semi because you don't get to return any value you want instead of the current one. Rather you have to call any method from defined on the object. If your parameter expects parameters – bad luck. Obviosuly, you method has to return an object and not primitive.

```objective-c
NSArray *array = @[ @1, @2, @3 ];
array = [array arrayByApplyingSelector:@selector(stringValue)];
[[array firstObject] isKindOfClass:[NSString class]]; // YES
```

# `countForObject:`

Method, allowing to count all objects that are `isEqual` to the specified one. Another example of a convinience wrapper around `NSFastEnumeration` loop. Funny enough, `NSSet` has similar method, it always returns `1` if object is a member of a set or `0` if not.

```objective-c
NSArray *test = @[ @1, @2, @3, @1, @1 ];
[test countForObject:@1]; // 3
```

# `arrayByExcludingObjectsInArray:`

This method is somewhat similar to `minusSet:` of `NSMutableSet` or `NSMutableOrderedSet`. This method, however, leaves duplicates and overall order of the objects intact. This metod actually uses `+[NSSet setWithArray:]` from the parameter array to exclude. This ensures `NSFastEnumeration` over parameter-array won't go through duplicates. Also it uses `containsObject:` on the receiver array, causing comparison by value and not by pointer.

```objective-c
NSArray *array = @[ @1, @2, @4, @3, @2 ];
[array arrayByExcludingObjectsInArray:@[ @1, @3, @3 ]; // @[ @2, @4, @2 ]
```

# `arrayByExcludingToObjectsInArray:`

Very similar to previous method, but, logically it's more of a `intersectSet:` in `NSMutableSet` terms.

```objective-c
NSArray *test = @[ @1, @2, @3, @1, @2, @1 ];
[test arrayByExcludingToObjectsInArray:@[ @2, @1 ]]; // @[ @1, @2, @1, @2, @1 ]
```

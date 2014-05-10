---
layout: post
title: "NSArray's privates"
date: 2014-05-09
---

> Several private methods from `NSArray` API, complexity analysis, and how to implement it yourself.

I remember reading somewhere how at Apple, API goes through several stages of internal usage without publishing it to 3rd party developers. It helps to test it properly, and helps to make sure that the names are well chosen (!).
Here is a rundown of some methods that didn't make it in the `NSArray`'s public API (and probably won't).

The good news is that most of them are based around `NSFastEnumeration` `for in` loop and quite straight forward to implement if want to. Just, please, don't forget to prefix it with your branded `xyz_`. Or even better, call them something different all together to avoid potential problems when submitting the app.

# `containsObjectIdenticalTo:`

Where `containsObject:` uses `isEqual:` to find if array contains specified object, this method uses pointer equality only. It might provide you a nice performance boost if the objects stored have complex `isEqual:` and all you care is pointer comparison. By the way, the default implementation of `-[NSObject isEqual:]` does pointer comparison, so if you have not overridden it, don't bother, this is not your bottleneck.

## Complexity:
*O(n)*

## Usage
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

## How to implement
```objective-c
- (BOOL)containsObjectIdenticalTo:(id)object {
    for (id subobject in self) {
        if (subobject == object) {
            return YES;
        }
    }
    return NO;
}
```

# `arrayByApplyingSelector:`
This method is a somewhat simliar to the signal transformation that can be found in popular today [reactive frameworks](https://github.com/ReactiveCocoa/ReactiveCocoa). Somewhat similar, because you don't get to return any value you want instead of the current one. Rather, you get to call a specified selector.

If your method of choise expects parameters – bad luck. Obviosuly, you method has to return an object and not primitive. If you method returnes `nil` for certain cases, object will not be inserted into a new array.

This method is usefull for arrays containing instances of one class only (or if objects happened to respond to the same selector which is not that safe really).

## Complexity
*O(n)*

## Usage
```objective-c
NSArray *array = @[ @1, @2, @3 ];
array = [array arrayByApplyingSelector:@selector(stringValue)];
[[array firstObject] isKindOfClass:[NSString class]]; // YES
```

## How to implement
```objective-c
- (NSArray *)arrayByApplyingSelector:(SEL)selector {
    if (!selector) {
        [self doesNotRecognizeSelector:selector];
    }
    NSUInteger maxNumberOfNewObjects = [self count];
    // allocate enough space to fit maxNumberOfNewObjects of objects
    id objects[maxNumberOfNewObjects] = …;
    NSUInteger newCount = 0;
    for (id object in self) {
        id newObject = [object performSelector:selector];
        if (newObject) {
            newCount++;
            objects[newCount] = newObject;
        }
    }
    NSArray *result = [NSArray arrayWithObjects:objects count:newCount];
    // don't forget to release the allocated objects
    return result;
}
```

# `countForObject:`
A straightforward method, allowing to count all objects that are `isEqual` to the specified one. Another example of a convenience wrapper around `NSFastEnumeration` loop.

Interestingly, `NSSet` has a similar method, that returns `1` if object is a member of a set and `0` if not.

## Complexity
*O(n)*

## Usage
```objective-c
NSArray *test = @[ @1, @2, @3, @1, @1 ];
[test countForObject:@1]; // 3
```

## How to implement
```objective-c
- (NSUInteger)countForObject:(id)object {
    NSUInteger count = 0;
    for (id subobject in self) {
        if ([subobject isEqual:object]) {
            count++;
        }
    }
    return count;
}
```
Note usage of `isEqual:` rather than pointer comparison.

# `arrayByExcludingObjectsInArray:`
This method is somewhat similar to `minusSet:` of `NSMutableSet` or `NSMutableOrderedSet`. This method, however, leaves duplicates and overall order of the objects intact. This metod actually uses `+[NSSet setWithArray:]` from the parameter array to exclude. This ensures `NSFastEnumeration` over parameter-array won't go through duplicates. Also it uses `containsObject:` on the receiver array, causing comparison by value and not by pointer.

## Complexity
*O(n+m)* where *n* is a number of elements in the receiver and *m* is a number of elements in the argument array.

## Usage
```objective-c
NSArray *array = @[ @1, @2, @4, @3, @2 ];
[array arrayByExcludingObjectsInArray:@[ @1, @3, @3 ]; // @[ @2, @4, @2 ]
```

## How to implement
```objective-c
- (NSArray *)arrayByExcludingObjectsInArray:(NSArray *)array {
    NSSet *set = [NSSet setWithArray:array];

    NSUInteger maxNumberOfNewObjects = [self count];
    // allocate enough space to fit maxNumberOfNewObjects of objects
    id objects[maxNumberOfNewObjects] = …;
    NSUInteger newCount = 0;
    for (id object in self) {
        if (![set containsObject:object]) {
            newCount++;
            objects[newCount] = object;
        }
    }
    NSArray *result = [NSArray arrayWithObjects:objects count:newCount];
    // don't forget to release the allocated objects
    return result;
}
```
Note, complexity of *O(n+m)* achieved by creating an `NSSet` from the argument array first, and iterating over all elements of the receiver. `containsObject:` for `NSSet` has complexity of *O(1)* unlike `NSArray`'s version, that would limit complexity of the method overall to *O(nm)*.

# `arrayByExcludingToObjectsInArray:`
Very similar to previous method, but, logically it's more of a `intersectSet:` in `NSMutableSet` terms.

## Complexity
*O(n+m)*

## Usage
```objective-c
NSArray *test = @[ @1, @2, @3, @1, @2, @1 ];
[test arrayByExcludingToObjectsInArray:@[ @2, @1 ]]; // @[ @1, @2, @1, @2, @1 ]
```

## How to implement
```objective-c
- (NSArray *)arrayByExcludingObjectsInArray:(NSArray *)array {
    NSSet *set = [NSSet setWithArray:array];

    NSUInteger maxNumberOfNewObjects = [self count];
    // allocate enough space to fit maxNumberOfNewObjects of objects
    id objects[maxNumberOfNewObjects] = …;
    NSUInteger newCount = 0;
    for (id object in self) {
        if ([set containsObject:object]) {
            newCount++;
            objects[newCount] = object;
        }
    }
    NSArray *result = [NSArray arrayWithObjects:objects count:newCount];
    // don't forget to release the allocated objects
    return result;
}
```

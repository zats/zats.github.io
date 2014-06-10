---
layout: post
title: "NSArray complexity"
date: 2014-06-02
---

Most of the time we take system classes for granted. Methods we call every day in hundreds might hide complexity we didn't anticipate. This post is my attempt to clarify running complexity of the most common `NSArray` methods. I used [Hopper Disassembler](http://www.hopperapp.com) extensively while writing this post, and if you are into this kind of forensic adventures, you should definitely give it a try.
<!--more-->

# Initializer

Creation of the array is bound by the number of elements you want to initialize it with. Sadly, it's not possible to reference passed `void ** elements`. If you recall basics of Cocoa collections, most of them retain added elements by default. If you drop down to the level of Core Foundation, you can even specify your own callback functions to process all elements prior to insertion and removal[^array-callbacks-structure].  Finally, whether `retain` callback was set or not, `CFArrayRef` copies each element into its own bucket, allowing quick, predictable access by means of pointer math.

## `initWithArray:`
_O(n)_, calls [_`initWithArray:range:copyItems:`_](#initwitharrayrangecopyitems)[^method-legend], copies items.

## `initWithArray:copyItems:`
_O(n)_, calls [_`initWithArray:range:copyItems:`_](#initwitharrayrangecopyitems).

## `initWithObjects:`
_O(n)_, calls [`initWithObjects:count:`](#initwithobjectscount).

## `initWithObjects:count:`
_O(n)_, where _n_ is a number of objects, sets indexed ivars, calls [_`__new:::`_](new).

## _`initWithArray:range:copyItems:`_
_O(n)_, calls [`initWithObjects:count:`](initwithobjectscount).

## _`__new:::`_
_O(n)_, where _n_ is a number of passed objects, enumerated using `do {} while` loop.

# Querying an Array

This is a strong suit of arrays, most of the methods require _O(1)_ time. At first, it seems like array containing random data types can not retrieve _n_-th element without iterating over all preceding ones, querying size of each one of them. Core Foundation solves this issue by wrapping each element in a bucket, e.g. `CFArrayRef` keeps a pointer to the first `__CFArrayBucket`, so `objectAtIndex:` effectively becomes `__CFArrayGetBucketAtIndex(array, index) -> actualData`.

The only exception is `containsObject:` group of methods, assuming we have no additional knowledge about the array internals, we have to iterate over all elements to probe for equality.

| Method | Complexity | Notes |
| :- | :-: | :- |
| `containsObject:` | _O(n)_ | where _n_ is the number of objects in the receiver, enumerated using `do {} while` loop |
| `count` | _O(1)_ | |
| `getObjects:range:` | _O(1)_ | assuming subsequential `memmove` call has complexity of _O(1)_[^memmove-runtime-complexity] |
| `firstObject` | _O(1)_ | `objectAtIndex:` |
| `lastObject` | _O(1)_ | `objectAtIndex:` |
| `objectAtIndex:` | _O(1)_ | unlike Core Foundation, `__NSArrayI` uses `object_getIndexedIvars` instead of buckets, mutable `__NSArrayM` uses pointer math on `id *_list` |
| `objectsAtIndexes:` | _O(n)_ | where _n_ is a number of indexes, enumerated using `do {} while` loop |

# Finding Objects in an Array

Just like with `containsObject:`, when it comes to finding indexes for given objects, complexity increases up to _O(n)_[^find-index-of-element].

## `indexOfObject:`  
_O(n)_ , where _n_ is a number of elements in the receiver array, iterated using `do {} while` loop.

## `indexOfObject:inRange:`
_O(n)_, where _n_ is a length of the passed range, iterated using `do {} while` loop
| `indexOfObjectIdenticalTo:` | _O(n)_ | where _n_ is a number of elements in the receiver array; it's famous for being faster than `indexOfObject:` due to utilization of a comparison by reference (`==`) instead of comparison by value  (`isEqual:`), using fast enumeration over all elements in the receiver |
| `indexOfObjectIdenticalTo: inRange:` |  _O(n)_ | where _n_ is a length of the passed range |
| `indexOfObjectPassingTest:` | _O(?)_ | calls `indexOfObjectWithOptions: passingTest:` with no options specified |
| `indexOfObjectWithOptions: passingTest:` | _O(n)_ | where _n_ is a number of elements in the receiver; calls _`_NSArrayGetIndexPassingTest`_, that, in its turn, uses fast enumeration |
| `indexOfObjectAtIndexes: options: passingTest:` | _O(n)_ | where _n_ is a number of indexes in the `indexSet` parameter; calls _`_NSArrayGetIndexPassingTest`_, that, in its turn, uses fast enumeration |
| `indexesOfObjectsPassingTest:` | _O(n)_ | calls `indexesOfObjectsWithOptions: passingTest:` with no options specified |
| `indexesOfObjectsWithOptions: passingTest:` | _O(n)_ | calls _`_NSArrayGetIndexesPassingTest`_ |
| `indexesOfObjectsAtIndexes: options: passingTest:` | _O(n)_ | calls _`_NSArrayGetIndexesPassingTest`_ |
| `indexOfObject: inSortedRange: options: usingComparator:` | _O(log n)_ |  |

# Comparing Arrays

This group of methods have to iterate over all elements of the receiver array. In Core Foundation domain, specify your own `CFArrayCallBacks.equal` function to implement custom logic for using `CFEqual`.

| Method | Complexity | Notes |
| :- | :-: | :- |
| `firstObjectCommonWithArray:` | _O(n+m)_ | where _n_ is a number of elements in the receiver array and _m_ is a number of element in the parameter array. If this method would be implemented as iteration over elements with `[array containsObject:element]`, it would take _O(nm)_. Instead `NSSet` from the argument array instead, it gives us a _O(1)_ `containsObject:`. |
| `isEqualToArray:` | _O(n)_ | where _n_ is a number of elements in the receiver array |

# Deriving New Arrays

| Method | Complexity | Notes |
| :- | :-: | :- |
| `arrayByAddingObject:` | _O(n)_ | where _n_ is a new number of elements, calls `getObjects:range` to get objects, `arrayWithObjects:count:` to create new array |
| `arrayByAddingObjectsFromArray:` | _O(n+m)_ | where _n_ is a number of elements in the receiver and _m_ is the number of the elements in the argument array, calls `getObjects:range` to get objects, `arrayWithObjects:count:` to create new array |
| `filteredArrayUsingPredicate:` | _O(n)_ | where _n_ is a number of elements in the receiver |
| `subarrayWithRange:` | _O(n)_ | where _n_ is the length of the `range`; uses `getObjects:range:` and `arrayWithObjects:count:` |

# Sorting

Sorting methods in Core Foundation rely on the private `CFSortIndexes` function declared in `CFSortFunctions.m`. Since it accepts list of indexes and not a particular data structure, it is useful not only for `NSArray` but also for `NSSet`, `NSSortedSet` and `NSDictionary`.

Function, in turn, sorts lists up to 3 elements in place and, if the argument list is longer, follows classical merge sort algorithm. `__CFSimpleMerge` private function actually performs sort and merge and, according to the documentation, performs much better than average _O(n log n)_

| Method | Complexity | Notes |
| :- | :-: | :- |
| `sortedArrayHint` | _O(n<sup>2</sup>)_ | this seem to be the case because of the nested loop over all elements of the receiver |
| `sortedArrayUsingFunction: context:` | | calls `sortedArrayWithOptions:usingComparator:` |
| `sortedArrayUsingFunction: context: hint:` | _O(n)_ | where _n_ is a number of elements in the receiver (due to previously calculated `hint` blob) |
| `sortedArrayUsingDescriptors:` | _O(n log n)_ | uses merge sort behind the scenes |
| `sortedArrayUsingSelector:` | | |
| `sortedArrayUsingComparator:` | | calls _`sortedArrayFromRange: options: usingComparator:`_ |
| `sortedArrayWithOptions: usingComparator:` | _O(log<sup>2</sup> n)_ | if odd-even merge sort was used |
| _`sortedArrayFromRange: options: usingComparator:`_ | | |

[^find-index-of-element]: Assuming we do not have any additional information about the array. For sorted array use `indexOfObject:inSortedRange:options:usingComparator:`.
[^method-legend]: Methods in italic are private, i.e. `publicBoringMethod:` vs _`privateAwesomeMethod:`_.
[^array-callbacks-structure]: see `CFArrayCallBacks` structure in `CFArray.h` file
[^memmove-runtime-complexity]: This is not the case, `memmove` actually has complexity of _O(n)_, where _n_ is a number of bytes to copy, but in my tests it was always neglectibly small value comparing to the operations performed by Cocoa.

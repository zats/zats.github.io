---
layout: post
title: "NSArray complexity"
date: 2014-06-02
---

Following is a brief analysis of runtime of all major methods of NSArray.

# Initializer

| Method | Complexity | Notes |
| :- | :-: | :- |
| `initWithArray:` | _O(n)_ | calls _`initWithArray:range: copyItems:`_, copies items |
| `initWithArray:copyItems:` | _O(n)_ | _`initWithArray:range:copyItems:`_ |
| `initWithContentsOfFile:` | _O(?)_ | `CFPropertyListCreateWithData` |
| `initWithContentsOfURL:` | _O(?)_ | `CFPropertyListCreateWithData` |
| `initWithObjects:` | _O(n)_ | calls `initWithObjects:count:` |
| `initWithObjects:count:` | _O(n)_ | where _n_ is a number of objects, sets indexed ivars, calls _`__new:::`_ |
| _`initWithArray:range:copyItems:`_[^method-legend] | _O(n)_ | calls `initWithObjects:count:` |
| _`__new:::`_ | _O(n)_ | where _n_ is a number of passed objects, enumerated using `do {} while` loop |

# Querying an Array

| Method | Complexity | Notes |
| :- | :-: | :- |
| `containsObject:` | _O(n)_ | where _n_ is the number of objects in the receiver, enumerated using `do {} while` loop |
| `count` | _O(1)_ | |
| `getObjects:range:` | _O(1)_ | assuming subsequential `memmove` call has complexity of _O(1)_ |
| `firstObject` | _O(1)_ | `objectAtIndex:` |
| `lastObject` | _O(1)_ | `objectAtIndex:` |
| `objectAtIndex:` | _O(1)_ | `object_getIndexedIvars` is used to access standard `__NSArrayI` immutable array elements, `id *_list` is used for a `__NSArrayM` mutable array |
| `objectsAtIndexes:` | _O(n)_ | where _n_ is a number of indexes, enumerated using `do {} while` loop |

# Finding Objects in an Array

| Method | Complexity | Notes |
| :- | :-: | :- |
| `indexOfObject:` | _O(n)_ | where _n_ is a number of elements in the receiver array, iterated using `do {} while` loop |
| `indexOfObject:inRange:` | _O(n)_ | where _n_ is a length of the passed range, iterated using `do {} while` loop |
| `indexOfObjectIdenticalTo:` | _O(n)_ | where _n_ is a number of elements in the receiver array; it's famous for being faster than `indexOfObject:` due to utilization of a comparison by reference (`==`) instead of comparison by value  (`isEqual:`), using fast enumeration over all elements in the receiver |
| `indexOfObjectIdenticalTo:inRange:` |  _O(n)_ | where _n_ is a length of the passed range |
| `indexOfObjectPassingTest:` | _O(?)_ | calls `indexOfObjectWithOptions:passingTest:` with no options specified |
| `indexOfObjectWithOptions:passingTest:` | _O(n)_ | where _n_ is a number of elements in the receiver; calls _`__NSArrayGetIndexPassingTest`_, that, in its turn, uses fast enumeration |
| `indexOfObjectAtIndexes:options:passingTest:` | _O(n)_ | where _n_ is a number of indexes in the `indexSet` parameter; calls _`__NSArrayGetIndexPassingTest`_, that, in its turn, uses fast enumeration |
| `indexesOfObjectsPassingTest:` | _O(n)_ | calls `indexesOfObjectsWithOptions:passingTest:` with no options specified |
| `indexesOfObjectsWithOptions:passingTest:` | _O(n)_ | calls `__NSArrayGetIndexesPassingTest` |
| `indexesOfObjectsAtIndexes:options:passingTest:` | _O(n)_ | calls `__NSArrayGetIndexesPassingTest` |
| `indexOfObject:inSortedRange:options:usingComparator:` | _O(log n)_ |  |

# Comparing Arrays

| Method | Complexity | Notes |
| :- | :-: | :- |
| `firstObjectCommonWithArray:` | _O(n)_ | where _n_ is a number of elements in the receiver |
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
| `sortedArrayUsingFunction:context:` | | calls `sortedArrayWithOptions:usingComparator:` |
| `sortedArrayUsingFunction:context:hint:` | _O(n)_ | where _n_ is a number of elements in the receiver (due to previously calculated `hint` blob) |
| `sortedArrayUsingDescriptors:` | _O(n log n)_ | uses merge sort behind the scenes |
| `sortedArrayUsingSelector:` | | |
| `sortedArrayUsingComparator:` | | calls _`sortedArrayFromRange:options:usingComparator:`_ |
| `sortedArrayWithOptions:usingComparator:` | _O(log<sup>2</sup> n)_ | if odd-even merge sort was used |
| _`sortedArrayFromRange:options:usingComparator:`_ | | |

[^method-legend]: Methods in italic _`methodName:`_ are private

---
layout: post
title: "NSArray complexity"
date: 2014-06-02
extra_css:
  - /public/css/2014-06-02-nsarray-complexity.css
---

attempt to clarify running complexity of the most common `NSArray` methods. I used [Hopper Disassembler](http://www.hopperapp.com) extensively while writing this post, and if you are into this kind of forensic adventures, you should definitely give it a try.
<excerpt/>

# Initializer

Creation of the array is bound by the number of elements you want to initialize it with. Sadly, it's not possible to reference passed `void ** elements`. If you recall basics of Cocoa collections, most of them retain added elements by default. If you drop down to the level of Core Foundation, you can even specify your own callback functions to process all elements prior to insertion and removal[^array-callbacks-structure].  Finally, whether `retain` callback of `CFArrayCallBacks` structure set or not, `CFArrayRef` puts each element into its own bucket, allowing quick, predictable access by means of pointer math.

![init methods diagram](/assets/2014-06-02/initialization.svg)


| Method | Big&nbsp;*O* | Description |
| --- | --- | --- |
| `initWithArray:` | _O(n)_ | calls _`initWithArray:range:copyItems:`_[^method-legend], copies items |
| `initWithArray:copyItems:` | _O(n)_ | calls _`initWithArray:range:copyItems:`_ |
| `initWithObjects:` | _O(n)_ | calls `initWithObjects:count:` |
| `initWithObjects:count:` | _O(n)_ | _n_ is a number of objects, sets indexed ivars, calls *`__new:::`* |
| _`initWithArray:range:copyItems:`_ | _O(n)_ | calls `initWithObjects:count:` |
| *`__new:::`* | _O(n)_ | _n_ is a number of passed objects, enumerated using `do {} while` loop |

# Querying an Array

This is a strong suit of arrays, most of the methods require _O(1)_ time. At first, it seems like array containing random data types can not retrieve _n_-th element without iterating over all preceding ones, querying size of each one of them. Core Foundation solves this issue by wrapping each element in a bucket, e.g. `CFArrayRef` keeps a pointer to the first `__CFArrayBucket`, so `objectAtIndex:` effectively becomes `__CFArrayGetBucketAtIndex(array, index) -> actualData`.

The only exception is `containsObject:` group of methods, assuming we have no additional knowledge about the array internals, we have to iterate over all elements to probe for equality. By the way, if you know that objects you store have slow `isEqual:`, you can implement your own a slightly faster

```objective-c
- (BOOL)containsObjectIdenticalTo:(id)object {
  return [self indexOfObjectIdenticalTo:object] != NSNotFound;
}
```

It's stil _O(n)_, but uses equality by pointer instead of by value.

![init methods diagram](/assets/2014-06-02/querying.svg)

| Method name | Big&nbsp;_O_ | Description |
| --- | --- | --- |
| `containsObject:` | _O(n)_ | _n_ is the number of objects in the receiver, enumerated using `do {} while` loop |
| `count` | _O(1)_ | due to caching of the array size |
| `getObjects:range:` | _O(1)_ | assuming subsequential `memmove` call has complexity of _O(1)_[^memmove-runtime-complexity] |
| `firstObject` | _O(1)_ | calls `objectAtIndex:` |
| `lastObject` | _O(1)_ | calls `objectAtIndex:` |
| `objectAtIndex:` | _O(1)_ | as we established, Core Foundation `CFArrayRef` and, therefore, Cocoa wrapper *`__NSCFArray`* use pointer math to access buckets with objects. Mutable *`__NSArrayM`* uses pointer math on `id *_list` ivar which is somewhat similar. Only immutable *`__NSArrayI`* can afford using `object_getIndexedIvars` instead |
| `objectsAtIndexes:` | _O(n)_ | _n_ is a number of continues ranges in the supplied index set. Let me clarify. `NSIndexSet` has some, sadly, private APIs. Remember how when we print a description of an index set, we see a nice list of ranges instead of continues list of indexes? That is actually APIs in action: two private methods `rangeCount` and `rangeAtIndex:`. Implementation simply iterates over all ranges and, combining with `getObjects:range:`, it allows to fetch all required elements in _O(n)_ where _n_ is a number of ranges. Comparing to _O(n)_ where _n_ is a number of all indexes in index set, and giving the fact that a typical use case involves continues ranges rather of sparse indexes it turns out to be quite a time-saver. |

# Finding Objects in an Array

Just like with `containsObject:`, when it comes to finding indexes for given objects, complexity increases up to _O(n)_[^find-index-of-element].

![init methods diagram](/assets/2014-06-02/finding-objects.svg)

| Method name | Big&nbsp;_O_ | Description |
| --- | --- | --- |
| `indexOfObject:`  | _O(n)_ | _n_ is a number of elements in the receiver array, iterated using `do {} while` loop |
| `indexOfObject:inRange:` | _O(n)_ | _n_ is a length of the passed range, iterated using `do {} while` loop |
| `indexOfObjectIdenticalTo:` | _O(n)_ | _n_ is a number of elements in the receiver array; it's famous for being faster than `indexOfObject:` due to utilization of a comparison by reference (`==`) instead of comparison by value  (`isEqual:`), using fast enumeration over all elements in the receiver |
| `indexOfObjectIdenticalTo:inRange:` | _O(n)_ | _n_ is a length of the passed range |
| `indexOfObjectPassingTest:` | _O(n)_ | calls `indexOfObjectWithOptions:passingTest:` with no options specified |
| `indexOfObjectWithOptions:passingTest:` | _O(n)_ | _n_ is a number of elements in the receiver; calls *`__NSArrayGetIndexPassingTest`*, that, in its turn, uses fast enumeration |
| `indexOfObjectAtIndexes:options:passingTest:` | _O(n)_ | _n_ is a number of indexes in the `indexSet` parameter; calls *`__NSArrayGetIndexPassingTest`*, that, in its turn, uses fast enumeration |
| `indexesOfObjectsPassingTest:` | _O(n)_ | _n_ is a number of elements in the receiver array; calls `indexesOfObjectsWithOptions:passingTest:` with no options specified |
| `indexesOfObjectsWithOptions:passingTest:` | _O(n)_ | _n_ is a number of elements in the receiver array; calls *`__NSArrayGetIndexesPassingTest`* |
| `indexesOfObjectsAtIndexes:options:passingTest:` | _O(n)_ | _n_ is a number of elements in the receiver array; calls *`__NSArrayGetIndexesPassingTest`* |
| `indexOfObject:inSortedRange:options:usingComparator:` | _O(log&nbsp;n)_ | Fairly classical implementation of the binary search on the sorted array. It serves two purposes: first is to find an existent element of the array and the second one, personally more interesting: where to insert supplied element to maintain array sorted. |
| *`__NSArrayGetIndexPassingTest`* | _O(n)_ | _n_ is a number of elements in the supplied array. When no `NSEnumerationOptions` supplied, this function simply iterates over all elements using `for in` and returns first matching element |
| *`__NSArrayGetIndexesPassingTest`* | _O(n)_ | _n_ is a number of elements in the supplied array. When no `NSEnumerationOptions` supplied, this function simply iterates over all elements using `for in` and adds elements into an index set |

# Comparing Arrays

This group of methods have to iterate over all elements of the receiver array. In Core Foundation domain, specify your own `CFArrayCallBacks.equal` function to implement custom logic for using `CFEqual`.

| Method | Big&nbsp;_O_ | Description |
| --- | --- | --- |
| `firstObjectCommonWithArray:` | _O(n&nbsp;+&nbsp;m)_ | _n_ is a number of elements in the receiver array and _m_ is a number of element in the parameter array. If this method would be implemented as iteration over elements with `[array containsObject:element]`, it would take _O(nm)_. Instead, when converting parameter array to `NSSet` (running complexity _O(m)_, where _m_ is a number of elements in the array), we gain _O(1)_ `containsObject:`, that allows us to reduce overall running complexity of the method |
| `isEqualToArray:` | _O(n)_ | _n_ is a number of elements in the receiver array |

# Deriving New Arrays

| Method | Big&nbsp;_O_ | Description |
| --- | --- | --- |
| `arrayByAddingObject:` | _O(n)_ | _n_ is a new number of elements, calls `getObjects:range` to get objects, `arrayWithObjects:count:` to create new array |
| `arrayByAddingObjectsFromArray:` | _O(n&nbsp;+&nbsp;m)_ | _n_ is a number of elements in the receiver and _m_ is the number of the elements in the argument array, calls `getObjects:range` to get objects, `arrayWithObjects:count:` to create new array |
| `filteredArrayUsingPredicate:` | _O(n)_ | _n_ is a number of elements in the receiver |
| `subarrayWithRange:` | _O(n)_ | _n_ is the length of the `range`; uses `getObjects:range:` and `arrayWithObjects:count:` |

# Sorting

Almost all array sort methods rely on Core Foundation's `CFMergeSortArray`, that, in turn, uses `CFSortIndexes` implemented in `CFSortFunctions.m`. What is interesting about `CFSortIndexes`, it accepts list of indexes and not a particular data structure, so it can be reused for any data structure as long as you can map indexes to particular element. That allows to reuse same function not only for `NSArray`, but also for `NSSet`, `NSSortedSet` and `NSDictionary`.

`CFSortIndexes` uses `__CFSimpleMergeSort` when on iPhone or no concurrent options were passed. This function sorts lists up to 3 elements in place and, or follows classical merge sort algorithm if number of elements is greater than 3. `__CFSimpleMerge`, responsible for the "conquer" part of the algorithm, claims to perform better than average _O(n log n)_ according to the comments.

| Method | Big&nbsp;_O_ | Description |
| --- | --- | --- |
| `sortedArrayHint` | _O(n)_ | _n_ is a number of elements in the receiver. This method should be performed on a strictly sorted array, so you can reuse result with `sortedArrayUsingFunction:context:hint:` |
| `sortedArrayUsingFunction:context:` | _O(n&nbsp;log&nbsp;n)_ | wraps a function call into `sortedArrayWithOptions:usingComparator:` |
| `sortedArrayUsingFunction:context:hint:` | _O(P&nbsp;log&nbsp;P&nbsp;+&nbsp;n)_ | _P_ is a number of changes since `sortedArraHint` was called on sorted array and _n_ is a number of elements in the receiver. This is a very interesting method. I suggest reading [Apple's documentation](https://developer.apple.com/library/ios/documentation/cocoa/reference/foundation/classes/NSArray_Class/NSArray.html#//apple_ref/doc/uid/20000137-DontLinkElementID_73). In short, if you had a sorted array of _n_ elements and performed _P_ operations (insert, delete, swap) on it, where _P_ is much less than _n_, this method should work much faster than `sortedArrayUsingFunction:context:`. Sadly, all my tests failed to demonstrate performance benefit described above. When testing Apple's [sample code](https://developer.apple.com/library/mac/Documentation/Cocoa/Conceptual/Collections/Articles/Arrays.html#//apple_ref/doc/uid/20000132-SW8) regular `sortedArrayUsingFunction:context:` seems to be faster than its hinted version. Besides, the problem domain seems close to insertion sort that might be more effective in this case, also you might want to use `indexOfObject:inSortedRange:options:usingComparator:` with `NSBinarySearchingInsertionIndex` option to find suggested index to insert the new element |
| `sortedArrayUsingDescriptors:` | _O(n&nbsp;log&nbsp;n)_ | calls `CFMergeSortArray` |
| `sortedArrayUsingSelector:`<br/>`sortedArrayUsingComparator:`<br/>`sortedArrayWithOptions:usingComparator:` | _O(n&nbsp;log&nbsp;n)_ | calls _`sortedArrayFromRange:options:usingComparator:`_ |
| _`sortedArrayFromRange:options:usingComparator:`_ | _O(n&nbsp;log&nbsp;n)_ | calls `_CFSortIndexes` with elements from specified `range`, effectively performing merge sort |

[^find-index-of-element]: Assuming we do not have any additional information about the array. For sorted array use `indexOfObject:inSortedRange:options:usingComparator:`.
[^method-legend]: Methods in italic are private, i.e. `publicBoringMethod:` vs _`privateAwesomeMethod:`_.
[^array-callbacks-structure]: see `CFArrayCallBacks` structure in `CFArray.h` file
[^memmove-runtime-complexity]: This is not the case, `memmove` actually has complexity of _O(n)_, where _n_ is a number of bytes to copy, but in my tests it was always neglectibly small value comparing to the operations performed by Cocoa.
[^sorted-array-hint-endians]: Consider different edians on different platform, i.e. Mac OS X utilizes little endians.

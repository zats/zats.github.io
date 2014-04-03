---
layout: post
title: String formatters and 64 bit
---

Let's say you have following log statement `NSLog(@"Number of molecules is %d", i)`. Assuming the `i` is a `NSUInteger`, you will notice that ever time your compile for 64-bit you get `Values of type 'NSInteger' should not be used as format arguments; add an explicit cast to 'long' instead` warning.

Suppressing warnings or downcasting when the value might overflow is not an ideal solution. Instead we can leverage new specifiers mentioned in [this tweet](https://twitter.com/gparker/status/377910611453046784) by Greg Parker:

| Type | Formatter |
| :-- | :--: |
| `NSUInteger` | `%tu` |
| `NSInteger`  | `%zd` |
| `NSUInteger` or `NSInteger` as hex | `%tx` |

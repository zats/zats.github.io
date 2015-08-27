---
layout: post
title: copy vs retain
categories: []
tags: []
published: True

---

The question when to use `copy` vs `retain` is getting quite old, so I decided to summarise some rules here. Mostly this is Objective-C related post.

# Properties

## *Must* `copy` if type has a mutable subclass

```objectivec
@property (nonatomic, copy) NSArray *puppies;
```

or in Swift when using with Objective-C:

```swift
@NSCopying var name: String
```

If type of a property has a mutable counterpart, you *must* use `copy`, since you might get `NSMutable<Class>` instead of `NS<Class>` and the value might simply change underneath you without you knowing about it.

## *Might* need `copy` if type conforms `NSCopying`

If type of a property conforms to `NSCopying`, it's a sign that you *might* want to use `copy` but not necessarily. It would depend on implementation details of a particular class. Sadly, Cocoa doesn't have strict guidelines on how class should implement `NSCopying`. Keep in mind there is a `NSMutableCopying` protocol, if you want to underline the fact you have mutable and immutable flavors of your class, implement both protocols.

## `copy` doesn't affect ivars assignment

Keep in mind that `copy` affects only the assignment fo the property and not the underlying ivar:

```objectivec
@property (nonatomic, copy) NSAttributedString *attributedTitle;

- (void)setAttributedTitle:(NSAttributedString *)title {
	_attributedTitle = [title copy];
}
```

## Even if property is`readonly`

Even if property is declared as `readonly`, it is a good practise to use `copy`: you don't have to remember to copy values internally. Also it helps to avoid potential bugs later if you decided to expose property as `readwrite`.

# Methods

## Arguments

```objectivec
- (void)applyParameters:(NSDictionary *)parameters {
	parameters = [parameters copy]; // not that it's nice to reassign parameters
}
```

When working with parameters, depending on the implementation details of your method, you might want to copy arguments. Sadly, there is no syntactic sugar for it. In the example above, it is valid to pass a `NSMutableDictionary` which might be changed from a different thread or, if you keep the reference to `parameters` once you leave the method.

## Return values

```objectivec
// Private proeprty declared in `.m`
@property (nonatomic, strong) NSMutableArray *things;

- (NSArray *)currentStateOfThings {
	return [self.things copy];
}
```

When you're promissing to return immutable object, while your internal property is mutable, you probably want to `copy` because consumers will make all sort of assumptions about the object, including its thread safety. 

Consider user getting a reference to internally mutable array and using it a data source for table view. Some time later, you remove several objects from the array, next time consumer scrolls he will crash since he was not aware of count proeprty chagned on the array.
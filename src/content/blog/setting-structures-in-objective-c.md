---
title: "Setting structures in Objective-C"
description: "You know how you always do this little dance to update couple of values on a structure property"
pubDate: 2014-10-02
draft: false
---

You know how you always do this little dance to update couple of values on a structure property

```objective-c
CGRect frame = self.view.frame;
frame.size.width = 100;
frame.origin.y = 30;
self.view.frame = frame;
```

There is a better way!

First, let's start with a sligtly better way. If you don't want to polute your scope with temporary variables (let's say you have to change five different view's frames)

```objective-c
self.view.frame = ({
   CGRect frame = self.view.frame;
   frame.size.width = 100;
   frame.origin.y = 30; 
   frame;
});
```

This code utilizes C feature of scopes but looks kind of ugly. That's where C macros can help:

```objective-c
#define WMLSetStructure(object, key, setterBlock) ({\n    if (NO) {(void)((object).key);}\n    object.key = ({\n        typeof(object.key) key = object.key;\n        setterBlock;\n        key;\n    });\n})
```

Here is how to use it

```objective-c
WMLSetStructure(self.view, frame, {
    frame.origin.y = 30;
    frame.size.width = 100;
});

WMLSetStructure(self.mapView, region, {
    region.center.longitude -= 0.0001;
    region.span.latitudeDelta += 3.1415;
});
```

It creates a local vairable with the same name as the property and returns it at the end of the scope.

The only thing I don't like about it is the need to separate object with key, I do it to provide you with the variable with the same name as the key in the setter scope.

Oh and see that line

```objective-c
if (NO) {(void)((object).key);}
```

it helps to autocompete key according to the list of properties this object has.

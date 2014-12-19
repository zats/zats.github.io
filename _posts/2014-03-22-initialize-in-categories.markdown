---
layout: post
title: "+initialize in categories"
date: 2014-04-12
---

An interesting quirk for `+ initialize` method when implemented in a category. Documentation doesn't really explain what is the correct behavior of the method, let's figure it out by ourselves.

> The runtime sends `initialize` to each class in a program just before the class, or any class that inherits from it, is sent its first message from within the program […] Superclasses receive this message before their subclasses. The superclass implementation may be called multiple times if subclasses do not implement `initialize` — the runtime will call the inherited implementation — or if subclasses explicitly call `[super initialize]`.

Imagine, we have following classes in an empty project:

0. `UIView (ZTSAdditions)` – a category on `UIView`
0. `ZTSView1 : UIView` – a subclass of `UIView`
0. `ZTSView2 : ZTSView1` – a subclass of `ZTSView1`
0. `ZTSView1 (ZTSAdditions)` – a category on `ZTSView1`

Every class from mentioned above implements `+ initialize`

```objective-c
// somewhere in .pch
#define ZTSLog() ({ NSLog(@"%s +[initialize] %@", __FILE__, NSStringFromClass(self)); })

+ (void)initialize {
    ZTSLog();
}
```

In our app delegate we add following code (note, there is no import of categories).

```objective-c
#import "ZTSView1.h"
#import "ZTSView2.h"

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    [self.window addSubview:[ZTSView1 new]];
    [self.window addSubview:[ZTSView2 new]];
    return YES;
}
```

What are we going to see in the console?

```
…UIView+ZTSAdditions.m +[initialize] UIView
…UIView+ZTSAdditions.m +[initialize] _UIScrollsToTopInitiatorView
…UIView+ZTSAdditions.m +[initialize] UIStatusBar
…
…ZTSView1+ZTSAdditions.m +[initialize] ZTSView1
…ZTSView2.m +[initialize] ZTSView2
…
…UIView+ZTSAdditions.m +[initialize] UIAlertView
…UIView+ZTSAdditions.m +[initialize] UIFieldEditor
```

`+ initialize` is being fired for every subclass of your category class. Not really documented behavior but makes sense. But remember, we haven't imported category in our app delegate, nor mentioned it in any imported class.

Something to be aware of when abusing `initialize` method. I'd try to avoid using it at all – if two categories override `initialize` method, there is no guarantee that your method is going to be called. Use `+load` instead.

**Update** a very good article on this topic was published in 2009 by bbum: http://www.friday.com/bbum/2009/09/06/iniailize-can-be-executed-multiple-times-load-not-so-much/

---
title: "Improving view debugging in Xcode"
description: "Normally view debugging in Xcode is somewhat hard: you have to attribute bunch of faceless UIViews to relevant view controller."
pubDate: 2015-06-16
draft: false
heroImage: "/assets/2015-06-16/view-debugging-xcode-after.png"
---

Normally view debugging in Xcode is somewhat hard: you have to attribute bunch of faceless `UIViews` to relevant view controller. Here is a before and after:

![](/assets/2015-06-16/view-debugging-xcode-before.png)

![](/assets/2015-06-16/view-debugging-xcode-after.png)

And the code that made it possible:

```
#ifdef DEBUG

#import "WMLSwizzler.h"

static SEL wml_loadViewSEL;

static void wml_swizzleLoadViewForClass(Class class) {
    typedef void(*load_view_t)(id, SEL);
    __block load_view_t loadView = (load_view_t)[class S_replaceInstanceMethod:wml_loadViewSEL withBlock:^(UIViewController *self){
        loadView(self, wml_loadViewSEL);
        if (!self.isViewLoaded) {
            return;
        }
        Class viewClass = [self.view class];
        Class viewControllerClass = [self class];
        // in case this method was called twice
        if ([NSStringFromClass(viewClass) hasPrefix:NSStringFromClass(viewControllerClass)]) {
            return;
        }
        NSString *viewClassName = viewClass == [UIView class] ?
            [NSString stringWithFormat:@"%@.view", NSStringFromClass(viewControllerClass)] :
            [NSString stringWithFormat:@"%@.view: %@", NSStringFromClass(viewControllerClass), NSStringFromClass(viewClass)];
        Class newViewClass = NSClassFromString(viewClassName);
        if (!newViewClass) {
            newViewClass = objc_allocateClassPair(viewClass, [viewClassName cStringUsingEncoding:NSUTF8StringEncoding], 0);
            objc_registerClassPair(newViewClass);
        }
        object_setClass(self.view, newViewClass);
    }];
}

static BOOL const wml_isKindOfClass(Class class, Class possibleAncestor) {
    if (class == possibleAncestor) {
        return YES;
    }
    
    do {
        class = class_getSuperclass(class);
        if (class == possibleAncestor) {
            return YES;
        }
    } while (class && class != [NSObject class]);
    return NO;
}

@interface UIViewController (WMLViewDebugging)
@end


@implementation UIViewController (WMLViewDebugging)

+ (void)load {
    @autoreleasepool {
        static dispatch_once_t onceToken;
        dispatch_once(&onceToken, ^{
            wml_loadViewSEL = @selector(loadView);
            
            IMP originalIMP = [UIViewController instanceMethodForSelector:wml_loadViewSEL];
            wml_swizzleLoadViewForClass([UIViewController class]);
            
            unsigned int classesCount = 0;
            Class *classList = objc_copyClassList(&classesCount);
            for (unsigned int i = 0; i < classesCount; ++i) {
                Class cls = classList[i];
                const char *cClassName = class_getName(cls);
                if (strcmp(cClassName, "JSExport") == 0 ||
                    strcmp(cClassName, "Object") == 0 ||
                    strcmp(cClassName, "__NSGenericDeallocHandler") == 0 ||
                    strcmp(cClassName, "__NSMessageBuilder") == 0 ||
                    strcmp(cClassName, "_NSZombie_") == 0){
                    continue;
                }
                // If you encounter crash here, add exception to the previous if case
                if (cls == [UIViewController class] ||
                    !wml_isKindOfClass(cls, [UIViewController class]) ||
                    [cls instanceMethodForSelector:wml_loadViewSEL] == originalIMP) {
                    continue;
                }
                wml_swizzleLoadViewForClass(cls);
            }
        });
    }
}

@end

#endif
```

Obviously this code is guarded to run only in `DEBUG`.

Although I can think of obscure cases when proposed solution might cause bugs, we've been using it in our app for a while and haven't seen any problems yet. Please do tweet me if you can think of or will run into any issues!
---
layout: post
title: "Whose symbol is this?"
date: "2014-10-25"
---

Once in a while I found myself in need of finding who declared certain function or method. With Apple added support for iOS frameworks, the need in being sure where particular piece of code is coming is somewhat high.

```objective-c
#import <dlfcn.h>
```

# Function

```objective-c
Dl_info info;
if (dladdr((void *)NSStringFromClass, &info)) {
    printf("%s", info.dli_fname);
}
```

```
…/Frameworks/Foundation.framework/Foundation
```

# Method

```objective-c
IMP imp = [view methodForSelector:@selector(drawRect:)];
Dl_info info;
if (dladdr((void *)imp, &info)) {
    printf("%s", info.dli_fname);
}
```

```
…/Frameworks/UIKit.framework/UIKit
```

Keep in mind that `methodForSelector:` resolves implementation that'd be actually called at runtime.
If you want to trace down an original implementation (e.g. before swizzling), it all boils down to finding (keeping) the right `IMP`:

# Swizzled methods

```objective-c
// after swizzling, our implementation can be reached through orignial selector
// and original implementation can be reached through our swzld_ selector
IMP swizzledIMP = [self methodForSelector:@selector(viewDidLoad)];
IMP originalIMP = [self methodForSelector:@selector(swzld_viewDidLoad)];
Dl_info info;
if (dladdr((void *)swizzledIMP, &info)) {
    printf("%s\n", info.dli_fname);
}
if (dladdr((void *)originalIMP, &info)) {
    printf("%s", info.dli_fname);
}
```

```
…/Test.app/Test
…/Frameworks/UIKit.framework/UIKit
```

Sadly you can not trace the origins of declarations, e.g. I couldn't figure out how to find out who declared `-[UIApplicationDelegate applicationDidFinishLaunching:]`

# Keep in mind

If you mistype selector when obtaining implementation, you'll get a confusing `…/usr/lib/libobjc.A.dylib` as an originating binary.

This is due to the fact that `methodForSelector:` short-circuits to `-[NSObject doesNotRecognizeSelector]`, which, as you probably guessed by now, is declared in Objective-C runtime.

# Blocks

Finally, much more rare case of getting a pointer to a block and tracing its origin back to the binary. As turns out, it's no different from a function:

```objective-c
void(^block)(NSUInteger) = ^(NSUInteger a){
    NSLog(@"%tu", a);
};

Dl_info info;
if (dladdr((__bridge void *)block, &info)) {
    printf("%s", info.dli_fname);
}
```

```
…/Test.app/Test
```

# Bonus

As a bonus though, here is a snippet on how to print names of all the loaded frameworks at runtime without:

```objective-c
unsigned int imagesCount;
const char **bundles = objc_copyImageNames(&imagesCount);
for (unsigned int i = 0; i < imagesCount; ++i) {
    printf("%s", bundles[i]);
}
```

```
…/usr/lib/system/introspection/libdispatch.dylib
…/usr/lib/system/libxpc.dylib
…/usr/lib/system/libsystem_network.dylib
…/usr/lib/libobjc.A.dylib
…/System/Library/Frameworks/Accelerate.framework/Frameworks/vecLib.framework/libLinearAlgebra.dylib
…/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation
…/System/Library/PrivateFrameworks/FontServices.framework/libFontParser.dylib
…/usr/lib/libextension.dylib
…/System/Library/Frameworks/CFNetwork.framework/CFNetwork
…/System/Library/Frameworks/MobileCoreServices.framework/MobileCoreServices
…/System/Library/Frameworks/Foundation.framework/Foundation
…/System/Library/Frameworks/JavaScriptCore.framework/JavaScriptCore
…/System/Library/PrivateFrameworks/AggregateDictionary.framework/AggregateDictionary
```

It returns a full list of names that can be used with `dlfcn` functions making it useful for further investigations.

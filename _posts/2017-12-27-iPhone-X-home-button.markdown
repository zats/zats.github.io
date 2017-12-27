---
layout: post
title: "iPhone X home button"
date: 2017-12-27
---

As soon as I saw iPhone X home indicator replacing the physical button, I got interested in its behavior: it has to be visible both on the lock screen with an arbitrary wallpaper as a background and in any 3rd-party app showing arbitrary content, which in case of videos or games can also change quite quickly.

![](/assets/2017-12-27/home-indicators.png)

Obviously, UIKit doesn't expose anything remotely similar, so let's figure out how it is built!

# Finding the home indicator class

To figure out where to look for the relevant code, I tried to think of the similar UI elements. Initially I thought system status bar would be the closest relative. Just like home indicator it lives on the lock screen, just like home indicator it's being added to every app window. My first naive attempt was to look in UIKit that contains some of the status bar-relevant code. Looking into UIKit header dumps you can find on GitHub, I didn't find anything that seemed to correspond to the new home indicator.
Next, I'd like to explore SpringBoard - it is an “app” that lives in the CoreServices folder and contains various system functionality corresponding with lock and home screen. Dumping classes containing in SpringBoard with `class-dump` (`$ brew install class-dump`) shows an interesting `SBHomeGrabberView`. That's a good start:

```
$ class-dump /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/Library/CoreSimulator/Profiles/Runtimes/iOS.simruntime/Contents/Resources/RuntimeRoot/System/Library/CoreServices/SpringBoard.app/SpringBoard

...

@interface SBHomeGrabberView : UIView <_UISettingsKeyPathObserver, SBAttentionAwarenessClientDelegate, MTLumaDodgePillBackgroundLuminanceObserver>
{
    SBHomeGrabberSettings *_settings;
    MTLumaDodgePillView *_pillView;
    SBAttentionAwarenessClient *_idleTouchAwarenessClient;
    _Bool _touchesAreIdle;
    _Bool _autoHides;
    long long _luma;
    unsigned long long _suppressLumaUpdates;
}

@property(nonatomic) _Bool autoHides; // @synthesize autoHides=_autoHides;
- (void).cxx_destruct;
- (void)lumaDodgePillDidDetectBackgroundLuminanceChange:(id)arg1;
```

Next up, let's load entire code from SpringBoard into our dummy app so that we can add the view to the window and check if it's actually the one we are interested in. While the code can be cleaner, essential idea is this:

```objc
#import <dlfcn.h>

// somewhere in viewDidLoad
dlopen([binaryPath cStringUsingEncoding:NSUTF8StringEncoding], RTLD_NOW);
UIView *const view = [[NSClassFromString(@"SBHomeGrabberView") alloc] init];
[view sizeToFit];
[self.view addSubview:view];
```

With few modifications, this is what we get:

![](/assets/2017-12-27/few-home-indicators.png)

Now when we know it's what we are looking for, let's figure out how it's built. To learn the implementation details I use Hopper Disassembler, even a free version will do fine for our purposes. This app helps to reduce the friction of reading disassembly (which I still know very basics of). All you need to do is to open a binary and find the method that interests you. After jumping to it, toggle the pseudo code at the top. It will generate a very readable mix of Objective-C, C++ and assembly.

![](/assets/2017-12-27/hopper.png)

1. We typed the the name of the class to see all the methods that were implemented
2. Over time you will build an intuition and will learn to spot "interesting" methods. It never hurts to start with public UIKit methods since Apple engineers use those, too. That's why I started with `-[SBHomeGrabberView initWithFrame:]`
3. Unless you are comfortable with reading assembly, switch to pseudo-code mode
4. Try to make as much sense as possible. Sometimes code is quite self-explanatory, sometimes you will find yourself in the dead end.

On a personal note, I find reading implementation details very interesting. I do it for "fun" sometimes, or when I want to understand certain behaviour better.

Back to our `SBHomeGrabberView`, we see that it's a rather thin wrapper (aside from various bookkeeping… oh hey `AWAttentionAwarenessConfiguration`, I'll need to revisit you later!), adds a `MTLumaDodgePillView` subview. Initially I thought it's defined in the Metal framework (mostly due to MTL prefix), but it seems a bit too specific to be defined in such a “low-level” framework as Metal. Also as Matthias pointed out on [twitter](https://twitter.com/myell0w/status/946304768783388673), the prefix of our class is actually `MT` and not `MTL` 🤦‍♂️.
Luckily, if you load a binary (such as SpringBoard) into your app, you also get access to all the libraries it loads subsequently. It makes finding the library defining the class  as easy as using `dladdr`:

```objc
const Class MTLumaDodgePillViewClass = NSClassFromString(@"MTLumaDodgePillView");
Dl_info dlInfo;
dladdr((__bridge void *)MTLumaDodgePillViewClass, &dlInfo);
dlInfo.dli_fname; // path to the binary defining the symbol (class in this case)
```

This code can be run as a part of the app I set up to investigate. You can also use `lldb`. Lesser known lldb-feature is being able to set up variables. The advantage of using lldb is that you don't have to recompile the app, the disadvantage is that lldb requires a bit more help with types since it doesn't have access to the header files, hence casting additional variable and function return types:

```
(lldb) e Dl_info $dlInfo
(lldb) e (void)dladdr((__bridge void *)NSClassFromString(@"MTLumaDodgePillView"), & $dlInfo);
(lldb) p $dlInfo.dli_fname
(const char *) $1 = 0x00006000001fd900 "/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/Library/CoreSimulator/Profiles/Runtimes/iOS.simruntime/Contents/Resources/RuntimeRoot/System/Library/PrivateFrameworks/MaterialKit.framework/MaterialKit"
```

As we can see, it's defined in `/System/Library/PrivateFrameworks/MaterialKit.framework/MaterialKit`

```objc
@class MTLumaDodgePillView;

@protocol MTLumaDodgePillBackgroundLuminanceObserver <NSObject>
- (void)lumaDodgePillDidDetectBackgroundLuminanceChange:(MTLumaDodgePillView *)arg1;
@end

@interface MTLumaDodgePillView : UIView
@property(nonatomic, weak) id <MTLumaDodgePillBackgroundLuminanceObserver> backgroundLumninanceObserver;
@property(nonatomic) MTLumaDodgePillViewStyle style;
@property(nonatomic, readonly) MTLumaDodgePillViewBackgroundLuminance backgroundLuminance;
@end
```

Few things to point out. To figure out possible values for `MTLumaDodgePillViewStyle` and `MTLumaDodgePillViewBackgroundLuminance`, it's enough to look into the description method. It converts integer values into strings, which we are going to use for the constants:

```objc
typedef NS_ENUM(NSInteger, MTLumaDodgePillViewStyle) {
 MTLumaDodgePillViewStyleNone = 0,
 MTLumaDodgePillViewStyleThin = 1,
 MTLumaDodgePillViewStyleGray = 2,
 MTLumaDodgePillViewStyleBlack = 3,
 MTLumaDodgePillViewStyleWhite = 4,
};

typedef NS_ENUM(NSInteger, MTLumaDodgePillViewBackgroundLuminance) {
 MTLumaDodgePillViewBackgroundLuminanceUnknown = 0,
 MTLumaDodgePillViewBackgroundLuminanceDark = 1,
 MTLumaDodgePillViewBackgroundLuminanceLight = 2,
};
```

Last interesting API is the `backgroundLumninanceObserver`, it will invoke the callback every time our view changed its appearance.

# Building our own `MTLumaDodgePillView`

While we are getting closer, `MTLumaDodgePillViewStyle` is just a wrapper of sort itself. Internally it is a private-class galore: It proxies calls to `CABackdropLayer` (private, iOS 7+), using a whole slew of `CAFilter`s (private, iOS 2+), including the one called `kCAFilterHomeAffordanceBase`.
`CABackdropLayer` is what's powering various blur effects since iOS 7 introduced them. In a nutshell it clones the view hierarchy behind the layer, and gathers statistics about the contents. Also any CALayer allows to apply QuartzCore filters to any layer. Cloning view hierarchy along with filters applied to it, allows to produce all variations effects provided by `UIVisualEffectView`. Let's take basic blur example:

```objc
UIBlurEffect *blur = [UIBlurEffect effectWithStyle:UIBlurEffectStyleLight];
UIVisualEffectView *blurView = [[UIVisualEffectView alloc] initWithEffect:blur];
```

To build it all we need is: Gaussian blur, saturation filter and a solid white color composed using source over blend mode. Here's a rough code for the filtering part:

```objc
CAFilter *const blur = [(id)NSClassFromString(@"CAFilter") filterWithType:kCAFilterGaussianBlur];
[blur setValue:@30 forKey:@"inputRadius"];
CAFilter *const saturate = [(id)NSClassFromString(@"CAFilter") filterWithType:kCAFilterColorSaturate];
[saturate setValue:@1.8 forKey:@"inputAmount"];
CABackdropLayer *backdrop = [NSClassFromString(@"CABackdropLayer") new];
backdrop.filters = @[ blur, saturate ];

CALayer *overlay = [CALayer new];
overlay.backgroundColor = [UIColor colorWithWhite:1 alpha:0.3].CGColor;
overlay.compositeFilter = [(id)NSClassFromString(@"CAFilter") filterWithType:kCAFilterSourceOver];

[layer addSublayer:backdrop];
[layer addSublayer:overlay];
```

# Putting it all together

Final touch is to open `-[MTLumaDodgePillView initWithFrame:]`. It shows the list of the filters MaterialKit creates in order to replicate the effect:

```objc
CAFilter *const blur = [(id)NSClassFromString(@"CAFilter") filterWithType:kCAFilterGaussianBlur];
CAFilter *const colorBrightness = [(id)NSClassFromString(@"CAFilter") filterWithType:kCAFilterColorBrightness];
CAFilter *const colorSaturate = [(id)NSClassFromString(@"CAFilter") filterWithType:kCAFilterColorSaturate];
```

To get the actual values for each filter we will pause using the view debugger, select one of our added views, copy the address from the view or layer section on the right

![](/assets/2017-12-27/view-debugger.png)

now in the console we can use the selected addresses as if they are the references to the views and layers themselves

```
(lldb) po 0x7fc81331a8a0
<MTLumaDodgePillView:0x7fc81331a8a0 frame={\{120.5, 107.5}, {134, 5}\} style=white backgroundLuminance=unknown>

(lldb) po ((CALayer *)0x600000226d60).filters
<__NSArrayI 0x60000005e450>(
homeAffordanceBase,
gaussianBlur,
colorBrightness,
colorSaturate
)

(lldb) po [((CALayer *)0x600000226d60).filters[0] valueForKey:@"inputAmount"]
1

(lldb) po [((CALayer *)0x600000226d60).filters[0] valueForKey:@"inputAddWhite"]
0.71
```

As you noticed we are casting types on the integers when we are calling properties on them, this is to help lldb to figure out the type of the object behind the pointer.

Repeating `valueForKey:` dance for every property we found mentioned in `-[MTLumaDodgePillView initWithFrame:]`. It is a bit tedious but I didn't want to look for the original styles definition file (assuming it comes from a plist somewhere). Once finished we can reconstruct the view using only QuartzCore:

```objc
CAFilter *const homeAffordanceBase = [(id)NSClassFromString(@"CAFilter") filterWithType:kCAFilterHomeAffordanceBase];
UIImage *const lumaDodgeMap = [UIImage imageNamed:@"lumaDodgePillMap" inBundle:[NSBundle bundleForClass:viewClass] compatibleWithTraitCollection:nil];
[homeAffordanceBase setValue:(__bridge id)lumaDodgeMap.CGImage forKey:@"inputColorMap"];
CAFilter *const blurFilter = [(id)NSClassFromString(@"CAFilter") filterWithType:kCAFilterGaussianBlur];
CAFilter *const colorBrightness = [(id)NSClassFromString(@"CAFilter") filterWithType:kCAFilterColorBrightness];
CAFilter *const colorSaturate = [(id)NSClassFromString(@"CAFilter") filterWithType:kCAFilterColorSaturate];

// MTLumaDodgePillViewStyleThin values
[homeAffordanceBase setValue:@0.31 forKey:@"inputAmount"];
[homeAffordanceBase setValue:@0.37275 forKey:@"inputAddWhite"];
[homeAffordanceBase setValue:@0.4 forKey:@"inputOverlayOpacity"];
[blurFilter setValue:@10 forKey:@"inputRadius"];
[blurFilter setValue:@YES forKey:@"inputHardEdges"];
[colorBrightness setValue:@0.06 forKey:@"inputAmount"];
[colorSaturate setValue:@1.15 forKey:@"inputAmount"];

CALayer *layer = [NSClassFromString(@"CABackdropLayer") new];
layer.frame = CGRectInset(self.view.bounds, 100, 100);
layer.filters = @[ homeAffordanceBase, blurFilter, colorSaturate, colorSaturate ];
layer.cornerRadius = 10;
[self.view.layer addSublayer:layer];
```

The mysterious home affordance base filter seems to use the passed `lumaDodgePullMap` image as to map the input image. Everything else seems to be fairly straight forward use of filters we saw in the implementation of `UIVisualEffectView`. That's all, we get our final result:

<video src="/assets/2017-12-27/final.mov" width="50%" autoplay controls loop></video>

# Afterword

Hope this article showed you reverse engineering as a far less magical endeavor than it appeared before; Objective-C with helps with abundance of the information retained in the binaries. It makes reverse engineering into a fun adventure!
Feel free to share your thoughts or ask questions on twitter [@zats](http://twitter.com/zats)

My thanks go to [@warpling](https://twitter.com/warpling), [@myell0w](https://twitter.com/myell0w), [@shaps](https://twitter.com/shaps) and others for suggestions on how to improve this post.

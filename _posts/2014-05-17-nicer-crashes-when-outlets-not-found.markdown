---
layout: post
title: "\"Nicer\" crash messages when IBOutlets are not found"
date: 2014-05-17
---

> \[\<ZTSViewController 0x8c46c60> setValue:forUndefinedKey:]: this class is not key value coding-compliant for the key textField.

We've probably seen similar exceptions when Interface Builder was involved in the process of app design. StackOverflow is [full of question](http://stackoverflow.com/search?q=setValue%3AforUndefinedKey%3A+this+class+is+not+key+value+coding-compliant+for+the+key) "what am I doing wrong?".

By now more advanced users probably guessed that I'm talking about UIKit trying to decode a storyboard (or a nib) and failing to find an appropriate outlet in the corresponding class. The way this technology works is not a trick: it uses KVC to establish connections. And, in cases I'm talking about, it fails to find an appropriate key. Most likely it's because someone renamed the control in the Interface Build and forgot to reflect the changes in code.

First, we need to establish who is throwing this exception. As we can see in the call stack, crash happening as a result of a default implementation of `-[NSObject(NSKeyValueCoding) setValue:forUndefinedKey:]` and just prior to that `-[UIRuntimeOutletConnection connect]` is probably trying to set a value for the missing key. It sounds like a case for method swizzling!

Sadly the class itself is not public, but fear not, as long as class registered with runtime, we can call `NSClassFromString` function to get a reference of a class. Then we just swizzle `connect` method with our implementation of a `zts_connect`:

```objective-c
- (void)zts_connect {
    @try {
        [self zts_connect];
    }
    @catch (NSException *exception) {
        if ([exception.name isEqualToString:NSUndefinedKeyException]) {
            NSString *label = [self valueForKey:@"label"];
            id source = [self valueForKey:@"source"];
            id destination = [self valueForKey:@"destination"];
            NSString *nicerDescription = [NSString stringWithFormat:@"Make sure you have an IBOutlet of type %@ called \"%@\" in %@", [destination class], label, source];
            exception = [NSException exceptionWithName:exception.name
                                           reason:nicerDescription
                                         userInfo:exception.userInfo];
        }
        @throw exception;
    }
}
```

In the code above, we call the original implementation (don't let the method names limbo trick you, read [NSHipster](http://nshipster.com/method-swizzling/) for more info) and check if exception thrown (if any) has a name equal to `NSUnknownKeyException`. Here we go on a stretch and assume that any exception of this type thrown during this method call is due to missing outlet. Next, we just re-throw this exception, now instead of a "cryptic" message we get

> Make sure you have an IBOutlet of type UIButton called "button" in \<ZTSViewController: 0x8c46c60>

Now it's important to keep in mind that you want to keep this code wrapped in `#ifdef DEBUG` since it mentions a private class and alters the core behavior of UIKit. Most importantly the issue we're trying to solve is a pure development-time issue, therefore this code does not belong to production by any stretch.

Is there a simpler solution? Of course:) Sadly it is as not production safe as the first one, but a simpler one. Just override `setValue:forUndefinedKey:` in a category of `UIViewController`!

```objective-c
#ifdef DEBUG
@implementation UIViewController (NicerStoryboardCrashes)

- (void)setValue:(id)value forUndefinedKey:(NSString *)key {
    NSString *nicerDescription = [NSString stringWithFormat:@"Make sure you have an IBOutlet of type %@ called \"%@\" in %@", [value class], key, self];
    @throw [NSException exceptionWithName:NSUndefinedKeyException
                                   reason:nicerDescription
                                 userInfo:nil];
}

@end
#endif
```

As I mentioned before, this solution is not a production grade because in this case we generalize too much: assuming that any undefined key coming our way was caused by storyboard outlet mismatch, which is wrong.

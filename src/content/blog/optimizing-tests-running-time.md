---
title: "Optimizing tests running time"
description: "In our app we run a mix of unit, functional and integration tests, for example: Credit card validator is a unit test. Tapping menu items takes you to the right section is a functional test. Tapping a product, adding it to cart and going through all of the purchase steps is an integration test."
pubDate: 2014-12-19
draft: false
---

In our app we run a mix of unit, functional and integration tests, for example:

* Credit card validator is a unit test.
* Tapping menu items takes you to the right section is a functional test.
* Tapping a product, adding it to cart and going through all of the purchase steps is an integration test.

While it's widely acceptable to stub and mock for unit and functional tests, it's not such a good idea for integration tests. Our previous setup included 3 different test targets one per test type, so you're free to setup environment in a way that makes sense for a particular groups of tests. However it caused long build times and as a result, our CI machine was constantly busy building client, increasing latency between, let's say, a pool request being submitted and confirmation that it's safe to merge PR.

# Optimization: merging test targets.

I decided to try out a different approach: to merge all the test targets into one. As a result we got faster build times: no need in building 3 targets, no need in restarting app (or simulator). Of course, you have to be more careful with stubs now. It's not enough to just stub all the networking calls and leave stubs in place, you should carefully remove them once your test finished running.

There is another detail that added a complexity with this new approach. On the startup our app loads certain information while displaying a modal splash screen. This is not an ideal approach, but until it's addressed, we have to work around with it. Integration tests use to wait for the absence of splash screen (using [KIF](https://github.com/kif-framework/KIF)) before tapping around. Obviously, this solution worked because all the integration tests would be isolated into a separate target. Once all targets were merged, that caused an undesirable delay, affecting both unit and functional tests that do not need app to start in its "natural" way.

# Rearranging tests.

So who is in charge of running all the tests? XCTest is not the most documented framework, so [Hopper Disassembler](http://www.hopperapp.com) to the rescue! After poking around a bit, I learned, that `+[XCTestSuite defaultTestSuite]` is the method called to get the list of the tests. It returns a test suite containing all test targets with all tests enabled in the scheme configuration. Funny enough, in this case, all the knowledge turned out to be public: `tests` array contains all the tests and is backed by a `NSMutableArray *_tests` ivar.

# Solution.

By simply swizzling `defaultTestSuite` and sorting `tests` property to contain unit and functional tests at the beginning is enough to prioritize the tests that do not depend on the app state:

```objc
XCTestSuite *defaultTestSuite = ((XCTestSuite *(*)(id))originalImp)(self);
for (XCTestSuite *testSuite in defaultTestSuite.tests) {
    NSMutableArray *allTestsArray = [testSuite valueForKey:@"_tests"];
    [allTestsArray sortUsingComparator:^NSComparisonResult(XCTestSuite *test1, XCTestSuite *test2) {
        BOOL isTest1UnitTest = test1.wml_isUnitTest;
        BOOL isTest2UnitTest = test2.wml_isUnitTest;
        if (isTest1UnitTest && !isTest2UnitTest) {
            return NSOrderedAscending;
        } else if (!isTest1UnitTest && isTest2UnitTest) {
            return NSOrderedDescending;
        }
        return NSOrderedSame;
    }];
}
return defaultTestSuite;
```

`-[XCTestSuite wml_isUnitTest]` is simply looking for a word `UnitTest` in the class name. Convention over configuration.

**Update**: as it was pointed out, it's quite easy to optimize the implementation and find a better point of swizzling. This is just a first implementation.

Without violating principle of tests not depending on one another, we gained a speed boost that will only increase as we grow number of tests.
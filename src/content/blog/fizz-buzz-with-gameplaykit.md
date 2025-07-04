---
title: "Fizz Buzz with GameplayKit"
description: "A great idea found at knowing.net and backported to swift."
pubDate: 2015-08-15
draft: false
---

A great idea found at [knowing.net](http://www.knowing.net/index.php/2015/08/04/fizzbuzz-with-ios-9-gameplaykit-expert-system-in-c-with-xam-ios) and backported to swift.

[Fizz buzz](https://en.wikipedia.org/wiki/Fizz_buzz) is a simple game and GameplayKit API making it equally simple to describe the rules. Untyped state dictionary can definitely use some "swiftification", but overall, code is quite simple. Here it is:

```
import Cocoa
import GameplayKit

let fizzRule = GKRule(blockPredicate: { system in
    (system.state["value"] as! Int) % 3 == 0
}, action: { system in
    system.state["output"] = "fizz"
})
fizzRule.salience = 1;

let buzzRule = GKRule(blockPredicate: { system in
    return (system.state["value"] as! Int) % 5 == 0
}, action: { system in
    if let out = system.state["output"] as? String {
        system.state["output"] = "\(out) buzz"
    } else {
        system.state["output"] = "buzz"
    }
})
buzzRule.salience = 2;

let printRule = GKRule(blockPredicate: { system in
    let value = system.state["value"] as! Int
    return (value % 5 != 0) && (value % 3 != 0)
}, action: { system in
    let value = system.state["value"] as! Int
    system.state["output"] = "\(value)"
})
printRule.salience = 0

let ruleSystem = GKRuleSystem()
ruleSystem.addRule(fizzRule)
ruleSystem.addRule(buzzRule)
ruleSystem.addRule(printRule)

for i in 1...100 {
    ruleSystem.state["value"] = Int(i)
    ruleSystem.state["output"] = nil
    ruleSystem.evaluate()
    print(ruleSystem.state["output"]!)
    ruleSystem.reset()
}
```

Output is

```
1
2
fizz 
4
buzz
...
```

I'm looking forward to seeing gaming and not only frameworks emerging on top of GameplayKit! Foundation is very promising.
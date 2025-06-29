---
title: "Markov Chains with GameplayKit"
description: "GameplayKit hides many amazing features: a random number generators, components architecture, path finding, state machines and more. Markov chains is another ingenious gem that can be utilised by games or apps to simulate natural patterns."
pubDate: "Aug 29 2015"
---

GameplayKit hides many amazing features: a random number generators, components architecture, path finding, state machines and more. [Markov chains](http://setosa.io/blog/2014/07/26/markov-chains/) is another ingenious gem that can be utilised by games or apps to simulate natural patterns. It has plenty of [useful applications](https://en.wikipedia.org/wiki/Markov_chain#Applications). 
Since Markov chains [can be represented](http://stackoverflow.com/questions/4880286/is-a-markov-chain-the-same-as-a-finite-state-machine) by a finite state machine, it seems logical to implement it using `GKStateMachine` from GampelayKit. 

Basically, it is an autopilot combined with `GKStateMachine`. As a result, API for `MarkovChainMachine` is less hands on. All you need is to set its initial state and it will tell you which state should be next. Here is an example:

```swift
let m = MarkovChainMachine(initialStates: [a, b], mapping: [
    [a, b]: [
        [0.3: a],
        [0.7: b]
    ],
    [b, a]: [
        [0.7: a],
        [0.3: b]
    ],
    [a, a]: [
        [0.1: a],
        [0.9: b]
    ],
    [b, b]: [
        [0.9: a],
        [0.1: b]
    ]
])

for _ in 0...15 {
    if m.enterNextState() {
        print(m.currentState!, separator: "", terminator: " ")
    }
}
```

Given, we have 2 states `a` and `b`, and following rules:

* `a b` is likely to be followed by `b`
* `b a` is likely to be followed by `a`
* `a a` is almost definitely to be followed by `b`
* `b b` is almost definitely to be followed by `a`

Running the code will yield results similar to `A B B A B B A A B A A B A A B B A A `

Several architectural notes:

* I decided to opt out from custom structure representing a probable outcome to make it easier to compose mapping of current state to to possible outcomes.
* `MarkovChainMachine` expects mapping keys to be of the same length as `initialState` array. It uses the `initialState` length to deduce the lookbehind size.
* When working with free text, it is possible to come to the terminal state. Although it is not taken care of here, it is quite easy to workaround be adding a missing state transition to one of the registered states.
* The downside of piggybacking on GameplayKit is that each state must be a separate class. This architectural decision felt strange when I was researching GameplayKit here it might pose certain challenges.

Last limitation is quite annoying when dealing with unknown data set. I worked around using dynamic class generation, a neat feature of Objective-C runtime. When processing free text, I create a dynamic subclass of `GKState`, e.g. `State_J` or `State_i`. Later I can use these classes to enter the appropriate state.

The project is quite an experiment: no tests and just 2 examples. It can be found at Github https://github.com/NSFWObject/MarkovChains
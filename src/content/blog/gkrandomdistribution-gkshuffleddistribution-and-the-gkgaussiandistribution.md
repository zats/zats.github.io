---
title: "GKRandomDistribution, GKShuffledDistribution and the GKGaussianDistribution"
description: "GameplayKit brings random numbers generation among other useful things. So what's the difference between GKRandomDistribution, GKGaussianDistribution and GKShuffledDistribution?"
pubDate: 2015-08-15
draft: false
heroImage: "/assets/2015-08-15/random.png"
---

GameplayKit brings random numbers generation among other useful things. So what's the difference between `GKRandomDistribution`, `GKGaussianDistribution` and `GKShuffledDistribution`? 
As the name suggests, `GKShuffledDistribution` is useful for when you want to simulate card deck behaviour. Pulling a random card one after another. Until you go through entire deck, there is no way you will see the same card twice (putting magic tricks aside).
`GKGaussianDistribution` is targeting problem of generating random numbers around the center of the range (2 in the example below). Here is a little sample, illustrating the differences:

```
import Cocoa
import GameplayKit

let randoms = NSCountedSet()
let shuffles = NSCountedSet()
let gausians = NSCountedSet()

let randomD3 = GKRandomDistribution(lowestValue: 1, highestValue: 3)
let shuffledD3 = GKShuffledDistribution(lowestValue: 1, highestValue: 3)
let gausianD3 = GKGaussianDistribution(lowestValue: 1, highestValue: 3)
for i in 0..<30 {
    randoms.addObject(randomD3.nextInt())
    shuffles.addObject(shuffledD3.nextInt())
    gausians.addObject(gausianD3.nextInt())
}

print("Random:")
randoms.forEach{
    print("\($0) \(randoms.countForObject($0))")
}

print("Shuffled:")
shuffles.forEach{
    print("\($0) \(shuffles.countForObject($0))")
}

print("Gausian:")
gausians.forEach{
    print("\($0) \(gausians.countForObject($0))")
}
```

Here is the output it produces:

```
Random:
1 14
2 11
3 5

Shuffled:
1 10
2 10
3 10

Gausian:
1 2
3 2
2 26
```

And a visual version:

<img src="/assets/2015-08-15/random.png" alt="Random distribution visualization" />

Although `GKRandomDistribution` instance produces equally distributed random numbers, it can result in so called "lucky streaks" - getting same value several times in a row. That's exactly when you want to use `GKShuffledDistribution`. As for `GKGaussianDistribution`, it targets cases when you need to generate random numbers around center, not getting too close to the upper and lower bounds (1 and 3 in our example). 

Very welcomed additions to Cocoa family.

Where to go from here: http://ericasadun.com/?s=GameplayKit
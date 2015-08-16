---
layout: post
title: GKShuffledDistribution
categories: []
tags: []
published: True

---

GameplayKit brings random numbers generation among other useful things. So what's the difference between `GKRandomDistribution` and `GKShuffledDistribution`? As the name suggests, latter is useful for when you want to simulate card deck behaviour. Pulling a random card one after another. Until you go through entire deck, there is no way you will see the same card twice (putting magic tricks aside). 
This exact behaviour is modelled by `GKShuffledDistribution`. To illustrate it, here is a bit of code:

{% gist zats/b8d9da7effd89b0e5400 %}

and here is the output:

```
Random:
3 1
1 3
2 2

Shuffled:
3 2
1 2
2 2
```

Although `GKRandomDistribution` instance produces equally distributed random numbers, it can result in so called "lucky strikes" - getting same value several times in a row. That's exactly when you want to use `GKShuffledDistribution`. Very nice addition.
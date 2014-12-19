---
layout: post
title:  "NSDate is a model not a view"
date: 2014-04-12
---

Following code `[[NSDate date] dateByAddingTimeInterval:60 * 60]` is a really common attempt to get the current time in, let's say, France. Despite developer's expectations, it does not represent current time in GMT+1 time zone. So where is all the confusion coming from?

Let's execute `po [NSDate date]` in Xcode console. What are we seeing?

Not `1395089079` but `2014-03-17 20:53:28 +0000`. Quick look in Xcode doesn't make it clearer: `NSDate *date = [NSDate date];` is presented as `2014-03-17 22:53:28 IST` (It shows the date as it appears in the developer's time zone). I believe, this is what trips people up.

In MVC sense of things, you have an `NSDate` object representing a model. It is agnostic to the concept of time zone or particular localization. Then, you have a group of APIs dealing with displaying or parsing dates and performing calculations on them: `NSCalendar`, `NSDateComponent`, `NSDateFormetter` etc. Those are your "views".

Just as you wouldn't store view in your database, don't store or pass around serialized dates, use NSDate instead – in the end of the day that's why it exists, to provide a good abstraction of a unix timestamp, decoupled from the way you present it to the user.

To summarize, as soon as you received a date from web API, parse it to `NSDate`. Or, if API utilizes unix timestamps, use `[NSDate dateWithTimeIntervalSince1970:]`, just keep in mind that it expects seconds. Just before presentation to the user, render the date object into the human readable (meaning localized, time zone aware) string.

## Where to go from here

[Apple documentation](https://developer.apple.com/library/ios/documentation/Cocoa/Conceptual/DatesAndTimes/Articles/dtCalendars.html) is a great place to start

WWDC sessions if you have enough time:

* 2013 session 227: Solutions to Common Date and Time Challenges
* 2012 session 212: Internationalization Tips and Tricks
* 2011 session 117: Performing Calendar Calculations

Finish with NSHipster on [`NSDateComponents`](http://nshipster.com/nsdatecomponents/), [`NSFormatter`](http://nshipster.com/nsformatter/) and [`NSLocale`](http://nshipster.com/nslocale/)

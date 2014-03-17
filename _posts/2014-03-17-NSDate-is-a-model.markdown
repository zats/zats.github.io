---
layout: post
title:  "NSDate is a model not a view"
---

Following code `[[NSDate date] dateByAddingTimeInterval:3 * 60 * 60]` is a really common attempt to offset current date by 3 hours from GMT.  Despite developer's expectations, this date does not represent current time in GMT+3 time zone. So why is all the confusion?

Let's execute `po [NSDate date]` in Xcode console. What are we seeing?

Not `1395089079` but `2014-03-17 20:53:28 +0000`. Quick look in Xcode doesn't make it easier: `NSDate *date = [NSDate date];` is presented as `2014-03-17 22:53:28 IST`. Which is even worse, it shows the time zone of the developer. I believe, this is what trips people up.

In MVC sense of things, you have an `NSDate` object that is your model. It is agnostic to the concept of `NSTimeZone`. Then you have a group of APIs dealing with time zones: `NSCalendar`, `NSDateComponent`, `NSDateFormetter` etc. Those are your views: they perform calculation or "render" date into a certain presentation using specified calendar, time zone, locale etc.

To summarize, as soon as you received a date from web API, parse it to `NSDate`. Or, if API utilizes unix timestamps, use `[NSDate dateWithTimeIntervalSince1970:]`, just keep in mind that it expects seconds. Just before presentation to the user, render the date object into the human readable (meaning localized, time zone aware) string.

## Where to go from here

[Apple documentation](https://developer.apple.com/library/ios/documentation/Cocoa/Conceptual/DatesAndTimes/Articles/dtCalendars.html) is a great place to start

WWDC sessions if you have enough time:

* 2013 session 227: Solutions to Common Date and Time Challenges
* 2012 session 212: Internationalization Tips and Tricks
* 2011 session 117: Performing Calendar Calculations

Finish with NSHipster on [`NSDateComponents`](http://nshipster.com/nsdatecomponents/), [`NSFormatter`](http://nshipster.com/nsformatter/) and [`NSLocale`](http://nshipster.com/nslocale/)

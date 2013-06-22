loadtest
========

Runs a load test on the selected URL or websocket. Easy to extend minimally for your own ends.

Installation
------------

Usage
-----

Run as a script to load test a URL:
  $ node loadtest.js [URL] or [websocket URL]

To get online help run without parameters:
  $ node loadtest.js

### Advanced Usage

Add your own values for concurrency, requests per second and seconds measured:
  $ node loadtest.js [concurrency [request per second [seconds measured]]] ...

## Concurrency

loadtest will create a simultaneous number of clients.

## Requests Per Second

Controls the number of requests per second for each client.

## Seconds Measured

How many seconds must be measured before showing the default latency.

License
-------

(The MIT License)

Copyright (c) 2013 Alex Fernández <alexfernandeznpm@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


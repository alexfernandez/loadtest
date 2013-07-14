# loadtest

Runs a load test on the selected HTTP or websocket URL. The API allows for easy integration in your own tests.

Why use loadtest instead of any other of the available tools, notably Apache ab?
loadtest allows you to configure and tweak requests, and simulate real world loads.
E.g. you can create 1000 clients and have them send 5 requests per second each.

Also, you can integrate loadtest with your package and run programmatic load tests.
You might want to run some load tests as part of your systems test, before deploying your software.
loadtest gives you mean response times and percentiles, so that you can abort deployment if 99% of the requests don't finish in 10 ms or less.

## Installation

Install globally as root:
    # npm install -g loadtest

On Ubuntu or Mac OS X systems install using sudo:
    $ sudo install -g loadtest

For programmatic access, install locally or add package loadtest to your package.json dependencies.

## Usage

Run as a script to load test a URL:

    $ loadtest [-n requests] [-c concurrency] [URL]

The URL can be "http://" or "ws://" for websockets. (Note: websockets are not  working at the moment, patches welcome.) Set the max number of requests with -n, and the desired level of concurrency with the -c parameter.

Single-dash parameters (e.g. -n) are designed to be compatible with Apache's ab.
  http://httpd.apache.org/docs/2.2/programs/ab.html

To get online help, run loadtest without parameters:

    $ loadtest

### Advanced Usage

Add your own values for concurrency and requests per second:

    $ loadtest [-n requests] [-c concurrency] ...

The following parameters are available.

#### -n requests

Number of requests to send out.

#### -c concurrency

loadtest will create a simultaneous number of clients; this parameter controls how many.

#### -t timelimit

Number of seconds to wait until requests no longer go out. (Note: this is different than Apache's ab, which stops _receiving_ requests after the given seconds.)

#### --rps requestsPerSecond

Controls the number of requests per second for each client. Can be fractional, e.g. --rps 0.5 sends one request every two seconds per client.

(Note: this parameter is not present in Apache's ab.)

#### --agent

Open connections using keep-alive: send header 'Connection: Keep-alive' instead of 'Connection: Close'.

(Warning: uses the default node.js agent, which means there is a limit in outgoing connections.)
(Note: this parameter is not present in Apache's ab.)

### Server

loadtest bundles a test server. To run it:

    $ testserver [--delay ms] [port]

It will show the number of requests received per second, the latency in answering requests and the headers for selected requests.

This server returns a short text 'OK' for every request, removing request processing from latency measurements.

The optional delay instructs the server to wait for the given number of milliseconds before answering each request, to simulate a busy server.

## API

loadtest is not limited to running from the command line; it can be controlled using an API, thus allowing you to load test your application in your own tests.

### Invoke Load Test

To run a load test use the exported function loadTest() passing it a set of options and an optional callback:

    var loadtest = require('loadtest');
    var options = {
        url: 'http://localhost:8000',
        maxRequests: 1000,
    };
    loadtest.loadTest(options, function(error, result)
    {
        if (error)
        {
            return console.error('Got an error: %s', error);
        }
        console.log('Tests run successfully');
    });

The callback(error, result) will be invoked when the max number of requests is reached, or when the number of seconds has elapsed.

### Options

This is the set of available options. Except where noted, all options are (as their name implies) optional.

#### url

The URL to invoke.

#### concurrency

How many clients to start in parallel.

#### requestsPerSecond

How many requests each client will send per second.

#### maxRequests

A max number of requests; after they are reached the test will end.

### Results

The results passed to your callback at the end of the load test contains a full set of data, including: mean latency, and percentiles.
An example follows:

    {
      totalRequests: 1000,
      percentiles: {
        '50': 7,
        '90': 10,
        '95': 11,
        '99': 15
      },
      rps: 2824,
      totalTimeSeconds: 0.354108,
      meanLatencyMs: 7.72
    }

### Start Test Server

To start the test server use the exported function startServer() with a set of options and an optional callback:

    var testserver = require('testserver');
    var server = testserver.startServer({ port: 8000 });

This function returns an HTTP server which can be close()d when it is no longer useful.

The following options are available.

#### port

The port to use for the server. Note: the default port 80 requires special privileges.

#### delay

Wait the given number of milliseconds to answer each request.

### Complete Sample

The file lib/sample.js shows a complete sample, which is also an integration test: it starts the server, send 1000 requests, waits for the callback and closes down the server.

## License

(The MIT License)

Copyright (c) 2013 Alex Fernández <alexfernandeznpm@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


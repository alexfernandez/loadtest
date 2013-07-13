# loadtest

Runs a load test on the selected HTTP or websocket URL. The API allows for easy integration in your own tests.

## Installation

Install globally as root:
    # npm install -g loadtest

On Ubuntu or Mac OS X systems install using sudo:
    $ sudo install -g loadtest

For programmatic access, install locally or add package loadtest to your package.json dependencies.

## Usage

Run as a script to load test a URL:

    $ loadtest [-c concurrency] [URL]

The URL can be "http://" or "ws://" for websockets. (Note: websockets are not  working at the moment, patches welcome.) Set the desired level of concurrency with the -c parameter.

To get online help, run loadtest without parameters:

    $ loadtest

### Advanced Usage

Add your own values for concurrency and requests per second:

    $ loadtest [-n requests] [-c concurrency] ...

#### Concurrency

loadtest will create a simultaneous number of clients; this parameter controls how many.

#### Requests Per Second

Controls the number of requests per second for each client.

#### --noagent

Open connections without keep-alive: send header 'Connection: Close' instead of 'Connection: Keep-alive'.

### Server

loadtest bundles a test server. To run it:

    $ testserver [port]

It will show the number of requests received per second, the latency in answering requests and the headers for selected requests.

This server returns a short text 'OK' for every request, removing request processing from latency measurements.

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

The callback will be invoked when the max number of requests is reached, or when the number of seconds has elapsed. Options are:

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

### Start Test Server

To start the test server use the exported function startServer() with a port and an optional callback:

    var testserver = require('testserver');
    testserver.startServer(8000);

### Complete Sample

The file lib/sample.js shows a complete sample, which is also an integration test: it starts the server, send 1000 requests, waits for the callback and closes down the server.

## License

(The MIT License)

Copyright (c) 2013 Alex Fernández <alexfernandeznpm@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


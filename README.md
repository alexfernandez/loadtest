[![Build Status](https://secure.travis-ci.org/alexfernandez/loadtest.svg)](http://travis-ci.org/alexfernandez/loadtest)
[![run on repl.it](http://repl.it/badge/github/alexfernandez/loadtest)](https://repl.it/github/alexfernandez/loadtest)

[![NPM](https://nodei.co/npm/loadtest.png?downloads=true)](https://nodei.co/npm/loadtest/)

[![Package quality](http://packagequality.com/badge/loadtest.png)](http://packagequality.com/#?package=loadtest)

# loadtest

Runs a load test on the selected HTTP or WebSockets URL. The API allows for easy integration in your own tests.

## Installation

Install globally as root:

    # npm install -g loadtest

On Ubuntu or Mac OS X systems install using sudo:

    $ sudo npm install -g loadtest

For access to the API just add package `loadtest` to your `package.json` devDependencies:

```json
{
	...
	"devDependencies": {
		"loadtest": "*"
	},
	...
}
```

### Compatibility

Versions 5 and later should be used at least with Node.js v10 or later:

* Node.js v10 or later: ^5.0.0
* Node.js v8 or later: 4.x.y.
* Node.js v6 or earlier: ^3.1.0.

## Usage

Why use `loadtest` instead of any other of the available tools, notably Apache `ab`?
`loadtest` allows you to configure and tweak requests to simulate real world loads.

### Basic Usage

Run as a script to load test a URL:

    $ loadtest [-n requests] [-c concurrency] [-k] URL

The URL can be "http://", "https://" or "ws://".
Set the max number of requests with `-n`, and the desired level of concurrency with the `-c` parameter.
Use keep-alive connections with `-k` whenever it makes sense,
which should be always except when you are testing opening and closing connections.

Single-dash parameters (e.g. `-n`) are designed to be compatible with
[Apache `ab`](http://httpd.apache.org/docs/2.2/programs/ab.html),
except that here you can add the parameters _after_ the URL.

To get online help, run loadtest without parameters:

    $ loadtest

### Usage Dos

The set of basic options are designed to be compatible with Apache `ab`.
But while `ab` can only set a concurrency level and lets the server adjust to it,
`loadtest` allows you to set a rate or requests per second with the `--rps` option.
Example:

    loadtest -c 10 --rps 200 http://mysite.com/

This command sends exactly 200 requests per second with concurrency 10,
so you can see how your server copes with sustained rps.
Even if `ab` reported a rate of 200 rps,
you will be surprised to see how a constant rate of requests per second affects performance:
no longer are the requests adjusted to the server, but the server must adjust to the requests!
Rps rates are usually lowered dramatically, at least 20~25% (in our example from 200 to 150 rps),
but the resulting figure is much more robust.

`loadtest` is also quite extensible.
Using the provided API it is very easy to integrate loadtest with your package, and run programmatic load tests.
loadtest makes it very easy to run load tests as part of systems tests, before deploying a new version of your software.
The results include mean response times and percentiles,
so that you can abort deployment e.g. if 99% of the requests don't finish in 10 ms or less.

### Usage Don'ts

`loadtest` saturates a single CPU pretty quickly.
Do not use `loadtest` if the Node.js process is above 100% usage in `top`, which happens approx. when your load is above 1000~4000 rps.
(You can measure the practical limits of `loadtest` on your specific test machines by running it against a simple
Apache or nginx process and seeing when it reaches 100% CPU.)

There are better tools for that use case:

* [Apache `ab`](http://httpd.apache.org/docs/2.2/programs/ab.html)
has great performance, but it is also limited by a single CPU performance.
Its practical limit is somewhere around ~40 krps.
* [weighttp](http://redmine.lighttpd.net/projects/weighttp/wiki) is also `ab`-compatible
and is supposed to be very fast (the author has not personally used it).
* [wrk](https://github.com/wg/wrk) is multithreaded and fit for use when multiple CPUs are required or available.
It may need installing from source though, and its interface is not `ab`-compatible.

### Regular Usage

The following parameters are compatible with Apache ab.

#### `-n requests`

Number of requests to send out.

Note: the total number of requests sent can be bigger than the parameter if there is a concurrency parameter;
loadtest will report just the first `n`.

#### `-c concurrency`

loadtest will create a certain number of clients; this parameter controls how many.
Requests from them will arrive concurrently to the server.

Note: requests are not sent in parallel (from different processes),
but concurrently (a second request may be sent before the first has been answered).

#### `-t timelimit`

Max number of seconds to wait until requests no longer go out.

Note: this is different than Apache `ab`, which stops _receiving_ requests after the given seconds.

#### `-k` or `--keepalive`

Open connections using keep-alive: use header 'Connection: Keep-alive' instead of 'Connection: Close'.

Note: Uses [agentkeepalive](https://npmjs.org/package/agentkeepalive),
which performs better than the default node.js agent.

#### `-C cookie-name=value`

Send a cookie with the request. The cookie `name=value` is then sent to the server.
This parameter can be repeated as many times as needed.

#### `-H header:value`

Send a custom header with the request. The line `header:value` is then sent to the server.
This parameter can be repeated as many times as needed.
Example:

    $ loadtest -H user-agent:tester/0.4 ...

Note: if not present, loadtest will add a few headers on its own: the "host" header parsed from the URL,
a custom user agent "loadtest/" plus version (`loadtest/1.1.0`), and an accept header for "\*/\*".

Note: when the same header is sent several times, only the last value will be considered.
If you want to send multiple values with a header, separate them with semicolons:

    $ loadtest -H accept:text/plain;text-html ...

Note: if you need to add a header with spaces, be sure to surround both header and value with quotes:

    $ loadtest -H "Authorization: Basic xxx=="

#### `-T content-type`

Set the MIME content type for POST data. Default: `text/plain`.

#### `-P POST-body`

Send the string as the POST body. E.g.: `-P '{"key": "a9acf03f"}'`

#### `-A PATCH-body`

Send the string as the PATCH body. E.g.: `-A '{"key": "a9acf03f"}'`

#### `-m method`

Send method to link. Accept: [GET, POST, PUT, DELETE, PATCH, get, post, put, delete, patch], Default is GET
E.g.: -m POST

#### `--data POST some variables`

Send some data. It does not support method GET.
E.g: `--data '{"username": "test", "password": "test"}' -T 'application/x-www-form-urlencoded' -m POST`

It required `-m` and `-T 'application/x-www-form-urlencoded'`

#### `-p POST-file`

Send the data contained in the given file in the POST body.
Remember to set `-T` to the correct content-type.

If `POST-file` has `.js` extension it will be `require`d. It should be a valid node module and it
should `export` a single function, which is invoked with an automatically generated request identifier
to provide the body of each request.
This is useful if you want to generate request bodies dynamically and vary them for each request.

Example:

```javascript
module.exports = function(requestId) {
  // this object will be serialized to JSON and sent in the body of the request
  return {
	key: 'value',
	requestId: requestId
  };
};
```

#### `-u PUT-file`

Send the data contained in the given file as a PUT request.
Remember to set `-T` to the correct content-type.

If `PUT-file` has `.js` extension it will be `require`d. It should be a valid node module and it
should `export` a single function, which is invoked with an automatically generated request identifier
to provide the body of each request.
This is useful if you want to generate request bodies dynamically and vary them for each request.
For an example function see above for `-p`.

#### `-a PATCH-file`

Send the data contained in the given file as a PATCH request.
Remember to set `-T` to the correct content-type.

If `PATCH-file` has `.js` extension it will be `require`d. It should be a valid node module and it
should `export` a single function, which is invoked with an automatically generated request identifier
to provide the body of each request.
This is useful if you want to generate request bodies dynamically and vary them for each request.
For an example function see above for `-p`.

##### `-r`

Recover from errors. Always active: loadtest does not stop on errors.
After the tests are finished, if there were errors a report with all error codes will be shown.

#### `-s`

The TLS/SSL method to use. (e.g. TLSv1_method)

Example:

    $ loadtest -n 1000 -s TLSv1_method https://www.example.com

#### `-V`

Show version number and exit.

### Advanced Usage

The following parameters are _not_ compatible with Apache ab.

#### `--rps requestsPerSecond`

Controls the number of requests per second that are sent.
Can be fractional, e.g. `--rps 0.5` sends one request every two seconds.

Note: Concurrency doesn't affect the final number of requests per second,
since rps will be shared by all the clients. E.g.:

    loadtest <url> -c 10 --rps 10

will send a total of 10 rps to the given URL, from 10 different clients
(each client will send 1 request per second).

Beware: if concurrency is too low then it is possible that there will not be enough clients
to send all of the rps, adjust it with `-c` if needed.

Note: --rps is not supported for websockets.

#### `--timeout milliseconds`

Timeout for each generated request in milliseconds.
Setting this to 0 disables timeout (default).

#### `-R requestGeneratorModule.js`

Use custom request generator function from an external file.

Example request generator module could look like this:

```javascript
module.exports = function(params, options, client, callback) {
  generateMessageAsync(function(message) {

    if (message)
    {
      options.headers['Content-Length'] = message.length;
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    request = client(options, callback);
    if (message){
      request.write(message);
    }

    return request;
  }
}
```

See [`sample/request-generator.js`](sample/request-generator.js) for some sample code including a body
(or [`sample/request-generator.ts`](sample/request-generator.ts) for ES6/TypeScript).

#### `--agent` (deprecated)

Open connections using keep-alive.

Note: instead of using the default agent, this option is now an alias for `-k`.

#### `--quiet`

Do not show any messages.

#### `--debug`

Show debug messages.

#### `--insecure`

Allow invalid and self-signed certificates over https.

#### `--cert path/to/cert.pem`

Sets the certificate for the http client to use. Must be used with `--key`.

#### `--key path/to/key.pem`

Sets the key for the http client to use. Must be used with `--cert`.

### Server

loadtest bundles a test server. To run it:

    $ testserver-loadtest [--delay ms] [error 5xx] [percent yy] [port]

This command will show the number of requests received per second,
the latency in answering requests and the headers for selected requests.

The server returns a short text 'OK' for every request,
so that latency measurements don't have to take into account request processing.

If no port is given then default port 7357 will be used.
The optional delay instructs the server to wait for the given number of milliseconds
before answering each request, to simulate a busy server.
You can also simulate errors on a given percent of requests.

### Complete Example

Let us now see how to measure the performance of the test server.

First we install `loadtest` globally:

    $ sudo npm install -g loadtest

Now we start the test server:

    $ testserver-loadtest
    Listening on port 7357

On a different console window we run a load test against it for 20 seconds
with concurrency 10 (only relevant results are shown):

    $ loadtest http://localhost:7357/ -t 20 -c 10
    ...
    Requests: 9589, requests per second: 1915, mean latency: 10 ms
    Requests: 16375, requests per second: 1359, mean latency: 10 ms
    Requests: 16375, requests per second: 0, mean latency: 0 ms
    ...
    Completed requests:  16376
    Requests per second: 368
    Total time:          44.503181166000005 s

    Percentage of the requests served within a certain time
      50%      4 ms
      90%      5 ms
      95%      6 ms
      99%      14 ms
     100%      35997 ms (longest request)

Results were quite erratic, with some requests taking up to 36 seconds;
this suggests that Node.js is queueing some requests for a long time, and answering them irregularly.
Now we will try a fixed rate of 1000 rps:

    $ loadtest http://localhost:7357/ -t 20 -c 10 --rps 1000
    ...
    Requests: 4551, requests per second: 910, mean latency: 0 ms
    Requests: 9546, requests per second: 1000, mean latency: 0 ms
    Requests: 14549, requests per second: 1000, mean latency: 20 ms
    ...
    Percentage of the requests served within a certain time
      50%      1 ms
      90%      2 ms
      95%      8 ms
      99%      133 ms
     100%      1246 ms (longest request)

Again erratic results. In fact if we leave the test running for 50 seconds we start seeing errors:

    $ loadtest http://localhost:7357/ -t 50 -c 10 --rps 1000
    ...
    Requests: 29212, requests per second: 496, mean latency: 14500 ms
    Errors: 426, accumulated errors: 428, 1.5% of total requests

Let us lower the rate to 500 rps:

    $ loadtest http://localhost:7357/ -t 20 -c 10 --rps 500
    ...
    Requests: 0, requests per second: 0, mean latency: 0 ms
    Requests: 2258, requests per second: 452, mean latency: 0 ms
    Requests: 4757, requests per second: 500, mean latency: 0 ms
    Requests: 7258, requests per second: 500, mean latency: 0 ms
    Requests: 9757, requests per second: 500, mean latency: 0 ms
    ...
    Requests per second: 500
    Completed requests:  9758
    Total errors:        0
    Total time:          20.002735398000002 s
    Requests per second: 488
    Total time:          20.002735398000002 s

    Percentage of the requests served within a certain time
      50%      1 ms
      90%      1 ms
      95%      1 ms
      99%      14 ms
     100%      148 ms (longest request)

Much better: a sustained rate of 500 rps is seen most of the time,
488 rps average, and 99% of requests answered within 14 ms.

We now know that our server can accept 500 rps without problems.
Not bad for a single-process naïve Node.js server...
We may refine our results further to find at which point from 500 to 1000 rps our server breaks down.

But instead let us research how to improve the results.
One obvious candidate is to add keep-alive to the requests so we don't have to create
a new connection for every request.
The results (with the same test server) are impressive:

    $ loadtest http://localhost:7357/ -t 20 -c 10 -k
    ...
    Requests per second: 4099

    Percentage of the requests served within a certain time
    50%      2 ms
    90%      3 ms
    95%      3 ms
    99%      10 ms
    100%      25 ms (longest request)

Now you're talking! The steady rate also goes up to 2 krps:

    $ loadtest http://localhost:7357/ -t 20 -c 10 --keepalive --rps 2000
    ...
    Requests per second: 1950

    Percentage of the requests served within a certain time
      50%      1 ms
      90%      2 ms
      95%      2 ms
      99%      7 ms
     100%      20 ms (longest request)

Not bad at all: 2 krps with a single core, sustained.
However, it you try to push it beyond that, at 3 krps it will fail miserably.

## API

`loadtest` is not limited to running from the command line; it can be controlled using an API,
thus allowing you to load test your application in your own tests.

### Invoke Load Test

To run a load test, just call the exported function `loadTest()` with a set of options and an optional callback:

```javascript
const loadtest = require('loadtest');
const options = {
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
```

The callback `function(error, result)` will be invoked when the max number of requests is reached,
or when the max number of seconds has elapsed.

Beware: if there are no `maxRequests` and no `maxSeconds`, then tests will run forever
and will not call the callback.

### Options

All options but `url` are, as their name implies, optional.

#### `url`

The URL to invoke. Mandatory.

#### `concurrency`

How many clients to start in parallel.

#### `maxRequests`

A max number of requests; after they are reached the test will end.

Note: the actual number of requests sent can be bigger if there is a concurrency level;
loadtest will report just on the max number of requests.

#### `maxSeconds`

Max number of seconds to run the tests.

Note: after the given number of seconds `loadtest` will stop sending requests,
but may continue receiving tests afterwards.

#### `timeout`

Timeout for each generated request in milliseconds. Setting this to 0 disables timeout (default).

#### `cookies`

An array of cookies to send. Each cookie should be a string of the form name=value.

#### `headers`

A map of headers. Each header should be an entry in the map with the value given as a string.
If you want to have several values for a header, write a single value separated by semicolons,
like this:

    {
        accept: "text/plain;text/html"
    }

Note: when using the API, the "host" header is not inferred from the URL but needs to be sent
explicitly.

#### `method`

The method to use: POST, PUT. Default: GET.

#### `body`

The contents to send in the body of the message, for POST or PUT requests.
Can be a string or an object (which will be converted to JSON).

#### `contentType`

The MIME type to use for the body. Default content type is `text/plain`.

#### `requestsPerSecond`

How many requests each client will send per second.

#### `requestGenerator`

Custom request generator function.

Example request generator function could look like this:

```javascript
function(params, options, client, callback) {
  generateMessageAsync(function(message)) {
    request = client(options, callback);

    if (message)
    {
      options.headers['Content-Length'] = message.length;
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      request.write(message);
    }

    request.end();
  }
}
```

#### `agentKeepAlive`

Use an agent with 'Connection: Keep-alive'.

Note: Uses [agentkeepalive](https://npmjs.org/package/agentkeepalive),
which performs better than the default node.js agent.

#### `quiet`

Do not show any messages.

#### `indexParam`

The given string will be replaced in the final URL with a unique index.
E.g.: if URL is `http://test.com/value` and `indexParam=value`, then the URL
will be:

* http://test.com/1
* http://test.com/2
* ...
* body will also be replaced `body:{ userid: id_value }` will be `body:{ userid: id_1 }`

#### `indexParamCallback`

A function that would be executed to replace the value identified through `indexParam` through a custom value generator.

E.g.: if URL is `http://test.com/value` and `indexParam=value` and
```javascript
indexParamCallback: function customCallBack() {
  return Math.floor(Math.random() * 10); //returns a random integer from 0 to 9
}
``` 
then the URL could be:

* http://test.com/1 (Randomly generated integer 1)
* http://test.com/5 (Randomly generated integer 5)
* http://test.com/6 (Randomly generated integer 6)
* http://test.com/8 (Randomly generated integer 8)
* ...
* body will also be replaced `body:{ userid: id_value }` will be `body:{ userid: id_<value from callback> }`

#### `insecure`

Allow invalid and self-signed certificates over https.

#### `secureProtocol`

The TLS/SSL method to use. (e.g. TLSv1_method)

Example:

```javascript
const loadtest = require('loadtest');

const options = {
	url: 'https://www.example.com',
    maxRequests: 100,
    secureProtocol: 'TLSv1_method'
};

loadtest.loadTest(options, function(error) {
	if (error) {
		return console.error('Got an error: %s', error);
	}
	console.log('Tests run successfully');
});
```

#### `statusCallback`

Execution this function after every request operation completes. Provides immediate access to test results while the
test batch is still running. This can be used for more detailed custom logging or developing your own spreadsheet or
statistical analysis of results.

The results and error passed to the callback are in the same format as the results passed to the final callback.
 
In addition, the following three properties are added to the `result` object:

- `requestElapsed`: time in milliseconds it took to complete this individual request.
- `requestIndex`: 0-based index of this particular request in the sequence of all requests to be made.
- `instanceIndex`: the `loadtest(...)` instance index. This is useful if you call `loadtest()` more than once.

You will need to check if `error` is populated in order to determine which object to check for these properties.

Example:

```javascript
const loadtest = require('loadtest');

function statusCallback(error, result, latency) {
    console.log('Current latency %j, result %j, error %j', latency, result, error);
    console.log('----');
    console.log('Request elapsed milliseconds: ', result.requestElapsed);
    console.log('Request index: ', result.requestIndex);
    console.log('Request loadtest() instance index: ', result.instanceIndex);
}

const options = {
    url: 'http://localhost:8000',
    maxRequests: 1000,
    statusCallback: statusCallback
};

loadtest.loadTest(options, function(error) {
    if (error) {
        return console.error('Got an error: %s', error);
    }
    console.log('Tests run successfully');
});
```

**Warning**: The format for `statusCallback` has changed in version 2.0.0 onwards.
It used to be `statusCallback(latency, result, error)`,
it has been changed to conform to the usual Node.js standard.

#### `contentInspector`

A function that would be executed after every request before its status be added to the final statistics.

The is can be used when you want to mark some result with 200 http status code to be failed or error.

The `result` object passed to this callback function has the same fields as the `result` object passed to `statusCallback`.

`customError` can be added to mark this result as failed or error. `customErrorCode` will be provided in the final statistics, in addtion to the http status code.

Example:

```javascript
function contentInspector(result) {
    if (result.statusCode == 200) {
        const body = JSON.parse(result.body)
        // how to examine the body depends on the content that the service returns
        if (body.status.err_code !== 0) {
            result.customError = body.status.err_code + " " + body.status.msg
            result.customErrorCode = body.status.err_code
        }
    }
},
```

### Results

The latency results passed to your callback at the end of the load test contains a full set of data, including:
mean latency, number of errors and percentiles.
An example follows:

```javascript
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
  meanLatencyMs: 7.72,
  maxLatencyMs: 20,
  totalErrors: 3,
  errorCodes: {
	'0': 1,
	'500': 2
  }
}
```

The second parameter contains info about the current request:

```javascript
{
	host: 'localhost',
	path: '/',
	method: 'GET',
	statusCode: 200,
	body: '<html><body>hi</body></html>',
	headers: [...]
}
```
    
### Start Test Server

To start the test server use the exported function `startServer()` with a set of options and an optional callback:

```javascript
const testserver = require('testserver');
const server = testserver.startServer({ port: 8000 });
```

This function returns an HTTP server which can be `close()`d when it is no longer useful.

The following options are available.

#### `port`

Optional port to use for the server.

Note: the default port is 7357, since port 80 requires special privileges.

#### `delay`

Wait the given number of milliseconds to answer each request.

#### `error`

Return an HTTP error code.

#### `percent`

Return an HTTP error code only for the given % of requests.
If no error code was specified, default is 500.

### Configuration file

It is possible to put configuration options in a file named `.loadtestrc` in your working directory or in a file whose name is specified in the `loadtest` entry of your `package.json`. The options in the file will be used only if they are not specified in the command line.

The expected structure of the file is the following:

```json
{
	"delay": "Delay the response for the given milliseconds",
	"error": "Return an HTTP error code",
	"percent": "Return an error (default 500) only for some % of requests",
	"maxRequests": "Number of requests to perform",
	"concurrency": "Number of requests to make",
	"maxSeconds": "Max time in seconds to wait for responses",
	"timeout": "Timeout for each request in milliseconds",
	"method": "method to url",
	"contentType": "MIME type for the body",
	"body": "Data to send",
	"file": "Send the contents of the file",
	"cookies": {
		"key": "value"
	},
	"headers": {
		"key": "value"
	},
	"secureProtocol": "TLS/SSL secure protocol method to use",
	"insecure": "Allow self-signed certificates over https",
	"cert": "The client certificate to use",
	"key": "The client key to use",
	"requestGenerator": "JS module with a custom request generator function",
	"recover": "Do not exit on socket receive errors (default)",
	"agentKeepAlive": "Use a keep-alive http agent",
	"proxy": "Use a proxy for requests",
	"requestsPerSecond": "Specify the requests per second for each client",
	"indexParam": "Replace the value of given arg with an index in the URL"
}
```

For more information about the actual configuration file name, read the [confinode user manual](https://github.com/slune-org/confinode/blob/master/doc/en/usermanual.md#configuration-search). In the list of the [supported file types](https://github.com/slune-org/confinode/blob/master/doc/extensions.md), please note that only synchronous loaders can be used with _loadtest_.

### Complete Example

The file `lib/integration.js` shows a complete example, which is also a full integration test:
it starts the server, send 1000 requests, waits for the callback and closes down the server.

## Versioning

Version 3.x uses ES2015 (ES6) features,
such as `const` or `let` and arrow functions.
For ES5 support please use versions 2.x.

## Licensed under The MIT License

Copyright (c) 2013-9 Alex Fernández <alexfernandeznpm@gmail.com>
and [contributors](https://github.com/alexfernandez/loadtest/graphs/contributors).

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


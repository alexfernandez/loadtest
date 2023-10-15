[![run on repl.it](http://repl.it/badge/github/alexfernandez/loadtest)](https://repl.it/github/alexfernandez/loadtest)

[![NPM](https://nodei.co/npm/loadtest.png?downloads=true)](https://nodei.co/npm/loadtest/)

[![Package quality](https://packagequality.com/badge/loadtest.png)](https://packagequality.com/#?package=loadtest)

# loadtest

Runs a load test on the selected HTTP or WebSockets URL. The API allows for easy integration in your own tests.

## Installation

Install globally as root:

    # npm install -g loadtest

On Ubuntu or Mac OS X systems install using sudo:

    $ sudo npm install -g loadtest

For access to the API just install it in your `npm` package as a dev dependency:

    $ npm install --save-dev loadtest

### Compatibility

Versions 6 and later should be used at least with Node.js v16 or later:

* Node.js v16 or later: ^6.0.0
* Node.js v10 or later: ^5.0.0
* Node.js v8 or later: 4.x.y
* Node.js v6 or earlier: ^3.1.0
* ES5 support (no `let`, `const` or arrow functions): ^2.0.0.

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
The result includes mean response times and percentiles,
so that you can abort deployment e.g. if 99% of all requests don't finish in 10 ms or less.

### Usage Don'ts

`loadtest` performance has improved significantly,
but it is still limited.
`loadtest` saturates a single CPU pretty quickly,
so it uses half the available cores in your processor.
The Node.js processes can reach 100% usage in `top`,
which happens approx. when your load is above 4000~7000 rps per core.
In this case please adjust the number of cores.
So for instance with eight cores you can expect to get a maximum performance of
8 * 5000 = 40 krps.

You can measure the practical limits of `loadtest` on your specific test machines by running it against a simple
[test server](#test-server)
and seeing when it reaches 100% CPU. Run the following commands on two different consoles:

    $ node bin/testserver.js
    $ node bin/loadtest.js -n 1000000 -c 100 http://localhost:7357/

If you have reached the limits of `loadtest` even after using all cores,
there are other tools that you can try.

* [AutoCannon](https://www.npmjs.com/package/autocannon): also an `npm` package,
awesome tool with an interface similar to `wrk`.
* [Apache `ab`](http://httpd.apache.org/docs/2.2/programs/ab.html)
has great performance, but it is limited by a single CPU performance.
Its practical limit is somewhere around ~40 krps.
* [weighttp](http://redmine.lighttpd.net/projects/weighttp/wiki) is also `ab`-compatible
and is supposed to be very fast (the author has not personally used it).
* [wrk](https://github.com/wg/wrk) is multithreaded and highly performance.
It may need installing from source though, and its interface is not `ab`-compatible.
* [wrk2](https://github.com/giltene/wrk2): evolution of `wrk`.

### Regular Usage

The following parameters are compatible with Apache ab.

#### `-t`, `--maxSeconds`

Max number of seconds to wait until requests no longer go out.
Default is 10 seconds, applies only if no `--maxRequests` is specified.

Note: this is different than Apache `ab`, which stops _receiving_ requests after the given seconds.

**Warning**: max seconds used to have no default value,
so tests would run indefinitely if no `--maxSeconds` and no `--maxRequests` were specified.
Max seconds was changed to default to 10 in version 8.

#### `-n`, `--maxRequests`

Number of requests to send out.
Default is no limit;
will keep on sending until the time limit in `--maxSeconds` is reached.

Note: the total number of requests sent can be bigger than the parameter if there is a concurrency parameter;
loadtest will report just the first `n`.

#### `-c`, `--concurrency`

loadtest will create a certain number of clients; this parameter controls how many.
Requests from them will arrive concurrently to the server.
Default value is 10.

Note: requests are not sent in parallel (from different processes),
but concurrently (a second request may be sent before the first has been answered).
Does not apply if `--requestsPerSecond` is specified.

Beware: if concurrency is too low then it is possible that there will not be enough clients
to send all the supported traffic,
adjust it with `-c` if needed.

**Warning**: concurrency used to have a default value of 1,
until it was changed to 10 in version 8.

#### `-k`, `--keepalive`

Open connections using keep-alive:
use header `Connection: keep-alive` instead of `Connection: close`.

Note: Uses [agentkeepalive](https://npmjs.org/package/agentkeepalive),
which performs better than the default node.js agent.

#### `-C`, `--cookie cookie-name=value`

Send a cookie with the request. The cookie `name=value` is then sent to the server.
This parameter can be repeated as many times as needed.

#### `-H`, `--header header:value`

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

#### `-T`, `--contentType`

Set the MIME content type for POST data. Default: `text/plain`.

#### `-P`, `--postBody`

Send the string as the POST body. E.g.: `-P '{"key": "a9acf03f"}'`

#### `-A`, `--patchBody`

Send the string as the PATCH body. E.g.: `-A '{"key": "a9acf03f"}'`

#### `-m`, `--method`

Set method that will be sent to the test URL.
Accepts: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`,
and lowercase versions. Default is `GET`.
Example: `-m POST`.

#### `--data body`

Add some data to send in the body. It does not support method GET.
Requires setting the method with `-m` and the type with `-T`.
Example: `--data '{"username": "test", "password": "test"}' -T 'application/x-www-form-urlencoded' -m POST`


#### `-p`, `--postFile`

Send the data contained in the given file in the POST body.
Remember to set `-T` to the correct content-type.

If `POST-file` has `.js` extension it will be `import`ed. It should be a valid node module and it
should `export` a default function, which is invoked with an automatically generated request identifier
to provide the body of each request.
This is useful if you want to generate request bodies dynamically and vary them for each request.

Example:

```javascript
export default function request(requestId) {
  // this object will be serialized to JSON and sent in the body of the request
  return {
	key: 'value',
	requestId: requestId
  }
}
```

See sample file in `sample/post-file.js`, and test in `test/body-generator.js`.

#### `-u`, `--putFile`

Send the data contained in the given file as a PUT request.
Remember to set `-T` to the correct content-type.

If `PUT-file` has `.js` extension it will be `import`ed. It should be a valid node module and it
should `export` a default function, which is invoked with an automatically generated request identifier
to provide the body of each request.
This is useful if you want to generate request bodies dynamically and vary them for each request.
For examples see above for `-p`.

#### `-a`, `--patchFile`

Send the data contained in the given file as a PATCH request.
Remember to set `-T` to the correct content-type.

If `PATCH-file` has `.js` extension it will be `import`ed. It should be a valid node module and it
should `export` a default function, which is invoked with an automatically generated request identifier
to provide the body of each request.
This is useful if you want to generate request bodies dynamically and vary them for each request.
For examples see above for `-p`.

##### `-r`, `--recover`

Recover from errors. Always active: loadtest does not stop on errors.
After the tests are finished, if there were errors a report with all error codes will be shown.

#### `-s`, `--secureProtocol`

The TLS/SSL method to use. (e.g. TLSv1_method)

Example:

    $ loadtest -n 1000 -s TLSv1_method https://www.example.com

#### `-V`, `--version`

Show version number and exit.

### Advanced Usage

The following parameters are _not_ compatible with Apache ab.

#### `--rps`, `--requestsPerSecond`

Controls the number of requests per second that are sent.
Cannot be fractional, e.g. `--rps 0.5`.
In this mode each request is not sent as soon as the previous one is responded,
but periodically even if previous requests have not been responded yet.

Note: the `--concurrency` option will be ignored if `--requestsPerSecond` is specified;
clients will be created on demand.

Note: `--rps` is not supported for websockets.

#### `--cores number`

Start `loadtest` in multi-process mode on a number of cores simultaneously.
Forks the requested number of processes using the
[Node.js cluster module](https://nodejs.org/api/cluster.html).
Default: half the available CPUs on the machine.

The total number of requests and the rps rate are shared among all processes.
The result shown is the aggregation of results from all cores.

Note: this option is not available in the API,
since it runs just within the calling process.

**Warning**: the default value for `--cores` has changed in version 7+,
from 1 to half the available CPUs on the machine.
Set to 1 to get the previous single-process mode.

#### `--timeout milliseconds`

Timeout for each generated request in milliseconds.
Setting this to 0 disables timeout (default).

#### `-R requestGeneratorModule.js`

Use a custom request generator function from an external file.
See an example of a request generator module in [`requestGenerator`](doc/api.md#requestGenerator).
Also see [`sample/request-generator.js`](sample/request-generator.js) for some sample code including a body
(or [`sample/request-generator.ts`](sample/request-generator.ts) for ES6/TypeScript).

#### `--agent` (deprecated)

Open connections using keep-alive.

Note: instead of using the default agent, this option is now an alias for `-k`.

#### `--quiet`

Do not show any messages.

#### `--debug` (deprecated)

Show debug messages.

Note: deprecated in version 6+.

#### `--insecure`

Allow invalid and self-signed certificates over https.

#### `--cert path/to/cert.pem`

Sets the certificate for the http client to use. Must be used with `--key`.

#### `--key path/to/key.pem`

Sets the key for the http client to use. Must be used with `--cert`.

#### `--tcp` (experimental)

Option to use low level TCP sockets,
faster than the standard HTTP library.
Not all options are supported.

**Warning**: experimental option.
May not work with your test case.
See [TCP Sockets Performance](doc/tcp-sockets.md) for details.

### Test Server

loadtest bundles a test server. To run it:

    $ testserver-loadtest [options] [port]

This command will show the number of requests received per second,
the latency in answering requests and the headers for selected requests.

The server returns a short text 'OK' for every request,
so that latency measurements don't have to take into account request processing.

If no port is given then default port 7357 will be used.
The optional delay instructs the server to wait for the given number of milliseconds
before answering each request, to simulate a busy server.
You can also simulate errors on a given percent of requests.

The following optional parameters are available.

#### `--delay ms`

Wait the specified number of milliseconds before answering each request.

#### `--error 5xx`

Return the given error for every request.

#### `--percent yy`

Return an error (default 500) only for the specified % of requests.

#### `--cores number`

Number of cores to use. If not 1, will start in multi-process mode.

Note: since version v6.3.0 the test server uses half the available cores by default;
use `--cores 1` to use in single-process mode.

### Complete Example

Let us now see how to measure the performance of the test server.

First we install `loadtest` globally:

    $ sudo npm install -g loadtest

Now we start the test server:

    $ testserver-loadtest --cores 2
    Listening on http://localhost:7357/
    Listening on http://localhost:7357/

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

    Percentage of requests served within a certain time
      50%      4 ms
      90%      5 ms
      95%      6 ms
      99%      14 ms
     100%      35997 ms (longest request)

The result was quite erratic, with some requests taking up to 36 seconds;
this suggests that Node.js is queueing some requests for a long time, and answering them irregularly.
Now we will try a fixed rate of 1000 rps:

    $ loadtest http://localhost:7357/ -t 20 -c 10 --rps 1000
    ...
    Requests: 4551, requests per second: 910, mean latency: 0 ms
    Requests: 9546, requests per second: 1000, mean latency: 0 ms
    Requests: 14549, requests per second: 1000, mean latency: 20 ms
    ...
    Percentage of requests served within a certain time
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

    Percentage of requests served within a certain time
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

But instead let us research how to improve the result.
One obvious candidate is to add keep-alive to the requests so we don't have to create
a new connection for every request.
The result (with the same test server) is impressive:

    $ loadtest http://localhost:7357/ -t 20 -c 10 -k
    ...
    Requests per second: 4099

    Percentage of requests served within a certain time
    50%      2 ms
    90%      3 ms
    95%      3 ms
    99%      10 ms
    100%      25 ms (longest request)

Now we're talking! The steady rate also goes up to 2 krps:

    $ loadtest http://localhost:7357/ -t 20 -c 10 --keepalive --rps 2000
    ...
    Requests per second: 1950

    Percentage of requests served within a certain time
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
A short introduction follows; see [complete docs for API](doc/api.md).

### Invoke Load Test

To run a load test, invoke the exported function `loadTest()` with the desired options:

```javascript
import {loadTest} from 'loadtest'

const options = {
    url: 'http://localhost:8000',
    maxRequests: 1000,
}
const result = await loadTest(options)
result.show()
console.log('Tests run successfully')
```

Beware: if there are no `maxRequests` and no `maxSeconds`, the test will run forever.

### `loadTest()` Parameters

A simplified list of parameters is shown below;
see [doc/api.md](doc/api.md) for the full explanations with examples.

* `url`: URL to invoke, mandatory.
* `concurrency`: how many clients to start in parallel.
* `maxRequests`: max number of requests; after they are reached the test will end.
* `maxSeconds`: max number of seconds to run the tests.
* `timeout`: timeout for each generated request in milliseconds, set to 0 to disable (default).
* `cookies`: array of cookies to send, of the form `name=value`.
* `headers`: object with headers, each with the value as string. Separate by semicolons to have multiple values.
* `method`: HTTP method to use, default `GET`.
* `body`: contents to send in the body of the message.
* `contentType`: MIME type to use for the body, default `text/plain`.
* `requestsPerSecond`: how many requests will be sent per second.
* `requestGenerator`: custom request generator function.
* `agentKeepAlive`: if true, will use 'Connection: Keep-alive'.
* `quiet`: if true, do not show any messages.
* `indexParam`: parameter to replace in URL and body with a unique index.
* `indexParamCallback`: function to generate unique indexes.
* `insecure`: allow invalid and self-signed certificates over https.
* `secureProtocol`: TLS/SSL method to use.
* `statusCallback(error, result)`: function to call after every request is completed.
* `contentInspector(result)`: function to call before aggregating statistics.
    
### Start Test Server

To start the test server use the exported function `startServer()` with a set of options:

```javascript
import {startServer} from 'loadtest'
const server = await startServer({port: 8000})
// do your thing
await server.close()
```

The following options are available,
see [doc/api.md](doc/api.md) for details.

* `port`: optional port to use for the server, default 7357.
* `delay`: milliseconds to wait before answering each request.
* `error`: HTTP status code to return, default 200 (no error).
* `percent`: return error only for the given % of requests.
* `logger(request, response)`: function to call after every request.

Returns a test server that you can `close()` when finished.

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

See sample file in `sample/.loadtestrc`.

For more information about the actual configuration file name, read the [confinode user manual](https://github.com/slune-org/confinode/blob/master/doc/en/usermanual.md#configuration-search). In the list of the [supported file types](https://github.com/slune-org/confinode/blob/master/doc/extensions.md), please note that only synchronous loaders can be used with _loadtest_.

### Complete Example

The file `test/integration.js` contains complete examples, which are also a full integration test suite:
they start the server with different options, send requests, waits for finalization and close down the server.

## Licensed under The MIT License

Copyright (c) 2013-9 Alex Fernández <alexfernandeznpm@gmail.com>
and [contributors](https://github.com/alexfernandez/loadtest/graphs/contributors).

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


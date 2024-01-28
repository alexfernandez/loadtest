# loadtest API

The `loadtest` package is a powerful tool that can be added to your package.
The API allows for easy integration in your own tests,
for instance to run automated load tests.
You can verify the performance of your server before each deployment,
and deploy only if a certain target is reached.

## Installation

For access to the API just install it in your `npm` package as a dev dependency:

    $ npm install --save-dev loadtest

### Compatibility

See [README file](../README.md) for compatibility.

## API

`loadtest` is not limited to running from the command line; it can be controlled using an API,
thus allowing you to load test your application in your own tests.

### Invoke Load Test

To run a load test, just `await` for the exported function `loadTest()` with the desired options, described below:

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

The call returns a `Result` object that contains all info about the load test, also described [below](#result).
Call `result.show()` to display the results in the standard format on the console.

As a legacy from before promises existed,
if an optional callback is passed as second parameter then it will not behave as `async`:
the callback `function(error, result)` will be invoked when the max number of requests is reached,
or when the max number of seconds has elapsed.

```javascript
import {loadTest} from 'loadtest'

const options = {
	url: 'http://localhost:8000',
	maxRequests: 1000,
}
loadTest(options, function(error, result) {
	if (error) {
		return console.error('Got an error: %s', error)
	}
	result.show()
	console.log('Tests run successfully')
})
```

### Options

All options but `url` are, as their name implies, optional.
See also the [simplified list](../README.md#loadtest-parameters).

#### `url`

The URL to invoke. Mandatory.

#### `maxSeconds`

Max number of seconds to run the tests.
Default is 10 seconds, applies only if no `maxRequests` is specified.

Note: after the given number of seconds `loadtest` will stop sending requests,
but may continue receiving tests afterwards.

**Warning**: max seconds used to have no default value,
so tests would run indefinitely if no `maxSeconds` and no `maxRequests` were specified.
Max seconds was changed to default to 10 in version 8.

#### `maxRequests`

A max number of requests; after they are reached the test will end.
Default is no limit;
will keep on sending until the time limit in `maxSeconds` is reached.

Note: the actual number of requests sent can be bigger if there is a concurrency level;
loadtest will report just on the max number of requests.

#### `concurrency`

How many clients to start in parallel, default is 10.
Does not apply if `requestsPerSecond` is specified.

**Warning**: concurrency used to have a default value of 1,
until it was changed to 10 in version 8.

#### `timeout`

Timeout for each generated request in milliseconds. Setting this to 0 disables timeout (default).

#### `cookies`

An array of cookies to send. Each cookie should be a string of the form `name=value`.

#### `headers`

An object containing headers of the form `key: 'value'}.
Each attribute of the object should be a header with the value given as a string.
If you want to have several values for a header, write a single value separated by semicolons,
like this:

    {
        accept: "text/plain;text/html"
    }

#### `method`

The method to use: POST, PUT. Default: GET.

#### `body`

The contents to send in the body of the message, for POST or PUT requests.
Can be a string or an object (which will be converted to JSON).

#### `contentType`

The MIME type to use for the body. Default content type is `text/plain`.

#### `requestsPerSecond`

How many requests will be sent per second globally.

#### `requestGenerator(params, options, client, callback)`

Use a custom request generator function.
The request needs to be generated synchronously and returned when this function is invoked.

Example request generator function could look like this:

```javascript
function(params, options, client, callback) {
  const message = generateMessage();
  const request = client(options, callback);
  options.headers['Content-Length'] = message.length;
  options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  request.write(message);
  request.end();
  return request;
}
```

See [`sample/request-generator.js`](sample/request-generator.js) for some sample code including a body
(or [`sample/request-generator.ts`](sample/request-generator.ts) for ES6/TypeScript).

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
import {loadTest} from 'loadtest'

const options = {
	url: 'https://www.example.com',
    maxRequests: 100,
    secureProtocol: 'TLSv1_method'
}

loadTest(options, function(error) {
	if (error) {
		return console.error('Got an error: %s', error)
	}
	console.log('Tests run successfully')
})
```

#### `statusCallback(error, result)`

If present, this function executes after every request operation completes. Provides immediate access to the test result while the
test batch is still running. This can be used for more detailed custom logging or developing your own spreadsheet or
statistical analysis of the result.

The `error` and `result` passed to the callback are in the same format as the result passed to the final callback:

* `error` is only populated if the request finished in error,
* `result` contains info about the current request: `host`, `path`, `method`, `statusCode`, received `body` and `headers`.
Additionally has the following parameters:
  - `requestElapsed`: time in milliseconds it took to complete this individual request.
  - `requestIndex`: 0-based index of this particular request in the sequence of all requests to be made.
  - `instanceIndex`: the `loadtest(...)` instance index. This is useful if you call `loadtest()` more than once.

Example result:

```javascript
{
	host: 'localhost',
	path: '/',
	method: 'GET',
	statusCode: 200,
	body: '<html><body>hi</body></html>',
	headers: [...],
	requestElapsed: 248,
	requestIndex: 8748,
	instanceIndex: 5,
}
```

See [full example](./status-callback.md).

**Warning**: The format for `statusCallback` has changed in version 7+.
Used to be `statusCallback(error, result, latency)`;
the third parameter `latency` has been removed due to performance reasons.

#### `contentInspector(result)`

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

#### `tcp`

If true, use low-level TCP sockets.
Faster option that can increase performance by up to 10x,
especially in local test setups.

**Warning**: Experimental option.
May not work for your test case.
Not compatible with options `indexParam`, `statusCallback`, `requestGenerator`.
See [TCP Sockets Performance](doc/tcp-sockets.md) for details.

### Result

The latency result returned at the end of the load test contains a full set of data, including:
mean latency, number of errors and percentiles.
A simplified example follows:

```javascript
{
  url: 'http://localhost:80/',
  maxRequests: 1000,
  maxSeconds: 0,
  concurrency: 10,
  agent: 'none',
  requestsPerSecond: undefined,
  totalRequests: 1000,
  percentiles: {
	'50': 7,
	'90': 10,
	'95': 11,
	'99': 15
  },
  effectiveRps: 2824,
  elapsedSeconds: 0.354108,
  meanLatencyMs: 7.72,
  maxLatencyMs: 20,
  totalErrors: 3,
  clients: 10,
  errorCodes: {
	'0': 1,
	'500': 2
  },
}
```

The `result` object also has a `result.show()` function
that displays the results on the console in the standard format.

Some of the attributes (`url`, `concurrency`) will be identical to the parameters passed.
The following attributes can also be returned.

#### `totalRequests`

How many requests were actually processed.

#### `totalRequests`

How many requests resulted in an error.

#### `effectiveRps`

How many requests per second were actually processed.

#### `elapsedSeconds`

How many seconds the test lasted.

#### `meanLatencyMs`

Average latency in milliseconds.

#### `errorCodes`

Object containing a map with all status codes received.

#### `clients`

Number of concurrent clients started.
Should equal the concurrency level unless the `rps` option is specified.
    
### Start Test Server

To start the test server use the exported function `startServer()` with a set of options:

```javascript
import {startServer} from 'loadtest'
const server = await startServer({port: 8000})
// do your thing
await server.close()
```

This function returns when the server is up and running,
with a server object which can be `close()`d when it is no longer useful.
As a legacy from before promises existed,
if an optional callback is passed as second parameter then it will not behave as `async`:

```javascript
const server = startServer({port: 8000}, error => console.error(error))
```

**Warning**: up until version 7 this function returned an HTTP server;
this was changed to a test server object with an identical `close()` method.

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

#### `logger(request, response)`

A function to be called after every request served by the test server.
`request` and `response` are the usual HTTP objects.


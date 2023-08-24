# `statusCallback`

In-depth examples for the `statusCallback` API parameter.

## `options.statusCallback(error, result)`

This function, if present, is invoked after every request is finished.
It uses the old-style convention `(error, result)`:
the `error` is only present if the request fails,
while the `result` is always present and contains info about the request.

**Warning**: The format for `statusCallback` has changed in version 7+.
The third parameter `latency` has been removed due to performance reasons.

**Warning**: The format for `statusCallback` has changed in version 2.0.0 onwards.
It used to be `statusCallback(latency, result, error)`,
it has been changed to conform to the usual Node.js standard.

### `result` format

The `result` parameter has the following attributes, always present:

* `host`: the host where the request was sent.
* `path`: the URL path to send the request.
* `method: HTTP method used.
* `statusCode: HTTP status code, 200 is OK.
* `body: content received from the server.
* `headers: sent by the server.
* `requestElapsed`: time in milliseconds it took to complete this individual request.
* `requestIndex`: 0-based index of this particular request in the sequence of all requests to be made.
* `instanceIndex`: the `loadtest(...)` instance index. This is useful if you call `loadtest()` more than once.

### Example Result

A sample result might look like this:

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

## Full example

A full example of how to use the `statusCallback` follows:

```javascript
import {loadTest} from 'loadtest'

function statusCallback(error, result, latency) {
    console.log('Current latency %j, result %j, error %j', latency, result, error)
    console.log('----')
    console.log('Request elapsed milliseconds: ', result.requestElapsed)
    console.log('Request index: ', result.requestIndex)
    console.log('Request loadtest() instance index: ', result.instanceIndex)
}

const options = {
    url: 'http://localhost:8000',
    maxRequests: 1000,
    statusCallback: statusCallback
}

loadTest(options, function(error) {
    if (error) {
        return console.error('Got an error: %s', error)
    }
    console.log('Tests run successfully')
})
```

### Adding Request Data
 
In some situations request data needs to be available in the statusCallBack.
This data can be assigned to `request.labels` in the requestGenerator:
```javascript
const options = {
	// ...
	requestGenerator: (params, options, client, callback) => {
		// ...
        const randomInputData = Math.random().toString().substr(2, 8);
        const message = JSON.stringify({ randomInputData })
		const request = client(options, callback);
        request.labels = randomInputData;
		request.write(message);
		return request;
	}
};
```

Then in statusCallBack the labels can be accessed through `result.labels`:
```javascript
function statusCallback(error, result, latency) {
    console.log(result.labels);
}
```


'use strict';

/**
 * Sample request generator usage.
 * Contributed by jjohnsonvng:
 * https://github.com/alexfernandez/loadtest/issues/86#issuecomment-211579639
 */

var loadtest = require('../lib/loadtest.js');

var options = {
	url: 'http://yourHost',
	concurrent: 5,
	method: 'POST',
	body:'',
	requestsPerSecond:5,
	maxSeconds:30,
	requestGenerator: function(params, options, client, callback)
	{
		var message = '{"hi": "ho"}';
		options.headers['Content-Length'] = message.length;
		options.headers['Content-Type'] = 'application/json';
		options.body = 'YourPostData';
		options.path = 'YourURLPath';
		var request = client(options, callback);
		request.write(message);
		return request;
	}
};

loadtest.loadTest(options, function(error, results)
{
	if (error)
	{
		return console.error('Got an error: %s', error);
	}
	console.log(results);
	console.log('Tests run successfully');
});


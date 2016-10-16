'use strict';

/**
 * Load Test a URL, website or websocket.
 * (C) 2013 Alex Fernández.
 */


// requires
require('prototypes');
var Log = require('log');
var http = require('http');
var https = require('https');
var testing = require('testing');
var httpClient = require('./httpClient.js');
var websocket = require('./websocket.js');
var timing = require('./timing.js');

// globals
var log = new Log('info');

// constants
var SHOW_INTERVAL_MS = 5000;

// init
http.globalAgent.maxSockets = 1000;
https.globalAgent.maxSockets = 1000;


/**
 * Run a load test.
 * Options is an object which may have:
 *	- url: mandatory URL to access.
 *	- concurrency: how many concurrent clients to use.
 *	- maxRequests: how many requests to send
 *	- maxSeconds: how long to run the tests.
 *	- cookies: a string or an array of strings, each with name:value.
 *	- headers: a map with headers: {key1: value1, key2: value2}.
 *	- method: the method to use: POST, PUT. Default: GET, what else.
 *	- body: the contents to send along a POST or PUT request.
 *	- contentType: the MIME type to use for the body, default text/plain.
 *	- requestsPerSecond: how many requests per second to send.
 *	- agentKeepAlive: if true, then use connection keep-alive.
 *	- debug: show debug messages.
 *	- quiet: do not log any messages.
 *	- indexParam: string to replace with a unique index.
 *	- insecure: allow https using self-signed certs.
 * An optional callback will be called if/when the test finishes.
 */
exports.loadTest = function(options, callback)
{
	if (!options.url)
	{
		log.error('Missing URL in options');
		return;
	}
	options.concurrency = options.concurrency || 1;
	if (options.requestsPerSecond)
	{
		options.requestsPerSecond = options.requestsPerSecond / options.concurrency;
	}
	if (options.debug)
	{
		log.level = Log.DEBUG;
	}
	if (!options.url.startsWith('http://') && !options.url.startsWith('https://') && !options.url.startsWith('ws://'))
	{
		log.error('Invalid URL %s, must be http://, https:// or ws://', options.url);
		return;
	}
	if (callback && !('quiet' in options))
	{
		options.quiet = true;
	}

	if (options.url.startsWith('ws:'))
	{
		if (options.requestsPerSecond)
		{
			log.error('"requestsPerSecond" not supported for WebSockets');
		}
	}

	var operation = new Operation(options, callback);
	operation.start();
	return operation;
};

/**
 * Used to keep track of individual load test Operation runs.
 *
 * @type {number}
 */
var operationInstanceIndex = 0;

/**
 * A load test operation.
 */
var Operation = function(options, callback)
{
	// self-reference
	var self = this;

	// attributes
	self.running = true;
	self.latency = null;
	var clients = {};
	var requests = 0;
	var showTimer;
	var stopTimeout;

	self.instanceIndex = operationInstanceIndex++;

	/**
	 * Start the operation.
	 */
	self.start = function()
	{
		self.latency = new timing.Latency(options);
		startClients();
		if (options.maxSeconds)
		{
			stopTimeout = setTimeout(self.stop, options.maxSeconds * 1000);
		}
		showTimer = new timing.HighResolutionTimer(SHOW_INTERVAL_MS, self.latency.showPartial);
	};

	/**
	 * Call after each operation has finished.
	 */
	self.callback = function(error, result, next)
	{
		requests += 1;
		if (options.maxRequests)
		{
			if (requests == options.maxRequests)
			{
				self.stop();
			}
			if (requests > options.maxRequests)
			{
				log.debug('Should have no more running clients');
			}
		}
		if (self.running && next)
		{
			next();
		}
		if (options.statusCallback)
		{
			options.statusCallback(error, result, self.latency.getResults());
		}
	};

	/**
	 * Start a number of measuring clients.
	 */
	function startClients()
	{
		var url = options.url;
		for (var index = 0; index < options.concurrency; index++)
		{
			if (options.indexParam)
			{
				options.url = url.replaceAll(options.indexParam, index);

				if(options.body)
				{
					var strBody = JSON.stringify(options.body);
					strBody = strBody.replaceAll(options.indexParam, index);
					options.body = JSON.parse(strBody);
				}
			}			
			var constructor = httpClient.create;
			if (options.url.startsWith('ws:'))// TODO: || options.url.startsWith('wss:'))
			{
				constructor = websocket.create;
			}
			var client = constructor(self, options);
			clients[index] = client;
			if (!options.requestsPerSecond)
			{
				client.start();
			}
			else
			{
				// start each client at a random moment in one second
				var offset = Math.floor(Math.random() * 1000);
				setTimeout(client.start, offset);
			}
		}
	}

	/**
	 * Stop clients.
	 */
	self.stop = function()
	{
		if (showTimer)
		{
			showTimer.stop();
		}
		if (stopTimeout)
		{
			clearTimeout(stopTimeout);
		}
		self.running = false;

		Object.keys(clients).forEach(function(index) {
			clients[index].stop();
		});
		if (callback)
		{
			var result = self.latency.getResults();
			result.instanceIndex = this.instanceIndex;
			callback(null, result);
		}
		else
		{
			self.latency.show();
		}
	};
};

/**
 * A load test with max seconds.
 */
function testMaxSeconds(callback)
{
	var options = {
		url: 'http://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
	};
	exports.loadTest(options, callback);
}


/**
 * A load test with max seconds.
 */
function testWSEcho(callback)
{
	var options = {
		url: 'ws://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
	};
	exports.loadTest(options, callback);
}


/**
 * Run all tests.
 */
exports.test = function(callback)
{
	testing.run([testMaxSeconds, testWSEcho], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}


'use strict';

/**
 * Load Test a URL, website or websocket.
 * (C) 2013 Alex Fernández.
 */


// requires
require('prototypes');
var testing = require('testing');
var urlLib = require('url');
var http = require('http');
var https = require('https');
var Log = require('log');
var timing = require('./timing.js');
var headers = require('./headers.js');

// globals
var log = new Log('info');

// constants
var SHOW_INTERVAL_MS = 5000;


/**
 * A client for an HTTP connection.
 * Operation is an object which has these attributes:
 *	- latency: a variable to measure latency.
 *	- running: if the operation is running or not.
 * Params is an object with the same options as exports.loadTest.
 */
function HttpClient(operation, params)
{
	// self-reference
	var self = this;

	// attributes
	var requestTimer;
	var options;
	var message;

	// init
	init();

	/**
	 * Init options and message to send.
	 */
	function init()
	{
		options = urlLib.parse(params.url);
		options.headers = [];
		if (params.headers)
		{
			options.headers = params.headers;
		}
		if (!params.agent)
		{
			options.agent = false;
		}
		if (params.agentKeepAlive)
		{
			var KeepAlive = require('agentkeepalive');
			options.agent = new KeepAlive({
				maxSockets: params.concurrency,
				maxKeepAliveRequests: 0, // max requests per keepalive socket, default is 0, no limit
				maxKeepAliveTime: 3000  // keepalive for 30 seconds
			});
		}
		if (params.method)
		{
			options.method = params.method;
		}
		if (params.body)
		{
			if (typeof params.body == 'string')
			{
				log.debug('Received string body');
				message = params.body;
			}
			else if (typeof params.body == 'object')
			{
				log.debug('Received JSON body');
				message = JSON.stringify(params.body);
			}
			else
			{
				log.error('Unrecognized body: %s', typeof params.body);
			}
			options.headers.push(['Content-Length', getBytesLength(message)]);
			options.headers.push(['Content-Type', params.contentType || 'text/plain']);
		}
		if (params.cookies)
		{
			if (Array.isArray(params.cookies))
			{
				options.headers.push(['Cookie', params.cookies.join('; ')]);
			}
			else if (typeof params.cookies == 'string')
			{
				options.headers.push(['Cookie', params.cookies]);
			}
			else
			{
				console.error('Invalid cookies %j, please use an array or a string', params.cookies);
			}
		}
		headers.addUserAgent(options.headers);
		log.debug('Options: %j', options);
	}

	/**
	 * Start the HTTP client.
	 */
	self.start = function()
	{
		if (!params.requestsPerSecond)
		{
			return self.makeRequest();
		}
		var interval = 1000 / params.requestsPerSecond;
		requestTimer = new timing.HighResolutionTimer(interval, self.makeRequest);
	};

	/**
	 * Stop the HTTP client.
	 */
	self.stop = function()
	{
		if (requestTimer)
		{
			requestTimer.stop();
		}
	};

	/**
	 * Make a single request to the server.
	 */
	self.makeRequest = function()
	{
		if (!operation.running)
		{
			return;
		}
		var id = operation.latency.start(id);
		var requestFinished = getRequestFinisher(id);
		var lib = http;
		if (options.protocol == 'https:')
		{
			lib = https;
		}

		// Disable certificate checking
		if (params.insecure === true) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
		}

		var request = lib.request(options, getConnect(id, requestFinished));
		if (message)
		{
			request.write(message);
		}
		request.on('error', function(error)
		{
			requestFinished('Connection error: ' + error.message);
		});
		request.end();
	};

	/**
	 * Get a function that finishes one request and goes for the next.
	 */
	function getRequestFinisher(id)
	{
		return function(error, result)
		{
			var errorCode = null;
			if (error)
			{
				log.debug('Connection %s failed: %s', id, error);
				if (result)
				{
					errorCode = result;
				}
				else
				{
					errorCode = '-1';
				}
			}
			else
			{
				log.debug('Connection %s ended', id);
			}
			operation.latency.end(id, errorCode);
			var callback;
			if (!params.requestsPerSecond)
			{
				callback = self.makeRequest;
			}
			operation.callback(error, result, callback);
		};
	}

	/**
	 * Get a function to connect the player.
	 */
	function getConnect(id, callback)
	{
		return function(connection)
		{
			log.debug('HTTP client connected to %s with id %s', params.url, id);
			connection.setEncoding('utf8');
			connection.on('data', function(chunk)
			{
				log.debug('Body: %s', chunk);
			});
			connection.on('error', function(error)
			{
				callback('Connection ' + id + ' failed: ' + error, '1');
			});
			connection.on('end', function()
			{
				if (connection.statusCode >= 300)
				{
					return callback('Status code ' + connection.statusCode, connection.statusCode);
				}
				callback(null, false);
			});
		};
	}

	function getBytesLength(data, encoding) {
		var count = 0;

		for (var i in data) {
			var byte_count = 1;

			var char_code = data.charCodeAt(i);

			if (char_code > 0x4000000) {
				byte_count = 6;
			}
			else if (char_code > 0x200000) {
				byte_count = 5;
			}
			else if (char_code > 0x10000) {
				byte_count = 4;
			}
			else if (char_code > 0x0800) {
				byte_count = 3;
			}
			else if (char_code > 0x0080) {
				byte_count = 2;
			}

			count += byte_count;
		}

		return count;
	}
}

/**
 * Run a load test.
 * Options is an object which may have:
 *	- url: mandatory URL to access.
 *	- concurrency: how many concurrent clients to use.
 *	- maxRequests: how many requests to send
 *	- maxSeconds: how long to run the tests.
 *	- cookies: a string or array of objects, each with {name:name, value:value}.
 *	- headers: a structure with headers:
 *		* map: {key: value, key2: value2},
 *		* array: [[key1, value1], [key2, value]].
 *	- method: the method to use: POST, PUT. Default: GET, what else.
 *	- body: the contents to send along a POST or PUT request.
 *	- contentType: the MIME type to use for the body, default text/plain.
 *	- requestsPerSecond: how many requests per second per client.
 *	- agent: if true, then use connection keep-alive and http agents.
 *	- agentKeepAlive: if true, then use a special agent with keep-alive.
 *	- debug: show debug messages.
 *	- quiet: do not log any messages.
 *	- insecure: allow https using self-signed certs.
 * An optional callback will be called if/when the test finishes.
 * In this case the quiet option is enabled.
 */
exports.loadTest = function(options, callback)
{
	var constructor;
	if (!options.url)
	{
		log.error('Missing URL in options');
		return;
	}
	if (options.url.startsWith('http:') || options.url.startsWith('https:'))
	{
		constructor = HttpClient;
	}
	else
	{
		log.error('Invalid URL %s, must be http:// or https://', options.url);
		return;
	}
	options.concurrency = options.concurrency || 1;
	if (options.debug)
	{
		log.level = Log.DEBUG;
	}
	if (callback)
	{
		options.quiet = true;
	}
	if (options.headers)
	{
		options.headers = headers.convert(options.headers);
	}
	var operation = new Operation(options, constructor, callback);
	operation.start();
};

/**
 * A load test operation.
 */
var Operation = function(options, Constructor, callback)
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

	/**
	 * Start the operation.
	 */
	self.start = function()
	{
		self.latency = new timing.Latency(options);
		startClients();
		if (options.maxSeconds)
		{
			stopTimeout = setTimeout(stop, options.maxSeconds * 1000);
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
				stop();
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
			}
			var client = new Constructor(self, options);
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
	function stop()
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
			callback(null, self.latency.getResults());
		}
	}
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
 * Run all tests.
 */
exports.test = function(callback)
{
	testing.run([testMaxSeconds], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}


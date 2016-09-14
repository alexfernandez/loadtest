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
var websocket = require('websocket');
var Log = require('log');
var timing = require('./timing.js');
var headers = require('./headers.js');

// globals
var log = new Log('info');


/**
 * Create a new HTTP client.
 * Seem parameters below.
 */
exports.create = function(operation, params)
{
	return new HttpClient(operation, params);
};

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
	var generateMessage;

	function identity(arg)
	{
		return function() { return arg; };
	}

	// init
	init();

	/**
	 * Init options and message to send.
	 */
	function init()
	{
		options = urlLib.parse(params.url);
		options.headers = {};
		if (params.headers)
		{
			options.headers = params.headers;
		}
		if (params.cert && params.key)
		{
			options.cert = params.cert;
			options.key = params.key;
		}
		options.agent = false;
		if (params.agentKeepAlive)
		{
			var KeepAlive = (options.protocol == 'https:') ? require('agentkeepalive').HttpsAgent : require('agentkeepalive');
			var maxSockets = 10;
			if (params.requestsPerSecond)
			{
				maxSockets += Math.floor(params.requestsPerSecond);
			}
			options.agent = new KeepAlive({
				maxSockets: maxSockets,
				maxKeepAliveRequests: 0, // max requests per keepalive socket, default is 0, no limit
				maxKeepAliveTime: 30000  // keepalive for 30 seconds
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
				generateMessage = identity(params.body);
			}
			else if (typeof params.body == 'object')
			{
				log.debug('Received JSON body');
				generateMessage = identity(params.body);
			}
			else if (typeof params.body == 'function')
			{
				log.debug('Received function body');
				generateMessage = params.body;
			}
			else
			{
				log.error('Unrecognized body: %s', typeof params.body);
			}
			options.headers['Content-Type'] = params.contentType || 'text/plain';
		}
		if (params.cookies)
		{
			if (Array.isArray(params.cookies))
			{
				options.headers.Cookie =  params.cookies.join('; ');
			}
			else if (typeof params.cookies == 'string')
			{
				options.headers.Cookie = params.cookies;
			}
			else
			{
				console.error('Invalid cookies %j, please use an array or a string', params.cookies);
			}
		}
		headers.addUserAgent(options.headers);
		if (params.secureProtocol) {
			options.secureProtocol = params.secureProtocol;
		}
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
		var id = operation.latency.start();
		var requestFinished = getRequestFinisher(id);
		var lib = http;
		if (options.protocol == 'https:')
		{
			lib = https;
		}
		if (options.protocol == 'ws:')
		{
			lib = websocket;
		}
		// Disable certificate checking
		if (params.insecure === true)
		{
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		}
		var request, message;
		if (generateMessage)
		{
			message = generateMessage(id);
			if (typeof message === 'object')
			{
				message = JSON.stringify(message);
			}
			options.headers['Content-Length'] = Buffer.byteLength(message);
		}
		else
		{
			delete options.headers['Content-Length'];
		}
		if (typeof params.requestGenerator == 'function')
		{
			request = params.requestGenerator(params, options, lib.request, getConnect(id, requestFinished));
		}
		else
		{
			request = lib.request(options, getConnect(id, requestFinished));
		}
		if (params.hasOwnProperty('timeout'))
		{
			var timeout = parseInt(params.timeout);
			if (!timeout)
			{
				log.error('Invalid timeout %s', params.timeout);
			}
			request.setTimeout(timeout, function()
			{
				requestFinished('Connection timed out');
			});
		}
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
					errorCode = result.statusCode;
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

			var elapsed = operation.latency.end(id, errorCode);
			if (elapsed < 0)
			{
				// not found or not running
				return;
			}
			var index = operation.latency.getRequestIndex(id);
			if (result) {
				result.requestElapsed = elapsed;
				result.requestIndex = index;
				result.instanceIndex = operation.instanceIndex;
			}
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
		var body = '';
		return function(connection)
		{
			log.debug('HTTP client connected to %s with id %s', params.url, id);
			connection.setEncoding('utf8');
			connection.on('data', function(chunk)
			{
				log.debug('Body: %s', chunk);
				body += chunk;
			});
			connection.on('error', function(error)
			{
				callback('Connection ' + id + ' failed: ' + error, '1');
			});
			connection.on('end', function()
			{
				var result = {
					host: connection.connection._host,
					path: connection.req.path,
					method: connection.req.method,
					statusCode: connection.statusCode,
					body: body,
					headers: connection.headers,
				};
				if (connection.statusCode >= 400)
				{
					return callback('Status code ' + connection.statusCode, result);
				}
				callback(null, result);
			});
		};
	}
}

function testHttpClient(callback)
{
	var options = {
		url: 'http://localhost:7357/',
		maxSeconds: 0.1,
		concurrency: 1,
		quiet: true,
	};
	exports.create({}, options);
	testing.success(callback);
}


/**
 * Run all tests.
 */
exports.test = function(callback)
{
	testing.run([
		testHttpClient,
	], callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}


'use strict';

/**
 * Measure latency for a load test.
 * (C) 2013 Alex Fernández.
 */


// requires
var async = require('async');
var util = require('util');
var Log = require('log');
var microtime = require('microtime');
var prototypes = require('./prototypes.js');

// globals
var log = new Log('info');


/**
 * Latency measurements. Options can be:
 *	- seconds: how many seconds to measure before showing latency.
 *	- maxRequests: how many requests to make, alternative to seconds.
 *	- callback: function to call when there are measures.
 */
exports.Latency = function(options)
{
	// self-reference
	var self = this;

	// attributes
	var requests = {};
	var secondsMeasured = 5;
	var maxRequests = null;
	var totalRequests = 0;
	var totalTime = 0;
	var lastShown = microtime.now();
	var callback = null;

	// init
	if (options)
	{
		if (options.maxRequests)
		{
			maxRequests = options.maxRequests;
		}
		if (options.seconds)
		{
			secondsMeasured = options.seconds;
		}
		if (options.callback)
		{
			callback = options.callback;
		}
	}

	/**
	 * Start the request with the given id.
	 */
	self.start = function(requestId)
	{
		requestId = requestId || Math.floor(Math.random() * 0x100000000).toString(16);
		requests[requestId] = microtime.now();
		return requestId;
	}

	/**
	 * Compute elapsed time and add the measurement.
	 */
	self.end = function(requestId)
	{
		if (!(requestId in requests))
		{
			error('Message id ' + requestId + ' not found');
			return;
		}
		add(microtime.now() - requests[requestId]);
		delete requests[requestId];
	}

	/**
	 * Add a new measurement, possibly removing an old one.
	 */
	function add(value)
	{
		if (!secondsMeasured)
		{
			error('Please call init() with seconds to measure');
			return;
		}
		log.debug('New value: %s', value);
		totalTime += value;
		totalRequests++;
		log.debug('Total requests: %s', totalRequests);
		if (isFinished())
		{
			show();
		}
	}

	/**
	 * Show an error message, or send to the callback.
	 */
	function error(message)
	{
		if (callback)
		{
			callback(error, null);
			return;
		}
		log.error(message);
	}

	/**
	 * Check out if enough seconds have elapsed, or enough requests were received.
	 */
	function isFinished()
	{
		if (maxRequests)
		{
			return (totalRequests >= maxRequests);
		}
		var secondsElapsed = (microtime.now() - lastShown) / 1000000;
		return (secondsElapsed >= secondsMeasured);
	}

	/**
	 * Checks if enough seconds have elapsed, or enough requests received.
	 * Show latency for finished requests, or send to the callback.
	 */
	function show()
	{
		var secondsElapsed = (microtime.now() - lastShown) / 1000000;
		var meanTime = totalTime / totalRequests;
		var results = {
			meanLatencyMs: Math.round(meanTime / 10) / 100,
			rps: Math.round(totalRequests / secondsElapsed),
		}
		if (callback)
		{
			callback(null, results);
		}
		else
		{
			log.info('Requests / second: %s, mean latency: %s ms', results.rps, results.meanLatencyMs);
		}
		totalTime = 0;
		totalRequests = 0;
		if (secondsElapsed > 2 * secondsMeasured)
		{
			lastShown = microtime.now();
		}
		else
		{
			lastShown += secondsMeasured * 1000000;
		}
	}
}

/**
 * Test latency ids.
 */
function testLatencyIds(callback)
{
	var latency = new exports.Latency();
	var firstId = latency.start();
	if (!firstId)
	{
		return callback('Invalid first latency id');
	}
	var secondId = latency.start();
	if (!secondId)
	{
		return callback('Invalid second latency id');
	}
	if (firstId == secondId)
	{
		return callback('Repeated latency ids');
	}
	callback(null, true);
}

/**
 * Test latency measurements.
 */
function testLatencyRequests(callback)
{
	var measured = false;
	var options = {
		maxRequests: 10,
		callback: function(error, result)
		{
			measured = true;
			callback(error, result);
		},
	};
	var latency = new exports.Latency(options);
	for (var i = 0; i < 10; i++)
	{
		var id = latency.start();
		latency.end(id);
	}
	// give it time
	setTimeout(function()
	{
		if (!measured)
		{
			callback('Latency did not call back in 10 ms');
		}
	}, 10);
}

/**
 * A high resolution timer.
 * Initialize with milliseconds to wait and the callback to call.
 */
exports.HighResolutionTimer = function(delayMs, callback)
{
	// self-reference
	var self = this;

	// attributes
	var counter = 0;
	var start = Date.now();
	var active = true;

	/**
	 * Delayed running of the callback.
	 */
	function delayed()
	{
		if (!active)
		{
			return false;
		}
		callback();
		counter ++;
		var diff = (Date.now() - start) - counter * delayMs;
		setTimeout(delayed, delayMs - diff);
	}

	/**
	 * Show the drift of the timer.
	 */
	self.traceDrift = function()
	{
		var diff = Date.now() - start;
		var drift = diff / delayMs - counter;
		log.debug('Seconds: ' + Math.round(diff / 1000) + ', counter: ' + counter + ', drift: ' + drift);
	}

	/**
	 * Stop the timer.
	 */
	self.stop = function()
	{
		active = false;
	}

	// start timer
	delayed();
	setTimeout(delayed, delayMs);
}

/**
 * Test a high resolution timer.
 */
function testTimer(callback)
{
	var fired = false;
	var timer = new exports.HighResolutionTimer(10, function()
	{
		fired = true;
		callback(null, 'Timer fired');
	});
	timer.stop();
	// give it time
	setTimeout(function()
	{
		if (!fired)
		{
			callback('Timer did not fire in 20 ms');
		}
	}, 20);
}

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = {
		latencyIds: testLatencyIds,
		latencyRequests: testLatencyRequests,
		timer: testTimer,
	};
	async.series(tests, callback);
}

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(function(error, result)
	{
		if (error)
		{
			log.error('Tests failed: %s', error);
			return;
		}
		log.info('Tests succesful');
	});
}


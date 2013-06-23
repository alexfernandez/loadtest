'use strict';

/**
 * Measure latency for a load test.
 * (C) 2013 Alex Fernández.
 */


// requires
var Log = require('log');
var microtime = require('microtime');
var prototypes = require('./prototypes.js');

// globals
var log = new Log('info');


/**
 * Latency measurements, global variable.
 */
exports.latency = new function()
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

	/**
	 * Initialize. Options can be:
	 *	- seconds: how many seconds to measure before showing latency.
	 *	- maxRequests: how many requests to make, alternative to seconds.
	 *	- callback: function to call when there are measures.
	 */
	self.init = function(options)
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
		var secondsElapsed = (microtime.now() - lastShown) / 1000000;
		if (secondsElapsed >= secondsMeasured)
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
	 * Show latency for finished requests, or send to the callback.
	 */
	function show()
	{
		var results = {
			meanTime: totalTime / totalRequests,
			meanLatency: Math.round(meanTime / 10) / 100,
			rps: Math.round(totalRequests / secondsElapsed),
		}
		if (callback)
		{
			callback(null, results);
		}
		else
		{
			log.info('Requests / second: %s, mean latency: %s ms', results.rps, results.meanLatency);
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

	/**
	 * Delayed running of the callback.
	 */
	function delayed()
	{
		callback(delayMs);
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

	// start timer
	delayed();
	setTimeout(delayed, delayMs);
}

/**
 * Run package tests.
 */
exports.test = function()
{
	var firstId = exports.latency.start();
	if (!firstId)
	{
		log.error('Invalid first latency id');
		return false;
	}
	var secondId = exports.latency.start();
	if (!secondId)
	{
		log.error('Invalid second latency id');
		return false;
	}
	if (firstId == secondId)
	{
		log.error('Repeated latency ids');
		return false;
	}
	return true;
}

// run tests if invoked directly
if (__filename == process.argv[1])
{
	    exports.test();     
}


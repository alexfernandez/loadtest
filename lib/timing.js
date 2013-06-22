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
	var totalRequests = 0;
	var totalTime = 0;
	var lastShown = microtime.now();

	/**
	 * Initialize with seconds measured.
	 */
	self.init = function(seconds)
	{
		secondsMeasured = seconds;
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
			log.error('Message id ' + requestId + ' not found');
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
			log.error('Please call init() with seconds to measure');
			return;
		}
		log.debug('New value: %s', value);
		totalTime += value;
		totalRequests++;
		log.debug('Total requests: %s', totalRequests);
		var secondsElapsed = (microtime.now() - lastShown) / 1000000;
		if (secondsElapsed >= secondsMeasured)
		{
			var meanTime = totalTime / totalRequests;
			var rps = Math.round(totalRequests / secondsElapsed);
			log.info('Requests / second: %s, mean latency: %s ms', rps, Math.round(meanTime / 10) / 100);
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
		callback(delay);
		counter ++;
		var diff = (Date.now() - start) - counter * delay;
		setTimeout(delayed, delay - diff);
	}

	/**
	 * Show the drift of the timer.
	 */
	self.traceDrift = function()
	{
		var diff = Date.now() - start;
		var drift = diff / delay - counter;
		log.debug('Seconds: ' + Math.round(diff / 1000) + ', counter: ' + counter + ', drift: ' + drift);
	}

	// start timer
	delayed();
	setTimeout(delayed, delay);
}


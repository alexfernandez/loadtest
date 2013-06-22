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
var latency = new function()
{
	// self-reference
	var self = this;

	// attributes
	var requests = {};
	var measurements = [];
	var index = 0;
	var lastShown = microtime.now();
	var maxRequests;
	var totalTime = 0;

	/**
	 * Initialize with concurrency, requests per second and seconds.
	 */
	self.init = function(concurrency, requestsPerSecond, secondsMeasured)
	{
		maxRequests = concurrency * requestsPerSecond * secondsMeasured;
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
		if (!maxRequests)
		{
			log.error('Please call init() with concurrency level, requests per second and seconds to measure');
			return;
		}
		log.debug('New value: %s', value);
		measurements.push(value);
		totalTime += value;
		if (measurements.length > maxRequests)
		{
			var removed = measurements.shift();
			totalTime -= removed;
		}
		index++;
		log.debug('Index: %s, maxmax %s', index, maxRequests);
		if (index > maxRequests)
		{
			var meanTime = totalTime / measurements.length;
			var secondsElapsed = (microtime.now() - lastShown) / 1000000;
			var rps = Math.round(index / secondsElapsed);
			log.info('Requests / second: %s, mean latency: %s ms', rps, Math.round(meanTime / 10) / 100);
			index = 0;
			lastShown = microtime.now();
		}
	}
}

// copy everything in exports
for (var name in latency)
{
	exports[name] = latency[name];
}


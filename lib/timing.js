'use strict';

/**
 * Measure latency for a load test.
 * (C) 2013 Alex Fernández.
 */


// requires
var testing = require('testing');
var util = require('util');
var Log = require('log');
var microtime = require('microtime');
var prototypes = require('./prototypes.js');

// globals
var log = new Log('info');


/**
 * Latency measurements. Options can be:
 *	- showSeconds: how many seconds to measure before showing latency.
 *	- showRequests: how many requests to make, alternative to seconds.
 *	- maxRequests: max number of requests to measure before stopping.
 *	- maxSeconds: max seconds, alternative to max requests.
 * An optional callback(error, results) will be called with an error,
 * or the results after max is reached.
 */
exports.Latency = function(options, callback)
{
	// self-reference
	var self = this;

	// attributes
	var requests = {};
	var showSeconds = options.showSeconds || 5;
	var partialRequests = 0;
	var partialTime = 0;
	var lastShown = microtime.now();
	var initialTime = microtime.now();
	var totalRequests = 0;
	var totalTime = 0;
	var maxLatencyMs = 0;
	var histogramMs = {};
	var running = true;

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
		if (!running)
		{
			return;
		}
		add(microtime.now() - requests[requestId]);
		delete requests[requestId];
	}

	/**
	 * Add a new measurement, possibly removing an old one.
	 */
	function add(time)
	{
		log.debug('New value: %s', time);
		partialTime += time;
		partialRequests++;
		totalTime += time;
		totalRequests++;
		log.debug('Partial requests: %s', partialRequests);
		var rounded = Math.floor(time / 1000);
		if (rounded > maxLatencyMs)
		{
			maxLatencyMs = rounded;
		}
		if (!histogramMs[rounded])
		{
			log.debug('Initializing histogram for %s', rounded);
			histogramMs[rounded] = 0;
		}
		histogramMs[rounded] += 1;
		showPartial();
		if (isFinished())
		{
			finish();
		}
	}

	/**
	 * Check out if enough seconds have elapsed, or enough requests were received.
	 * If so, show latency for partial requests.
	 */
	function showPartial()
	{
		if (options.showRequests && partialRequests < options.showRequests)
		{
			return;
		}
		var elapsedSeconds = (microtime.now() - lastShown) / 1000000;
		if (elapsedSeconds < showSeconds)
		{
			return;
		}
		var meanTime = partialTime / partialRequests;
		var results = {
			meanLatencyMs: Math.round(meanTime / 10) / 100,
			rps: Math.round(partialRequests / elapsedSeconds),
		}
		var percent = '';
		if (options.maxRequests)
		{
			var percent = ' (' + Math.round(100 * totalRequests / options.maxRequests) + '%)';
		}
		log.info('Requests: %s%s, requests per second: %s, mean latency: %s ms', totalRequests, percent, results.rps, results.meanLatencyMs);
		partialTime = 0;
		partialRequests = 0;
		if (elapsedSeconds > 2 * showSeconds)
		{
			lastShown = microtime.now();
		}
		else
		{
			lastShown += showSeconds * 1000000;
		}
	}

	/**
	 * Check out if the measures are finished.
	 */
	function isFinished()
	{
		log.debug('Total requests %s, max requests: %s', totalRequests, options.maxRequests);
		if (options.maxRequests && totalRequests >= options.maxRequests)
		{
			log.debug('Max requests reached: %s', totalRequests);
			return true;
		}
		var elapsedSeconds = (microtime.now() - initialTime) / 1000000;
		if (options.maxSeconds && elapsedSeconds >= maxSeconds)
		{
			log.debug('Max seconds reached: %s', totalRequests);
			return true;
		}
		return false;
	}

	/**
	 * We are finished.
	 */
	function finish()
	{
		running = false;
		if (callback)
		{
			return callback(null, self.getResults());
		}
		self.show();
	}

	/**
	 * Get final results.
	 */
	self.getResults = function()
	{
		var elapsedSeconds = (microtime.now() - initialTime) / 1000000;
		var meanTime = totalTime / totalRequests;
		return {
			totalRequests: totalRequests,
			totalTimeSeconds: elapsedSeconds,
			rps: Math.round(totalRequests / elapsedSeconds),
			meanLatencyMs: Math.round(meanTime / 10) / 100,
		}
	}

	/**
	 * Compute the percentiles.
	 */
	self.computePercentiles = function()
	{
		log.debug('Histogram: %s', util.inspect(histogramMs));
		var percentiles = {
			50: false,
			90: false,
			95: false,
			99: false,
		};
		var counted = 0;
		for (var ms = 0; ms <= maxLatencyMs; ms++)
		{
			if (!histogramMs[ms])
			{
				continue;
			}
			log.debug('Histogram for %s: %s', ms, histogramMs[ms]);
			counted += histogramMs[ms];
			var percent = counted / totalRequests * 100;
			for (var percentile in percentiles)
			{
				log.debug('Checking percentile %s for %s', percentile, percent);
				if (!percentiles[percentile] && percent > percentile)
				{
					percentiles[percentile] = ms;
				}
			}
		}
		return percentiles;
	}

	/**
	 * Show final results.
	 */
	self.show = function()
	{
		var results = self.getResults();
		log.info('');
		log.info('Completed requests:  %s', results.totalRequests);
		log.info('Total time:          %s s', results.totalTimeSeconds);
		log.info('Requests per second: %s', results.rps);
		log.info('Mean latency:        %s ms', results.meanLatencyMs);
		log.info('');
		log.info('Percentage of the requests served within a certain time');
		var percentiles = self.computePercentiles();
		for (var percentile in percentiles)
		{
			log.info('  %s%      %s ms', percentile, percentiles[percentile]);
		}
		log.info(' 100%      %s ms (longest request)', maxLatencyMs);
	}
}

/**
 * Test latency ids.
 */
function testLatencyIds(callback)
{
	var latency = new exports.Latency({});
	var firstId = latency.start();
	testing.assert(firstId, 'Invalid first latency id', callback);
	var secondId = latency.start();
	testing.assert(secondId, 'Invalid second latency id', callback);
	testing.assert(firstId != secondId, 'Repeated latency ids', callback);
	testing.success(callback);
}

/**
 * Test latency measurements.
 */
function testLatencyRequests(callback)
{
	var options = {
		maxRequests: 10,
	};
	var latency = new exports.Latency(options, callback);
	for (var i = 0; i < 10; i++)
	{
		var id = latency.start();
		latency.end(id);
	}
}

/**
 * Check that percentiles are correct.
 */
function testLatencyPercentiles(callback)
{
	var options = {
		maxRequests: 10,
	};
	var latency = new exports.Latency(options, function(error, result)
	{
		var percentiles = latency.computePercentiles();
		for (var percentile in percentiles)
		{
			testing.assert(percentiles[percentile] !== false, 'Empty percentile for %s', percentile, callback);
		}
		testing.success(percentiles, callback);
	});
	for (var ms = 1; ms <= 10; ms++)
	{
		log.debug('Starting %s', ms);
		(function() {
			var id = latency.start();
			setTimeout(function()
			{
				log.debug('Ending %s', id);
				latency.end(id);
			}, ms);
		})();
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
	var timer = new exports.HighResolutionTimer(10, callback);
	timer.stop();
}

/**
 * Run package tests.
 */
exports.test = function(callback)
{
	var tests = {
		latencyIds: testLatencyIds,
		latencyRequests: testLatencyRequests,
		latencyPercentiles: testLatencyPercentiles,
		timer: testTimer,
	};
	testing.run(tests, callback);
}

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}


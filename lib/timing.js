'use strict';

/**
 * Measure latency for a load test.
 * (C) 2013 Alex Fernández.
 */


// requires
require('prototypes');
var testing = require('testing');
var util = require('util');
var crypto = require('crypto');
var Log = require('log');

// globals
var log = new Log('info');


/**
 * Latency measurements. Options can be:
 *	- maxRequests: max number of requests to measure before stopping.
 *	- maxSeconds: max seconds, alternative to max requests.
 *	- quiet: do not log messages.
 * An optional callback(error, results) will be called with an error,
 * or the results after max is reached.
 */
exports.Latency = function(options, callback)
{
	// self-reference
	var self = this;

	// attributes
	var requests = {};
	var partialRequests = 0;
	var partialTime = 0;
	var partialErrors = 0;
	var lastShown = getTime();
	var initialTime = getTime();
	var totalRequests = 0;
	var totalTime = 0;
	var totalErrors = 0;
	var maxLatencyMs = 0;
	var minLatencyMs = 999999;
	var histogramMs = {};
	var errorCodes = {};
	var running = true;
	var totalsShown = false;

	var requestIndex = 0;
	var requestIdToIndex = {};

	// init
	if (options.quiet)
	{
		log.level = Log.NOTICE;
	}
	if (options.debug)
	{
		log.level = Log.DEBUG;
	}

	/**
	 * Return the index of the request. This is useful for determining the order
	 * in which requests returned values.
	 */
	self.getRequestIndex = function(requestId)
	{
		return requestIdToIndex[requestId];
	};

	/**
	 * Start the request with the given id.
	 */
	self.start = function(requestId)
	{
		requestId = requestId || createId();
		requests[requestId] = getTime();
		requestIdToIndex[requestId] = requestIndex++;
		return requestId;
	};

	/**
	 * Compute elapsed time and add the measurement.
	 * Accepts an optional error code signaling an error.
	 */
	self.end = function(requestId, errorCode)
	{
		if (!(requestId in requests))
		{
			log.debug('Message id ' + requestId + ' not found');
			return -2;
		}
		if (!running)
		{
			return -1;
		}
		var elapsed = getElapsed(requests[requestId]);
		add(elapsed, errorCode);
		delete requests[requestId];
		return elapsed;
	};

	/**
	 * Add a new measurement, possibly removing an old one.
	 * Accepts an optional error code signaling an error.
	 */
	function add(time, errorCode)
	{
		log.debug('New value: %s', time);
		partialTime += time;
		partialRequests++;
		totalTime += time;
		totalRequests++;
		if (errorCode)
		{
			errorCode = '' + errorCode;
			partialErrors++;
			totalErrors++;
			if (!(errorCode in errorCodes))
			{
				errorCodes[errorCode] = 0;
			}
			errorCodes[errorCode] += 1;
		}
		log.debug('Partial requests: %s', partialRequests);
		var rounded = Math.floor(time);
		if (rounded > maxLatencyMs)
		{
			maxLatencyMs = rounded;
		}
		if (rounded < minLatencyMs)
		{
			minLatencyMs = rounded;
		}
		if (!histogramMs[rounded])
		{
			log.debug('Initializing histogram for %s', rounded);
			histogramMs[rounded] = 0;
		}
		histogramMs[rounded] += 1;
		if (isFinished())
		{
			finish();
		}
	}

	/**
	 * Show latency for partial requests.
	 */
	self.showPartial = function()
	{
		var elapsedSeconds = getElapsed(lastShown) / 1000;
		var meanTime = partialTime / partialRequests || 0.0;
		var results = {
			meanLatencyMs: Math.round(meanTime * 10) / 10,
			rps: Math.round(partialRequests / elapsedSeconds)
		};
		var percent = '';
		if (options.maxRequests)
		{
			percent = ' (' + Math.round(100 * totalRequests / options.maxRequests) + '%)';
		}
		log.info('Requests: %s%s, requests per second: %s, mean latency: %s ms', totalRequests, percent, results.rps, results.meanLatencyMs);
		if (totalErrors)
		{
			percent = Math.round(100 * 10 * totalErrors / totalRequests) / 10;
			log.info('Errors: %s, accumulated errors: %s, %s% of total requests', partialErrors, totalErrors, percent);
		}
		partialTime = 0;
		partialRequests = 0;
		partialErrors = 0;
		lastShown = getTime();
	};

	/**
	 * Returns the current high-resolution real time in a [seconds, nanoseconds] tuple Array
	 * @return {*}
	 */
	function getTime() {
		return process.hrtime();
	}

	/**
	 * calculates the elapsed time between the assigned startTime and now
	 * @param startTime
	 * @return {Number} the elapsed time in milliseconds
	 */
	function getElapsed(startTime) {
		var elapsed = process.hrtime(startTime);
		return elapsed[0] * 1000 + elapsed[1] / 1000000;
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
		var elapsedSeconds = getElapsed(initialTime) / 1000;
		if (options.maxSeconds && elapsedSeconds >= options.maxSeconds)
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
		var elapsedSeconds = getElapsed(initialTime) / 1000;
		var meanTime = totalTime / totalRequests;
		return {
			totalRequests: totalRequests,
			totalErrors: totalErrors,
			totalTimeSeconds: elapsedSeconds,
			rps: Math.round(totalRequests / elapsedSeconds),
			meanLatencyMs: Math.round(meanTime * 10) / 10,
			maxLatencyMs: maxLatencyMs,
			minLatencyMs: minLatencyMs,
			percentiles: self.computePercentiles(),
			errorCodes: errorCodes
		};
	};

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
			99: false
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

			Object.keys(percentiles).forEach(function(percentile) {
				log.debug('Checking percentile %s for %s', percentile, percent);
				if (!percentiles[percentile] && percent > percentile)
				{
					percentiles[percentile] = ms;
				}
			});
		}
		return percentiles;
	};

	/**
	 * Show final results.
	 */
	self.show = function()
	{
		if (totalsShown)
		{
			return;
		}
		totalsShown = true;
		var results = self.getResults();
		log.info('');
		log.info('Target URL:          %s', options.url);
		if (options.maxRequests)
		{
			log.info('Max requests:        %s', options.maxRequests);
		}
		else if (options.maxSeconds)
		{
			log.info('Max time (s):        %s', options.maxSeconds);
		}
		log.info('Concurrency level:   %s', options.concurrency);
		var agent = 'none';
		if (options.agentKeepAlive)
		{
			agent = 'keepalive';
		}
		log.info('Agent:               %s', agent);
		if (options.requestsPerSecond)
		{
			log.info('Requests per second: %s', options.requestsPerSecond * options.concurrency);
		}
		log.info('');
		log.info('Completed requests:  %s', results.totalRequests);
		log.info('Total errors:        %s', results.totalErrors);
		log.info('Total time:          %s s', results.totalTimeSeconds);
		log.info('Requests per second: %s', results.rps);
		log.info('Mean latency:        %s ms', results.meanLatencyMs);
		log.info('');
		log.info('Percentage of the requests served within a certain time');

		Object.keys(results.percentiles).forEach(function(percentile) {
			log.info('  %s%      %s ms', percentile, results.percentiles[percentile]);
		});

		log.info(' 100%      %s ms (longest request)', maxLatencyMs);
		if (results.totalErrors)
		{
			log.info('');
			log.info(' 100%      %s ms (longest request)', maxLatencyMs);
			log.info('');
			Object.keys(results.errorCodes).forEach(function(errorCode)
			{
				var padding = ' '.repeat(4 - errorCode.length);
				log.info(' %s%s:   %s errors', padding, errorCode, results.errorCodes[errorCode]);
			});
		}
	};
};


/**
 * Create a unique, random token.
 */
function createId()
{
	var value = '' + Date.now() + Math.random();
	var hash = crypto.createHash('sha256');
	return hash.update(value).digest('hex').toLowerCase();
}

/**
 * Test latency ids.
 */
function testLatencyIds(callback)
{
	var latency = new exports.Latency({});
	var firstId = latency.start();
	testing.assert(firstId, 'Invalid first latency id %s', firstId, callback);
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
	var errorCode = '500';
	var latency = new exports.Latency(options, function(error, result)
	{
		testing.check(error, 'Could not compute latency', callback);
		testing.assertEquals(result.totalRequests, 10, 'Invalid total requests', callback);
		testing.assertEquals(result.totalErrors, 1, 'Invalid total errors', callback);
		testing.assert(errorCode in result.errorCodes, 'Error code not found', callback);
		testing.assertEquals(result.errorCodes[errorCode], 1, 'Should have one ' + errorCode, callback);
		testing.success(callback);
	});
	var id;
	for (var i = 0; i < 9; i++)
	{
		id = latency.start();
		latency.end(id);
	}
	id = latency.start();
	latency.end(id, errorCode);
}

/**
 * Check that percentiles are correct.
 */
function testLatencyPercentiles(callback)
{
	var options = {
		maxRequests: 10
	};
	var latency = new exports.Latency(options, function(error)
	{
		testing.check(error, 'Error while testing latency percentiles', callback);
		var percentiles = latency.getResults().percentiles;

		Object.keys(percentiles).forEach(function(percentile) {
			testing.assert(percentiles[percentile] !== false, 'Empty percentile for %s', percentile, callback);
		});

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
 * A high resolution timer. Params:
 *	- delayMs: miliseconds to wait before calls. Can be fractional.
 *	- callback: function to call every time.
 */
exports.HighResolutionTimer = function(delayMs, callback)
{
	// self-reference
	var self = this;

	// attributes
	var counter = 0;
	var start = Date.now();
	var active = true;
	var timer;

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
		var timeout = Math.floor(delayMs - diff);
		if (timeout <= 0)
		{
			return delayed();
		}
		timer = setTimeout(delayed, delayMs - diff);
	}

	/**
	 * Show the drift of the timer.
	 */
	self.traceDrift = function()
	{
		var diff = Date.now() - start;
		var drift = diff / delayMs - counter;
		log.debug('Seconds: ' + Math.round(diff / 1000) + ', counter: ' + counter + ', drift: ' + drift);
	};

	/**
	 * Stop the timer.
	 */
	self.stop = function()
	{
		active = false;
		if (timer)
		{
			clearTimeout(timer);
			timer = null;
		}
	};

	// start timer
	delayed();
	timer = setTimeout(delayed, delayMs);
};

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
	var tests = [
		testLatencyIds,
		testLatencyRequests,
		testLatencyPercentiles,
		testTimer
	];
	testing.run(tests, callback);
};

// run tests if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}


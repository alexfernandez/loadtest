'use strict';

/**
 * Measure latency for a load test.
 * (C) 2013 Alex Fernández.
 */


// requires
const testing = require('testing');
const util = require('util');
const crypto = require('crypto');
const Log = require('log');

// globals
const log = new Log('info');


/**
 * Latency measurements. Options can be:
 *	- maxRequests: max number of requests to measure before stopping.
 *	- maxSeconds: max seconds, alternative to max requests.
 *	- quiet: do not log messages.
 * An optional callback(error, results) will be called with an error,
 * or the results after max is reached.
 */
class Latency {
	constructor(options, callback) {
		this.options = options
		this.callback = callback
		this.requests = {};
		this.partialRequests = 0;
		this.partialTime = 0;
		this.partialErrors = 0;
		this.lastShown = this.getTime();
		this.initialTime = this.getTime();
		this.totalRequests = 0;
		this.totalTime = 0;
		this.totalErrors = 0;
		this.maxLatencyMs = 0;
		this.minLatencyMs = 999999;
		this.histogramMs = {};
		this.errorCodes = {};
		this.running = true;
		this.totalsShown = false;
		this.requestIndex = 0;
		this.requestIdToIndex = {};
		if (options.quiet) {
			log.level = Log.NOTICE;
		}
		if (options.debug) {
			log.level = Log.DEBUG;
		}
	}

	/**
	 * Return the index of the request. This is useful for determining the order
	 * in which requests returned values.
	 */
	getRequestIndex(requestId) {
		return this.requestIdToIndex[requestId];
	}

	/**
	 * Start the request with the given id.
	 */
	start(requestId) {
		requestId = requestId || createId();
		this.requests[requestId] = this.getTime();
		this.requestIdToIndex[requestId] = this.requestIndex++;
		return requestId;
	}

	/**
	 * Compute elapsed time and add the measurement.
	 * Accepts an optional error code signaling an error.
	 */
	end(requestId, errorCode) {
		if (!(requestId in this.requests)) {
			log.debug('Message id ' + requestId + ' not found');
			return -2;
		}
		if (!this.running) {
			return -1;
		}
		const elapsed = this.getElapsed(this.requests[requestId]);
		this.add(elapsed, errorCode);
		delete this.requests[requestId];
		return elapsed;
	}

	/**
	 * Add a new measurement, possibly removing an old one.
	 * Accepts an optional error code signaling an error.
	 */
	add(time, errorCode) {
		log.debug('New value: %s', time);
		this.partialTime += time;
		this.partialRequests++;
		this.totalTime += time;
		this.totalRequests++;
		if (errorCode) {
			errorCode = '' + errorCode;
			this.partialErrors++;
			this.totalErrors++;
			if (!(errorCode in this.errorCodes)) {
				this.errorCodes[errorCode] = 0;
			}
			this.errorCodes[errorCode] += 1;
		}
		log.debug('Partial requests: %s', this.partialRequests);
		const rounded = Math.floor(time);
		if (rounded > this.maxLatencyMs) {
			this.maxLatencyMs = rounded;
		}
		if (rounded < this.minLatencyMs) {
			this.minLatencyMs = rounded;
		}
		if (!this.histogramMs[rounded]) {
			log.debug('Initializing histogram for %s', rounded);
			this.histogramMs[rounded] = 0;
		}
		this.histogramMs[rounded] += 1;
		if (this.isFinished()) {
			this.finish();
		}
	}

	/**
	 * Show latency for partial requests.
	 */
	showPartial() {
		const elapsedSeconds = this.getElapsed(this.lastShown) / 1000;
		const meanTime = this.partialTime / this.partialRequests || 0.0;
		const results = {
			meanLatencyMs: Math.round(meanTime * 10) / 10,
			rps: Math.round(this.partialRequests / elapsedSeconds)
		};
		let percent = '';
		if (this.options.maxRequests) {
			percent = ' (' + Math.round(100 * this.totalRequests / this.options.maxRequests) + '%)';
		}
		log.info('Requests: %s%s, requests per second: %s, mean latency: %s ms', this.totalRequests, percent, results.rps, results.meanLatencyMs);
		if (this.totalErrors) {
			percent = Math.round(100 * 10 * this.totalErrors / this.totalRequests) / 10;
			log.info('Errors: %s, accumulated errors: %s, %s% of total requests', this.partialErrors, this.totalErrors, percent);
		}
		this.partialTime = 0;
		this.partialRequests = 0;
		this.partialErrors = 0;
		this.lastShown = this.getTime();
	}

	/**
	 * Returns the current high-resolution real time in a [seconds, nanoseconds] tuple Array
	 * @return {*}
	 */
	getTime() {
		return process.hrtime();
	}

	/**
	 * calculates the elapsed time between the assigned startTime and now
	 * @param startTime
	 * @return {Number} the elapsed time in milliseconds
	 */
	getElapsed(startTime) {
		const elapsed = process.hrtime(startTime);
		return elapsed[0] * 1000 + elapsed[1] / 1000000;
	}

	/**
	 * Check out if the measures are finished.
	 */
	isFinished() {
		log.debug('Total requests %s, max requests: %s', this.totalRequests, this.options.maxRequests);
		if (this.options.maxRequests && this.totalRequests >= this.options.maxRequests) {
			log.debug('Max requests reached: %s', this.totalRequests);
			return true;
		}
		const elapsedSeconds = this.getElapsed(this.initialTime) / 1000;
		if (this.options.maxSeconds && elapsedSeconds >= this.options.maxSeconds) {
			log.debug('Max seconds reached: %s', this.totalRequests);
			return true;
		}
		return false;
	}

	/**
	 * We are finished.
	 */
	finish() {
		this.running = false;
		if (this.callback) {
			return this.callback(null, this.getResults());
		}
		this.show();
	}

	/**
	 * Get final results.
	 */
	getResults() {
		const elapsedSeconds = this.getElapsed(this.initialTime) / 1000;
		const meanTime = this.totalTime / this.totalRequests;
		return {
			totalRequests: this.totalRequests,
			totalErrors: this.totalErrors,
			totalTimeSeconds: elapsedSeconds,
			rps: Math.round(this.totalRequests / elapsedSeconds),
			meanLatencyMs: Math.round(meanTime * 10) / 10,
			maxLatencyMs: this.maxLatencyMs,
			minLatencyMs: this.minLatencyMs,
			percentiles: this.computePercentiles(),
			errorCodes: this.errorCodes
		};
	}

	/**
	 * Compute the percentiles.
	 */
	computePercentiles() {
		log.debug('Histogram: %s', util.inspect(this.histogramMs));
		const percentiles = {
			50: false,
			90: false,
			95: false,
			99: false
		};
		let counted = 0;

		for (let ms = 0; ms <= this.maxLatencyMs; ms++) {
			if (!this.histogramMs[ms]) {
				continue;
			}
			log.debug('Histogram for %s: %s', ms, this.histogramMs[ms]);
			counted += this.histogramMs[ms];
			const percent = counted / this.totalRequests * 100;

			Object.keys(percentiles).forEach(percentile => {
				log.debug('Checking percentile %s for %s', percentile, percent);
				if (!percentiles[percentile] && percent > percentile) {
					percentiles[percentile] = ms;
				}
			});
		}
		return percentiles;
	}

	/**
	 * Show final results.
	 */
	show() {
		if (this.totalsShown) {
			return;
		}
		this.totalsShown = true;
		const results = this.getResults();
		log.info('');
		log.info('Target URL:          %s', this.options.url);
		if (this.options.maxRequests) {
			log.info('Max requests:        %s', this.options.maxRequests);
		} else if (this.options.maxSeconds) {
			log.info('Max time (s):        %s', this.options.maxSeconds);
		}
		log.info('Concurrency level:   %s', this.options.concurrency);
		let agent = 'none';
		if (this.options.agentKeepAlive) {
			agent = 'keepalive';
		}
		log.info('Agent:               %s', agent);
		if (this.options.requestsPerSecond) {
			log.info('Requests per second: %s', this.options.requestsPerSecond * this.options.concurrency);
		}
		log.info('');
		log.info('Completed requests:  %s', results.totalRequests);
		log.info('Total errors:        %s', results.totalErrors);
		log.info('Total time:          %s s', results.totalTimeSeconds);
		log.info('Requests per second: %s', results.rps);
		log.info('Mean latency:        %s ms', results.meanLatencyMs);
		log.info('');
		log.info('Percentage of the requests served within a certain time');

		Object.keys(results.percentiles).forEach(percentile => {
			log.info('  %s%      %s ms', percentile, results.percentiles[percentile]);
		});

		log.info(' 100%      %s ms (longest request)', this.maxLatencyMs);
		if (results.totalErrors) {
			log.info('');
			log.info(' 100%      %s ms (longest request)', this.maxLatencyMs);
			log.info('');
			Object.keys(results.errorCodes).forEach(errorCode => {
				const padding = ' '.repeat(4 - errorCode.length);
				log.info(' %s%s:   %s errors', padding, errorCode, results.errorCodes[errorCode]);
			});
		}
	}
}


/**
 * Create a unique, random token.
 */
function createId() {
	const value = '' + Date.now() + Math.random();
	const hash = crypto.createHash('sha256');
	return hash.update(value).digest('hex').toLowerCase();
}

/**
 * Test latency ids.
 */
function testLatencyIds(callback) {
	const latency = new Latency({});
	const firstId = latency.start();
	testing.assert(firstId, 'Invalid first latency id %s', firstId, callback);
	const secondId = latency.start();
	testing.assert(secondId, 'Invalid second latency id', callback);
	testing.assert(firstId != secondId, 'Repeated latency ids', callback);
	testing.success(callback);
}

/**
 * Test latency measurements.
 */
function testLatencyRequests(callback) {
	const options = {
		maxRequests: 10,
	};
	const errorCode = '500';
	const latency = new Latency(options, (error, result) => {
		testing.check(error, 'Could not compute latency', callback);
		testing.assertEquals(result.totalRequests, 10, 'Invalid total requests', callback);
		testing.assertEquals(result.totalErrors, 1, 'Invalid total errors', callback);
		testing.assert(errorCode in result.errorCodes, 'Error code not found', callback);
		testing.assertEquals(result.errorCodes[errorCode], 1, 'Should have one ' + errorCode, callback);
		testing.success(callback);
	});
	let id;
	for (let i = 0; i < 9; i++) {
		id = latency.start();
		latency.end(id);
	}
	id = latency.start();
	latency.end(id, errorCode);
}

/**
 * Check that percentiles are correct.
 */
function testLatencyPercentiles(callback) {
	const options = {
		maxRequests: 10
	};
	const latency = new Latency(options, error => {
		testing.check(error, 'Error while testing latency percentiles', callback);
		const percentiles = latency.getResults().percentiles;

		Object.keys(percentiles).forEach(percentile => {
			testing.assert(percentiles[percentile] !== false, 'Empty percentile for %s', percentile, callback);
		});

		testing.success(percentiles, callback);
	});
	for (let ms = 1; ms <= 10; ms++) {
		log.debug('Starting %s', ms);
		(function() {
			const id = latency.start();
			setTimeout(() => {
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
class HighResolutionTimer {

	/**
	 * Create a timer with the given delay.
	 * Important: will run once when started, then once every delayMs.
	 */
	constructor(delayMs, callback) {
		this.delayMs = delayMs
		this.callback = callback
		this.counter = 0;
		this.start = Date.now();
		this.active = true;
		// start timer
		setImmediate(() => this.delayed())
	}

	/**
	 * Delayed running of the callback.
	 */
	delayed() {
		if (!this.active) {
			return false;
		}
		this.callback();
		this.counter ++;
		const diff = (Date.now() - this.start) - (this.counter - 1) * this.delayMs;
		const timeout = Math.floor(this.delayMs - diff);
		if (timeout <= 0) {
			return setImmediate(() => this.delayed())
		}
		this.timer = setTimeout(() => this.delayed(), this.delayMs - diff);
	}

	/**
	 * Show the drift of the timer.
	 */
	traceDrift() {
		const diff = Date.now() - this.start;
		const drift = diff / this.delayMs - this.counter;
		log.debug('Seconds: ' + Math.round(diff / 1000) + ', counter: ' + this.counter + ', drift: ' + drift);
	}

	stop() {
		this.active = false;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	unref() {
		if (this.timer) {
			this.timer.unref()
		}
		return this
	}
}

/**
 * Test a high resolution timer.
 */
function testTimerStop(callback) {
	const timer = new HighResolutionTimer(10, callback);
	setImmediate(() => timer.stop())
}

function testTimerRun(callback) {
	let run = 0
	const timer = new HighResolutionTimer(100, () => run++)
	setTimeout(() => {
		testing.equals(run, 3, callback)
		timer.stop()
		testing.success(callback)
	}, 250)
}

/**
 * Run package tests.
 */
function test(callback) {
	const tests = [
		testLatencyIds,
		testLatencyRequests,
		testLatencyPercentiles,
		testTimerStop,
		testTimerRun,
	];
	testing.run(tests, callback);
}

module.exports = {
	Latency,
	HighResolutionTimer,
	test,
}

// run tests if invoked directly
if (__filename == process.argv[1]) {
	test(testing.show);
}


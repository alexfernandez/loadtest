import * as crypto from 'crypto'


/**
 * Latency measurements. Options can be:
 *	- maxRequests: max number of requests to measure before stopping.
 *	- maxSeconds: max seconds, alternative to max requests.
 * An optional callback(error, results) will be called with an error,
 * or the results after max is reached.
 */
export class Latency {
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
		const rounded = Math.floor(time);
		if (rounded > this.maxLatencyMs) {
			this.maxLatencyMs = rounded;
		}
		if (rounded < this.minLatencyMs) {
			this.minLatencyMs = rounded;
		}
		if (!this.histogramMs[rounded]) {
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
		console.info('Requests: %s%s, requests per second: %s, mean latency: %s ms', this.totalRequests, percent, results.rps, results.meanLatencyMs);
		if (this.totalErrors) {
			percent = Math.round(100 * 10 * this.totalErrors / this.totalRequests) / 10;
			console.info('Errors: %s, accumulated errors: %s, %s% of total requests', this.partialErrors, this.totalErrors, percent);
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
		if (this.options.maxRequests && this.totalRequests >= this.options.maxRequests) {
			return true;
		}
		const elapsedSeconds = this.getElapsed(this.initialTime) / 1000;
		if (this.options.maxSeconds && elapsedSeconds >= this.options.maxSeconds) {
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
			counted += this.histogramMs[ms];
			const percent = counted / this.totalRequests * 100;

			Object.keys(percentiles).forEach(percentile => {
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
		console.info('');
		console.info('Target URL:          %s', this.options.url);
		if (this.options.maxRequests) {
			console.info('Max requests:        %s', this.options.maxRequests);
		} else if (this.options.maxSeconds) {
			console.info('Max time (s):        %s', this.options.maxSeconds);
		}
		console.info('Concurrency level:   %s', this.options.concurrency);
		let agent = 'none';
		if (this.options.agentKeepAlive) {
			agent = 'keepalive';
		}
		console.info('Agent:               %s', agent);
		if (this.options.requestsPerSecond) {
			console.info('Requests per second: %s', this.options.requestsPerSecond * this.options.concurrency);
		}
		console.info('');
		console.info('Completed requests:  %s', results.totalRequests);
		console.info('Total errors:        %s', results.totalErrors);
		console.info('Total time:          %s s', results.totalTimeSeconds);
		console.info('Requests per second: %s', results.rps);
		console.info('Mean latency:        %s ms', results.meanLatencyMs);
		console.info('');
		console.info('Percentage of the requests served within a certain time');

		Object.keys(results.percentiles).forEach(percentile => {
			console.info('  %s%      %s ms', percentile, results.percentiles[percentile]);
		});

		console.info(' 100%      %s ms (longest request)', this.maxLatencyMs);
		if (results.totalErrors) {
			console.info('');
			console.info(' 100%      %s ms (longest request)', this.maxLatencyMs);
			console.info('');
			Object.keys(results.errorCodes).forEach(errorCode => {
				const padding = ' '.repeat(errorCode.length < 4 ? 4 - errorCode.length : 1);
				console.info(' %s%s:   %s errors', padding, errorCode, results.errorCodes[errorCode]);
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


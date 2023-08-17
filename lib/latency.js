import * as crypto from 'crypto'
import {showResult} from './show.js'


/**
 * Latency measurements. Options can be:
 *	- maxRequests: max number of requests to measure before stopping.
 *	- maxSeconds: max seconds, alternative to max requests.
 * An optional callback(error, result) will be called with an error,
 * or the result after max is reached.
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
		const result = {
			meanLatencyMs: Math.round(meanTime * 10) / 10,
			rps: Math.round(this.partialRequests / elapsedSeconds)
		};
		let percent = '';
		if (this.options.maxRequests) {
			percent = ' (' + Math.round(100 * this.totalRequests / this.options.maxRequests) + '%)';
		}
		if (!this.options.quiet) {
			console.info('Requests: %s%s, requests per second: %s, mean latency: %s ms', this.totalRequests, percent, result.rps, result.meanLatencyMs);
			if (this.totalErrors) {
				percent = Math.round(100 * 10 * this.totalErrors / this.totalRequests) / 10;
				console.info('Errors: %s, accumulated errors: %s, %s% of total requests', this.partialErrors, this.totalErrors, percent);
			}
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
			return this.callback(null, this.getResult());
		}
	}

	/**
	 * Get final result.
	 */
	getResult() {
		const result = new Result(this.options, this)
		return result
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
	 * Show final result.
	 */
	show() {
		if (this.totalsShown) {
			return;
		}
		this.totalsShown = true;
		const result = this.getResult();
		showResult(this.options, result)
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

class Result {
	constructor(options, latency) {
		this.options = options
		this.elapsedSeconds = latency.getElapsed(latency.initialTime) / 1000
		const meanTime = latency.totalTime / latency.totalRequests
		this.totalRequests = latency.totalRequests
		this.totalErrors = latency.totalErrors
		this.totalTimeSeconds = this.elapsedSeconds
		this.rps = Math.round(latency.totalRequests / this.elapsedSeconds)
		this.meanLatencyMs = Math.round(meanTime * 10) / 10
		this.maxLatencyMs = latency.maxLatencyMs
		this.minLatencyMs = latency.minLatencyMs
		this.percentiles = latency.computePercentiles()
		this.errorCodes = latency.errorCodes
	}

	show() {
		showResult(this.options, this)
	}
}


import * as crypto from 'crypto'
import {Result} from './result.js'


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
		this.lastShownNs = this.getTimeNs();
		this.startTimeNs = this.getTimeNs();
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
		this.requests[requestId] = this.getTimeNs();
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
		const elapsed = this.getElapsedMs(this.requests[requestId]);
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
		const elapsedSeconds = this.getElapsedMs(this.lastShownNs) / 1000;
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
		this.lastShownNs = this.getTimeNs();
	}

	/**
	 * Returns the current high-resolution real time in nanoseconds as a big int.
	 * @return {*}
	 */
	getTimeNs() {
		return process.hrtime.bigint();
	}

	/**
	 * Calculates the elapsed time between the assigned start time and now in ms.
	 * @param startTimeNs time in nanoseconds (bigint)
	 * @return {Number} the elapsed time in milliseconds
	 */
	getElapsedMs(startTimeNs) {
		const endTimeNs = this.getTimeNs()
		const elapsedNs = endTimeNs - startTimeNs
		return Number(elapsedNs / 1000000n)
	}

	/**
	 * Check out if the measures are finished.
	 */
	isFinished() {
		if (this.options.maxRequests && this.totalRequests >= this.options.maxRequests) {
			return true;
		}
		const elapsedSeconds = this.getElapsedMs(this.startTimeNs) / 1000;
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
		this.endTimeNs = this.getTimeNs()
		if (this.callback) {
			return this.callback(null, this.getResult());
		}
	}

	/**
	 * Get final result.
	 */
	getResult() {
		const result = new Result()
		result.compute(this.options, this)
		return result
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
		result.show()
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


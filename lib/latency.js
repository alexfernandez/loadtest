import {randomUUID} from 'crypto'
import {Result} from './result.js'
import microprofiler from 'microprofiler'


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
		this.requests = new Map();
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
	}

	/**
	 * Start the request with the given id.
	 */
	start(requestId) {
		const start = microprofiler.start()
		requestId = requestId || randomUUID();
		this.requests.set(requestId, this.getTimeNs())
		microprofiler.measureFrom(start, 'start', 10000)
		return requestId;
	}

	/**
	 * Compute elapsed time and add the measurement.
	 * Accepts an optional error code signaling an error.
	 */
	end(requestId, errorCode) {
		if (!this.requests.has(requestId)) {
			return -2;
		}
		if (!this.running) {
			return -1;
		}
		const elapsed = this.getElapsedMs(this.requests.get(requestId));
		this.add(elapsed, errorCode);
		this.requests.delete(requestId);
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
			errorCode = String(errorCode);
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
		const requestPercent = this.getRequestPercent()
		if (!this.options.quiet) {
			console.info('Requests: %s%s, requests per second: %s, mean latency: %s ms', this.totalRequests, requestPercent, result.rps, result.meanLatencyMs);
			if (this.totalErrors) {
				const errorPercent = Math.round(100 * 10 * this.totalErrors / this.totalRequests) / 10;
				console.info('Errors: %s, accumulated errors: %s, %s% of total requests', this.partialErrors, this.totalErrors, errorPercent);
			}
		}
		this.partialTime = 0;
		this.partialRequests = 0;
		this.partialErrors = 0;
		this.lastShownNs = this.getTimeNs();
	}

	getRequestPercent() {
		if (!this.options.maxRequests) {
			return ''
		}
		return ' (' + Math.round(100 * this.totalRequests / this.options.maxRequests) + '%)'
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


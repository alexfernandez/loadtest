import {randomUUID} from 'crypto'
import {Result} from './result.js'


/**
 * Latency measurements. Receives a load test instance, containing options which can be:
 *	- maxRequests: max number of requests to measure before stopping.
 *	- maxSeconds: max seconds, alternative to max requests.
 */
export class Latency {
	constructor(loadTest) {
		this.loadTest = loadTest
		this.options = loadTest.options
		this.requests = new Map();
		this.partialRequests = 0;
		this.partialTime = 0;
		this.partialErrors = 0;
		this.begunRequests = 0;
		this.totalRequests = 0
		this.lastShownNs = this.getTimeNs();
		this.startTimeNs = this.getTimeNs();
		this.totalTime = 0;
		this.totalErrors = 0;
		this.maxLatencyMs = 0;
		this.minLatencyMs = 999999;
		this.histogramMs = {};
		this.errorCodes = {};
		this.totalsShown = false;
	}

	/**
	 * Start the request with the given id.
	 */
	begin(requestId) {
		this.begunRequests += 1
		requestId = requestId || randomUUID();
		this.requests.set(requestId, this.getTimeNs())
		return requestId;
	}

	/**
	 * Compute elapsed time and add the measurement.
	 * Accepts an optional error code signaling an error.
	 */
	end(requestId, errorCode) {
		this.totalRequests += 1
		if (!this.requests.has(requestId)) {
			return -2;
		}
		if (!this.loadTest.running) {
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
	}

	/**
	 * Show latency for partial requests.
	 */
	showPartial() {
		const elapsedSeconds = this.getElapsedMs(this.lastShownNs) / 1000;
		if (elapsedSeconds < 1) {
			return
		}
		const meanTime = this.partialTime / this.partialRequests || 0.0;
		const result = {
			meanLatencyMs: Math.round(meanTime * 10) / 10,
			rps: Math.round(this.partialRequests / elapsedSeconds)
		};
		const requestPercent = this.getRequestPercent()
		if (!this.options.quiet) {
			console.info(`Requests: ${this.totalRequests}${requestPercent}, requests per second: ${result.rps}, mean latency: ${result.meanLatencyMs} ms`)
			if (this.totalErrors) {
				const errorPercent = Math.round(100 * 10 * this.totalErrors / this.totalRequests) / 10;
				console.info(`Errors: ${this.partialErrors}, accumulated errors: ${this.totalErrors}, ${errorPercent}% of total requests`)
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
		return ` (${Math.round(100 * this.totalRequests / this.options.maxRequests)}%)`
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
		const stopTimeNs = this.getTimeNs()
		const elapsedNs = stopTimeNs - startTimeNs
		return Number(elapsedNs / 1000000n)
	}

	shouldSend() {
		if (this.options.maxRequests && this.begunRequests >= this.options.maxRequests) {
			return false;
		}
		return true
	}

	shouldStop() {
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
	stop() {
		this.stopTimeNs = this.getTimeNs()
	}

	/**
	 * Get final result.
	 */
	getResult() {
		const result = new Result()
		result.compute(this)
		result.clients = this.loadTest.countClients()
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


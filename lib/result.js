

/**
 * Result of a load test.
 */
export class Result {
	constructor(options, latency) {
		// configuration
		this.url = options.url
		this.maxRequests = options.maxRequests
		this.maxSeconds = options.maxSeconds
		this.concurrency = options.concurrency
		this.agent = options.agentKeepAlive ? 'keepalive' : 'none';
		this.requestsPerSecond = options.requestsPerSecond
		// result
		this.elapsedSeconds = latency.getElapsed(latency.initialTime) / 1000
		this.totalRequests = latency.totalRequests
		this.totalErrors = latency.totalErrors
		this.totalTimeSeconds = this.elapsedSeconds
		this.accumulatedMs = latency.totalTime
		this.maxLatencyMs = latency.maxLatencyMs
		this.minLatencyMs = latency.minLatencyMs
		this.percentiles = latency.computePercentiles()
		this.errorCodes = latency.errorCodes
		this.computeDerived()
	}

	computeDerived() {
		const meanTime = this.accumulatedMs / this.totalRequests
		this.meanLatencyMs = Math.round(meanTime * 10) / 10
		this.rps = Math.round(this.totalRequests / this.elapsedSeconds)
	}

	/**
	 * Show result of a load test.
	 */
	show() {
		console.info('');
		console.info('Target URL:          %s', this.url);
		if (this.maxRequests) {
			console.info('Max requests:        %s', this.maxRequests);
		} else if (this.maxSeconds) {
			console.info('Max time (s):        %s', this.maxSeconds);
		}
		console.info('Concurrency level:   %s', this.concurrency);
		console.info('Agent:               %s', this.agent);
		if (this.requestsPerSecond) {
			console.info('Requests per second: %s', this.requestsPerSecond);
		}
		console.info('');
		console.info('Completed requests:  %s', this.totalRequests);
		console.info('Total errors:        %s', this.totalErrors);
		console.info('Total time:          %s s', this.totalTimeSeconds);
		console.info('Requests per second: %s', this.rps);
		console.info('Mean latency:        %s ms', this.meanLatencyMs);
		console.info('');
		console.info('Percentage of the requests served within a certain time');

		Object.keys(this.percentiles).forEach(percentile => {
			console.info('  %s%      %s ms', percentile, this.percentiles[percentile]);
		});

		console.info(' 100%      %s ms (longest request)', this.maxLatencyMs);
		if (this.totalErrors) {
			console.info('');
			Object.keys(this.errorCodes).forEach(errorCode => {
				const padding = ' '.repeat(errorCode.length < 4 ? 4 - errorCode.length : 1);
				console.info(' %s%s:   %s errors', padding, errorCode, this.errorCodes[errorCode]);
			});
		}
	}
}


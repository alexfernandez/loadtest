

/**
 * Result of a load test.
 */
export class Result {
	constructor() {
		this.url = null
		this.cores = 0
		this.maxRequests = 0
		this.maxSeconds = 0
		this.concurrency = 0
		this.agent = null
		this.requestsPerSecond = 0
		this.elapsedSeconds = 0
		this.totalRequests = 0
		this.totalErrors = 0
		this.totalTimeSeconds = 0
		this.accumulatedMs = 0
		this.maxLatencyMs = 0
		this.minLatencyMs = Number.MAX_SAFE_INTEGER
		this.errorCodes = {}
		this.histogramMs = {}
	}

	compute(options, latency) {
		// configuration
		this.url = options.url
		this.cores = options.cores
		this.maxRequests = parseInt(options.maxRequests)
		this.maxSeconds = parseInt(options.maxSeconds)
		this.concurrency = parseInt(options.concurrency)
		this.agent = options.agentKeepAlive ? 'keepalive' : 'none';
		this.requestsPerSecond = parseInt(options.requestsPerSecond)
		// result
		this.elapsedSeconds = latency.getElapsed(latency.initialTime) / 1000
		this.totalRequests = latency.totalRequests
		this.totalErrors = latency.totalErrors
		this.totalTimeSeconds = this.elapsedSeconds // backwards compatibility
		this.accumulatedMs = latency.totalTime
		this.maxLatencyMs = latency.maxLatencyMs
		this.minLatencyMs = latency.minLatencyMs
		this.errorCodes = latency.errorCodes
		this.histogramMs = latency.histogramMs
		this.computeDerived()
	}

	computeDerived() {
		const meanTime = this.accumulatedMs / this.totalRequests
		this.meanLatencyMs = Math.round(meanTime * 10) / 10
		this.effectiveRps = Math.round(this.totalRequests / this.elapsedSeconds)
		this.rps = this.effectiveRps // backwards compatibility
		this.computePercentiles()
	}

	computePercentiles() {
		this.percentiles = {
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

			Object.keys(this.percentiles).forEach(percentile => {
				if (!this.percentiles[percentile] && percent > percentile) {
					this.percentiles[percentile] = ms;
				}
			});
		}
	}

	combine(result) {
		// configuration
		this.url = this.url || result.url
		this.cores += 1
		this.maxRequests += result.maxRequests
		this.maxSeconds = this.maxSeconds || result.maxSeconds
		this.concurrency = this.concurrency || result.concurrency
		this.agent = this.agent || result.agent
		this.requestsPerSecond += result.requestsPerSecond || 0
		// result
		this.totalRequests += result.totalRequests
		this.totalErrors += result.totalErrors
		this.elapsedSeconds = Math.max(this.elapsedSeconds, result.elapsedSeconds)
		this.totalTimeSeconds = this.elapsedSeconds
		this.accumulatedMs += result.accumulatedMs
		this.maxLatencyMs = Math.max(this.maxLatencyMs, result.maxLatencyMs)
		this.minLatencyMs = Math.min(this.minLatencyMs, result.minLatencyMs)
		this.combineMap(this.errorCodes, result.errorCodes)
		this.combineMap(this.histogramMs, result.histogramMs)
		this.computeDerived()
	}

	combineMap(originalMap, addedMap) {
		for (const key in {...originalMap, ...addedMap}) {
			if (!originalMap[key]) {
				originalMap[key] = 0
			}
			if (addedMap[key]) {
				originalMap[key] += addedMap[key]
			}
		}
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
		console.info('Running on cores:    %s', this.cores);
		console.info('Agent:               %s', this.agent);
		if (this.requestsPerSecond) {
			console.info('Target rps:          %s', this.requestsPerSecond);
		}
		console.info('');
		console.info('Completed requests:  %s', this.totalRequests);
		console.info('Total errors:        %s', this.totalErrors);
		console.info('Total time:          %s s', this.elapsedSeconds);
		console.info('Effective rps:       %s', this.effectiveRps);
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


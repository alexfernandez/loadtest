

/**
 * Show result of a load test.
 */
export function showResult(options, result) {
	console.info('');
	console.info('Target URL:          %s', options.url);
	if (options.maxRequests) {
		console.info('Max requests:        %s', options.maxRequests);
	} else if (options.maxSeconds) {
		console.info('Max time (s):        %s', options.maxSeconds);
	}
	console.info('Concurrency level:   %s', options.concurrency);
	let agent = 'none';
	if (options.agentKeepAlive) {
		agent = 'keepalive';
	}
	console.info('Agent:               %s', agent);
	if (options.requestsPerSecond) {
		console.info('Requests per second: %s', options.requestsPerSecond * options.concurrency);
	}
	console.info('');
	console.info('Completed requests:  %s', result.totalRequests);
	console.info('Total errors:        %s', result.totalErrors);
	console.info('Total time:          %s s', result.totalTimeSeconds);
	console.info('Requests per second: %s', result.rps);
	console.info('Mean latency:        %s ms', result.meanLatencyMs);
	console.info('');
	console.info('Percentage of the requests served within a certain time');

	Object.keys(result.percentiles).forEach(percentile => {
		console.info('  %s%      %s ms', percentile, result.percentiles[percentile]);
	});

	console.info(' 100%      %s ms (longest request)', result.maxLatencyMs);
	if (result.totalErrors) {
		console.info('');
		Object.keys(result.errorCodes).forEach(errorCode => {
			const padding = ' '.repeat(errorCode.length < 4 ? 4 - errorCode.length : 1);
			console.info(' %s%s:   %s errors', padding, errorCode, result.errorCodes[errorCode]);
		});
	}
}




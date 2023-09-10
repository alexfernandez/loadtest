import {Pool} from './pool.js'
import {Latency} from './latency.js'
import {HighResolutionTimer} from './hrtimer.js'
import {processOptions} from './options.js'

const SHOW_INTERVAL_MS = 5000;


/**
 * Run a load test.
 * Parameters:
 * - `options`: an object which may have:
 *	 - url: URL to access (mandatory).
 *	 - concurrency: how many concurrent clients to use.
 *	 - maxRequests: how many requests to send
 *	 - maxSeconds: how long to run the tests.
 *	 - cookies: a string or an array of strings, each with name:value.
 *	 - headers: a map with headers: {key1: value1, key2: value2}.
 *	 - method: the method to use: POST, PUT. Default: GET, what else.
 *	 - data: the contents to send along a POST or PUT request.
 *	 - contentType: the MIME type to use for the body, default text/plain.
 *	 - requestsPerSecond: how many requests per second to send.
 *	 - agentKeepAlive: if true, then use connection keep-alive.
 *	 - indexParam: string to replace with a unique index.
 *	 - insecure: allow https using self-signed certs.
 *	 - secureProtocol: TLS/SSL secure protocol method to use.
 *	 - proxy: use a proxy for requests e.g. http://localhost:8080.
 *	 - quiet: do not log any messages.
 *	 - debug: show debug messages (deprecated).
 *	 - requestGenerator: use a custom function to generate requests.
 *	 - statusCallback: function called after every request.
 *	 - tcp: use TCP sockets (experimental).
 * - `callback`: optional `function(result, error)` called if/when the test finishes;
 * if not present a promise is returned.
 */
export function loadTest(options, callback) {
	if (!callback) {
		return loadTestAsync(options)
	}
	loadTestAsync(options).then(result => callback(null, result)).catch(error => callback(error))
}

async function loadTestAsync(options) {
	const processed = await processOptions(options)
	return await runLoadTest(processed)
}

function runLoadTest(options) {
	return new Promise((resolve, reject) => {
		try {
			const loadTest = new LoadTest(options, result => resolve(result))
			loadTest.start();
		} catch(error) {
			return reject(error)
		}
	})
}

/**
 * Used to keep track of individual load test runs.
 */
let instanceIndex = 0;

/**
 * A load test operation.
 */
class LoadTest {
	constructor(options, callback) {
		this.options = options;
		this.finalCallback = callback;
		this.latency = new Latency(this);
		this.pool = new Pool(this)
		this.instanceIndex = instanceIndex++
		this.showTimer = null;
		this.stopTimeout = null;
		this.running = true;
	}

	/**
	 * Start the operation.
	 */
	start() {
		if (this.options.maxSeconds) {
			this.stopTimeout = setTimeout(() => this.stop(), this.options.maxSeconds * 1000).unref();
		}
		this.showTimer = new HighResolutionTimer(SHOW_INTERVAL_MS, () => this.latency.showPartial());
		this.showTimer.unref();
		this.pool.start()
	}

	checkStop() {
		if (!this.running) {
			return true
		}
		if (!this.latency.shouldStop()) {
			return false
		}
		this.stop()
		return true
	}

	countClients() {
		return this.pool.clients.length
	}

	/**
	 * Stop clients.
	 */
	stop() {
		this.running = false;
		this.pool.stop()
		this.latency.stop()
		if (this.showTimer) {
			this.showTimer.stop();
		}
		if (this.stopTimeout) {
			clearTimeout(this.stopTimeout);
		}
		if (this.finalCallback) {
			const result = this.latency.getResult();
			result.instanceIndex = this.instanceIndex;
			this.finalCallback(result);
		} else {
			this.latency.show();
		}
	}
}


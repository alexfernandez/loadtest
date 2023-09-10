import {HttpClient} from './httpClient.js'
import {TcpClient} from './tcpClient.js'
import {WebsocketClient} from './websocket.js'
import {HighResolutionTimer} from './hrtimer.js'

/**
 * Used to keep track of individual load test runs.
 */
let instanceIndex = 0;


/**
 * A pool of clients.
 */
export class Pool {
	constructor(loadTest) {
		this.loadTest = loadTest
		this.options = loadTest.options
		this.clients = [];
		this.freeClients = []
		this.requestTimer = null
		this.instanceIndex = instanceIndex++
		this.requestIndex = 0
	}

	/**
	 * Start a number of measuring clients.
	 */
	start() {
		if (this.options.requestsPerSecond) {
			const interval = 1000 / this.options.requestsPerSecond;
			this.requestTimer = new HighResolutionTimer(interval, () => this.makeRequest());
			return
		}
		for (let index = 0; index < this.options.concurrency; index++) {
			const client = this.addClient();
			client.start();
		}
	}

	addClient() {
		const client = this.createClient();
		this.clients.push(client)
		this.freeClients.push(client)
		return client
	}

	createClient() {
		// TODO: || this.options.url.startsWith('wss:'))
		if (this.options.url.startsWith('ws:')) {
			return new WebsocketClient(this.loadTest)
		}
		if (this.options.tcp) {
			return new TcpClient(this.loadTest)
		}
		return new HttpClient(this.loadTest);
	}

	makeRequest() {
		if (!this.loadTest.running) {
			return
		}
		if (!this.freeClients.length) {
			this.addClient()
		}
		const client = this.freeClients.shift()
		client.makeRequest()
	}

	/**
	 * Call after each request has finished.
	 */
	finishRequest(client, result, error) {
		if (this.options.statusCallback) {
			result.requestIndex = this.requestIndex++
			result.instanceIndex = this.loadTest.instanceIndex
			this.options.statusCallback(error, result);
		}
		if (this.loadTest.checkStop()) {
			return
		}
		if (!this.loadTest.latency.shouldSend()) {
			if (this.requestTimer) {
				this.requestTimer.stop()
			}
		}
		if (!this.options.requestsPerSecond) {
			client.makeRequest()
		} else {
			this.freeClients.push(client)
		}
	}

	/**
	 * Stop clients.
	 */
	stop() {
		if (this.requestTimer) {
			this.requestTimer.stop()
		}
		for (const client of this.clients) {
			client.stop();
		}
	}
}


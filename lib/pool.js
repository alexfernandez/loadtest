import {HttpClient} from './httpClient.js'
import {NetworkClient} from './networkClient.js'
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
			this.addClient();
		}
	}

	addClient() {
		const client = this.createClient();
		this.clients.push(client)
		console.log(`Clients created ${this.clients.length}`)
		this.freeClients.push(client)
		client.start();
	}

	createClient() {
		// TODO: || this.options.url.startsWith('wss:'))
		if (this.options.url.startsWith('ws:')) {
			return new WebsocketClient(this.loadTest)
		}
		if (this.options.net) {
			return new NetworkClient(this.loadTest)
		}
		return new HttpClient(this.loadTest);
	}

	makeRequest() {
		if (!this.loadTest.running) {
			return
		}
		console.log('make')
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
		if (this.loadTest.latency.shouldStop()) {
			this.loadTest.stop();
		}
		if (this.loadTest.running && !this.options.requestsPerSecond) {
			client.makeRequest()
		}
		if (this.options.statusCallback) {
			result.requestIndex = this.requestIndex++
			result.instanceIndex = this.loadTest.instanceIndex
			this.options.statusCallback(error, result);
		}
	}

	/**
	 * Stop clients.
	 */
	stop() {
		if (this.requestTimer) {
			clearTimeout(this.requestTimer);
		}
		for (const client of this.clients) {
			client.stop();
		}
	}
}


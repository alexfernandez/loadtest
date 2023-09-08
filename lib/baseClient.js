import * as urlLib from 'url'
import {addUserAgent} from './headers.js'


export class BaseClient {
	constructor(loadTest) {
		this.loadTest = loadTest;
		this.options = loadTest.options;
		this.generateMessage = undefined;
	}

	/**
	 * Get a function that finishes one request and goes for the next.
	 */
	getRequestFinisher(id) {
		return (error, result) => {
			let errorCode = null;
			if (error) {
				if (result) {
					errorCode = result;
				} else {
					errorCode = '-1';
				}
			}
			this.loadTest.latency.end(id, errorCode);
			this.loadTest.pool.finishRequest(this, result, error);
		};
	}

	/**
	 * Init params and message to send.
	 */
	init() {
		this.params = urlLib.parse(this.options.url);
		this.params.headers = {};
		if (this.options.headers) {
			this.params.headers = this.options.headers;
		}
		if (this.options.cert && this.options.key) {
			this.params.cert = this.options.cert;
			this.params.key = this.options.key;
		}
		this.params.agent = false;
		if (this.options.body) {
			if (typeof this.options.body == 'string') {
				this.generateMessage = () => this.options.body;
			} else if (typeof this.options.body == 'object') {
				this.generateMessage = () => this.options.body;
			} else if (typeof this.options.body == 'function') {
				this.generateMessage = this.options.body;
			} else {
				console.error('Unrecognized body: %s', typeof this.options.body);
			}
			this.params.headers['Content-Type'] = this.options.contentType || 'text/plain';
		}
		addUserAgent(this.params.headers);
		if (this.options.secureProtocol) {
			this.params.secureProtocol = this.options.secureProtocol;
		}
	}
}


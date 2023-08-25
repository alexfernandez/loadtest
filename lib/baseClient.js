import * as urlLib from 'url'
import {addUserAgent} from './headers.js'


export class BaseClient {
	constructor(operation, params) {
		this.operation = operation;
		this.params = params;
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
			this.operation.latency.end(id, errorCode);
			let callback;
			if (!this.params.requestsPerSecond) {
				callback = () => this.makeRequest();
			}
			this.operation.finishRequest(error, result, callback);
		};
	}

	/**
	 * Init options and message to send.
	 */
	init() {
		this.options = urlLib.parse(this.params.url);
		this.options.headers = {};
		if (this.params.headers) {
			this.options.headers = this.params.headers;
		}
		if (this.params.cert && this.params.key) {
			this.options.cert = this.params.cert;
			this.options.key = this.params.key;
		}
		this.options.agent = false;
		if (this.params.body) {
			if (typeof this.params.body == 'string') {
				this.generateMessage = () => this.params.body;
			} else if (typeof this.params.body == 'object') {
				this.generateMessage = () => this.params.body;
			} else if (typeof this.params.body == 'function') {
				this.generateMessage = this.params.body;
			} else {
				console.error('Unrecognized body: %s', typeof this.params.body);
			}
			this.options.headers['Content-Type'] = this.params.contentType || 'text/plain';
		}
		addUserAgent(this.options.headers);
		if (this.params.secureProtocol) {
			this.options.secureProtocol = this.params.secureProtocol;
		}
	}
}


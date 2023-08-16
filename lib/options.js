#!/usr/bin/env node

import {readFile} from 'fs/promises'
import * as path from 'path'
import * as urlLib from 'url'
import {addHeaders} from '../lib/headers.js'
import {loadConfig} from '../lib/config.js'


export function processOptions(options, callback) {
	processOptionsAsync(options).then(result => callback(null, result)).catch(error => callback(error))
}

async function processOptionsAsync(options) {
	const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
	if (!options.url) {
		throw new Error('Missing URL in options')
	}
	options.concurrency = options.concurrency || 1;
	if (options.requestsPerSecond) {
		options.requestsPerSecond = options.requestsPerSecond / options.concurrency;
	}
	if (!options.url.startsWith('http://') && !options.url.startsWith('https://') && !options.url.startsWith('ws://')) {
		throw new Error(`Invalid URL ${options.url}, must be http://, https:// or ws://'`)
	}
	if (options.url.startsWith('ws:')) {
		if (options.requestsPerSecond) {
			throw new Error(`"requestsPerSecond" not supported for WebSockets`);
		}
	}
	const configuration = loadConfig();

	options.agentKeepAlive = options.keepalive || options.agent || configuration.agentKeepAlive;
	options.indexParam = options.index || configuration.indexParam;

	//TODO: add index Param
	// Allow a post body string in options
	// Ex -P '{"foo": "bar"}'
	if (options.postBody) {
		options.method = 'POST';
		options.body = options.postBody;
	}
	if (options.postFile) {
		options.method = 'POST';
		options.body = await readBody(options.postFile, '-p');
	}
	if (options.data) {
		options.body = JSON.parse(options.data);
	}
	if (options.method) {
		const acceptedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'get', 'post', 'put', 'delete', 'patch'];
		if (acceptedMethods.indexOf(options.method) === -1) {
			options.method = 'GET';
		}
	}
	if (options.putFile) {
		options.method = 'PUT';
		options.body = await readBody(options.putFile, '-u');
	}
	if (options.patchBody) {
		options.method = 'PATCH';
		options.body = options.patchBody;
	}
	if (options.patchFile) {
		options.method = 'PATCH';
		options.body = await readBody(options.patchFile, '-a');
	}
	if (!options.method) {
		options.method = configuration.method;
	}
	if (!options.body) {
		if(configuration.body) {
			options.body = configuration.body;
		} else if (configuration.file) {
			options.body = await readBody(configuration.file, 'configuration.request.file');
		}
	}
	options.requestsPerSecond = options.rps ? parseFloat(options.rps) : configuration.requestsPerSecond;
	if (!options.key) {
		options.key = configuration.key;
	}
	if (options.key) {
		options.key = await readFile(options.key)
	}
	if (!options.cert) {
		options.cert = configuration.cert;
	}
	if (options.cert) {
		options.cert = await readFile(options.cert);
	}

	const defaultHeaders = options.headers || !configuration.headers ? {} : configuration.headers;
	defaultHeaders['host'] = urlLib.parse(options.url).host;
	defaultHeaders['user-agent'] = 'loadtest/' + packageJson.version;
	defaultHeaders['accept'] = '*/*';

	if (options.headers) {
		addHeaders(options.headers, defaultHeaders);
		console.log('headers: %s, %j', typeof defaultHeaders, defaultHeaders);
	}
	options.headers = defaultHeaders;

	if (!options.requestGenerator) {
		options.requestGenerator = configuration.requestGenerator;
	}
	if (typeof options.requestGenerator == 'string') {
		options.requestGenerator = await import(options.requestGenerator)
	}

	// Use configuration file for other values
	if(!options.maxRequests) {
		options.maxRequests = configuration.maxRequests;
	}
	if(!options.concurrency) {
		options.concurrency = configuration.concurrency;
	}
	if(!options.maxSeconds) {
		options.maxSeconds = configuration.maxSeconds;
	}
	if(!options.timeout && configuration.timeout) {
		options.timeout = configuration.timeout;
	}
	if(!options.contentType) {
		options.contentType = configuration.contentType;
	}
	if(!options.cookies) {
		options.cookies = configuration.cookies;
	}
	if(!options.secureProtocol) {
		options.secureProtocol = configuration.secureProtocol;
	}
	if(!options.insecure) {
		options.insecure = configuration.insecure;
	}
	if(!options.recover) {
		options.recover = configuration.recover;
	}
	if(!options.proxy) {
		options.proxy = configuration.proxy;
	}
}

async function readBody(filename, option) {
	if (typeof filename !== 'string') {
		throw new Error(`Invalid file to open with ${option}: ${filename}`);
	}

	if (path.extname(filename) === '.js') {
		return await import(new URL(filename, `file://${process.cwd()}/`))
	}

	const ret = await readFile(filename, {encoding: 'utf8'}).replace("\n", "");

	return ret;
}


import {readFile} from 'fs/promises'
import * as path from 'path'
import * as urlLib from 'url'
import {addHeaders} from '../lib/headers.js'
import {loadConfig} from '../lib/config.js'


export async function processOptions(options) {
	const processed = {}
	const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
	if (!options.url) {
		throw new Error('Missing URL in options')
	}
	if (!options.url.startsWith('http://') && !options.url.startsWith('https://') && !options.url.startsWith('ws://')) {
		throw new Error(`Invalid URL ${options.url}, must be http://, https:// or ws://'`)
	}
	if (options.url.startsWith('ws:')) {
		if (options.requestsPerSecond) {
			throw new Error(`"requestsPerSecond" not supported for WebSockets`);
		}
	}
	processed.url = options.url
	const configuration = loadConfig();
	processed.concurrency = options.concurrency || configuration.concurrency || 1
	const rps = options.rps ? parseFloat(options.rps) : null
	processed.requestsPerSecond = options.requestsPerSecond || rps || configuration.requestsPerSecond
	processed.agentKeepAlive = options.keepalive || options.agent || options.agentKeepAlive || configuration.agentKeepAlive;
	processed.indexParam = options.index || options.indexParam || configuration.indexParam;
	// Allow a post body string in options
	// Ex -P '{"foo": "bar"}'
	if (options.postBody) {
		processed.method = 'POST';
		processed.body = options.postBody;
	}
	if (options.postFile) {
		processed.method = 'POST';
		processed.body = await readBody(options.postFile, '-p');
	}
	if (options.data) {
		processed.body = options.data
	}
	if (options.method) {
		const acceptedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'get', 'post', 'put', 'delete', 'patch'];
		if (acceptedMethods.indexOf(options.method) === -1) {
			processed.method = 'GET';
		} else {
			processed.method = options.method
		}
	}
	if (options.putFile) {
		processed.method = 'PUT';
		processed.body = await readBody(options.putFile, '-u');
	}
	if (options.patchBody) {
		processed.method = 'PATCH';
		processed.body = options.patchBody;
	}
	if (options.patchFile) {
		processed.method = 'PATCH';
		processed.body = await readBody(options.patchFile, '-a');
	}
	if (!options.method) {
		processed.method = configuration.method || 'GET'
	}
	if (!options.body) {
		if(configuration.body) {
			processed.body = configuration.body;
		} else if (configuration.file) {
			processed.body = await readBody(configuration.file, 'configuration.request.file');
		}
	}
	if (options.key || configuration.key) {
		processed.key = await readFile(options.key || configuration.key)
	}
	if (options.cert || configuration.cert) {
		processed.cert = await readFile(options.cert || configuration.cert);
	}
	processed.headers = configuration.headers || {}
	processed.headers['host'] = urlLib.parse(options.url).host;
	processed.headers['user-agent'] = 'loadtest/' + packageJson.version;
	processed.headers['accept'] = '*/*';

	if (options.headers) {
		addHeaders(options.headers, processed.headers);
	}
	processed.requestGenerator = options.requestGenerator || configuration.requestGenerator
	if (typeof processed.requestGenerator == 'string') {
		processed.requestGenerator = await import(processed.requestGenerator)
	}
	processed.maxRequests = options.maxRequests || configuration.maxRequests
	processed.maxSeconds = options.maxSeconds || configuration.maxSeconds
	processed.cookies = options.cookies || configuration.cookies
	processed.contentType = options.contentType || configuration.contentType
	processed.timeout = options.timeout || configuration.timeout
	processed.secureProtocol = options.secureProtocol || configuration.secureProtocol
	processed.insecure = options.insecure || configuration.insecure
	processed.recover = options.recover || configuration.recover
	processed.proxy = options.proxy || configuration.proxy
	processed.quiet = options.quiet || configuration.quiet
	return processed
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


import {readFile} from 'fs/promises'
import * as path from 'path'
import * as urlLib from 'url'
import {addHeaders} from '../lib/headers.js'
import {loadConfig} from '../lib/config.js'

const acceptedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'get', 'post', 'put', 'delete', 'patch'];


export async function processOptions(options) {
	const processed = new Options(options)
	await processed.process()
	return processed
}

class Options {
	constructor(options) {
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
		this.url = options.url
		const configuration = loadConfig();
		this.concurrency = options.concurrency || configuration.concurrency || 1
		const rps = options.rps ? parseFloat(options.rps) : null
		this.requestsPerSecond = options.requestsPerSecond || rps || configuration.requestsPerSecond
		this.agentKeepAlive = options.keepalive || options.agent || options.agentKeepAlive || configuration.agentKeepAlive;
		this.indexParam = options.index || options.indexParam || configuration.indexParam;
		this.method = options.method || configuration.method || 'GET'
		// Allow a post body string in options
		// Ex -P '{"foo": "bar"}'
		if (options.postBody) {
			this.method = 'POST';
			this.body = options.postBody
		}
		if (options.postFile) {
			this.method = 'POST';
			this.bodyFile = options.postFile
		}
		if (options.data) {
			this.body = options.data
		}
		if (options.putFile) {
			this.method = 'PUT';
			this.bodyFile = options.putFile
		}
		if (options.patchBody) {
			this.method = 'PATCH';
			this.body = options.patchBody
		}
		if (options.patchFile) {
			this.method = 'PATCH';
			this.bodyFile = options.patchFile
		}
		// sanity check
		if (acceptedMethods.indexOf(this.method) === -1) {
			throw new Error(`Invalid method ${this.method}`)
		}
		if (!options.body) {
			if(configuration.body) {
				this.body = configuration.body;
			} else if (configuration.file) {
				this.bodyFile = configuration.file
			}
		}
		this.key = options.key || configuration.key
		this.cert = options.cert || configuration.cert
		this.headers = configuration.headers || {}
		this.headers['host'] = urlLib.parse(options.url).host;
		this.headers['accept'] = '*/*';

		if (options.headers) {
			addHeaders(options.headers, this.headers);
		}
		this.requestGenerator = options.requestGenerator || configuration.requestGenerator
		this.maxRequests = options.maxRequests || configuration.maxRequests
		this.maxSeconds = options.maxSeconds || configuration.maxSeconds
		this.cookies = options.cookies || configuration.cookies
		this.contentType = options.contentType || configuration.contentType
		this.timeout = options.timeout || configuration.timeout
		this.secureProtocol = options.secureProtocol || configuration.secureProtocol
		this.insecure = options.insecure || configuration.insecure
		this.recover = options.recover || configuration.recover
		this.proxy = options.proxy || configuration.proxy
		this.quiet = options.quiet || configuration.quiet
	}

	async process() {
		const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
		this.headers['user-agent'] = 'loadtest/' + packageJson.version;
		if (this.key) {
			this.key = await readFile(this.key)
		}
		if (this.cert) {
			this.cert = await readFile(this.cert);
		}
		if (typeof this.requestGenerator == 'string') {
			this.requestGenerator = await import(this.requestGenerator)
		}
		if (this.bodyFile) {
			this.body = await readBody(this.bodyFile);
		}
	}
}

async function readBody(filename) {
	if (typeof filename !== 'string') {
		throw new Error(`Invalid file to open for body: ${filename}`);
	}
	if (path.extname(filename) === '.js') {
		return await import(new URL(filename, `file://${process.cwd()}/`))
	}
	return await readFile(filename, {encoding: 'utf8'}).replace("\n", "");
}


"use strict";

/**
 * Support for configuration file.
 */

// requires
const Log = require("log");
const {
	Confinode,
	Level,
	anyItem,
	booleanItem,
	choiceItem,
	defaultValue,
	dictionary,
	literal,
	numberItem,
	optional,
	stringItem
} = require("confinode");

// globals
const log = new Log("info");

/**
 * Load configuration from file.
 */
exports.loadConfig = function(options) {
	if (options.debug) {
		log.level = Log.DEBUG;
	}
	if (options.quiet) {
		log.level = Log.NOTICE;
	}
	const description = literal({
		delay: numberItem(0),
		error: numberItem(0),
		percent: stringItem(""),
		maxRequests: numberItem(0),
		concurrency: numberItem(1),
		maxSeconds: numberItem(0),
		timeout: optional(stringItem()),
		method: choiceItem(["GET", "POST", "PUT", "DELETE", "PATCH", "get", "post", "put", "delete", "patch"], "GET"),
		contentType: stringItem(""),
		body: defaultValue(anyItem(), ""),
		file: stringItem(""),
		cookies: defaultValue(new CookieDescription(), []),
		headers: defaultValue(dictionary(stringItem()), {}),
		secureProtocol: stringItem(""),
		insecure: booleanItem(),
		cert: stringItem(""),
		key: stringItem(""),
		requestGenerator: stringItem(""),
		recover: booleanItem(true),
		agentKeepAlive: booleanItem(),
		proxy: stringItem(""),
		requestsPerSecond: numberItem(0),
		indexParam: stringItem("")
	});
	const confinode = new Confinode("loadtest", description, { logger, mode: "sync" });
	const result = confinode.search();
	return result ? result.configuration : {};
};

/**
 * Logging function of confinode.
 */
function logger(msg) {
	switch (msg.Level) {
	case Level.Error:
		log.error(msg.toString());
		break;
	case Level.Warning:
		log.warning(msg.toString());
		break;
	case Level.Information:
		log.info(msg.toString());
		break;
	default:
		log.debug(msg.toString());
	}
}

/**
 * Description for the cookies.
 */
class CookieDescription {
	constructor() {
		this.dictionary = dictionary(stringItem());
	}

	parse(data, context) {
		const result = this.dictionary.parse(data, context);
		if (result) {
			return Object.keys(result.configuration).map(key => `${key}=${result.configuration[key]}`);
		} else {
			return undefined;
		}
	}
}

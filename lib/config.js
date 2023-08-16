import {
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
} from 'confinode'


/**
 * Load configuration from file.
 */
export function loadConfig() {
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
}

/**
 * Logging function of confinode.
 */
function logger(msg) {
	switch (msg.Level) {
	case Level.Error:
		console.error(msg.toString());
		break;
	case Level.Warning:
		console.warn(msg.toString());
		break;
	case Level.Information:
		console.info(msg.toString());
		break;
	default:
		// nothing
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




/**
 * Add all raw headers given to the given array.
 */
export function addHeaders(rawHeaders, headers) {
	if (Array.isArray(rawHeaders)) {
		rawHeaders.forEach(function(header) {
			addHeader(header, headers);
		});
	} else if (typeof rawHeaders == 'string') {
		addHeader(rawHeaders, headers);
	} else {
		console.error('Invalid header structure %j, it should be an array', rawHeaders);
	}
}

/**
 * Add a single header to an array.
 */
function addHeader(rawHeader, headers) {
	if (!rawHeader.includes(':')) {
		return console.error('Invalid header %s, it should be in the form -H key:value', rawHeader);
	}
	const index = rawHeader.indexOf(':');
	const key = rawHeader.substr(0, index);
	const value = rawHeader.substr(index + 1);
	headers[key.toLowerCase()] = value;
}

/**
 * Add a user-agent header if not present.
 */
export function addUserAgent(headers) {
	if(!headers['user-agent']) {
		headers['user-agent'] = 'node.js loadtest bot';
	}
}


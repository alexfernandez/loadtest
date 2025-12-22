export default function requestGenerator(params, options, client, callback) {
	const message = '{"hi": "ho"}';
	options.headers['Content-Length'] = message.length;
	options.headers['Content-Type'] = 'application/json';
	options.headers['x-test-header'] = 'request-generator-module-import-test';
	const request = client(options, callback);
	request.write(message);
	return request;
}

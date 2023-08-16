/**
 * Sample post-file content for test.
 * Contains a single exported function that generates the body.
 */

export default function bodyGenerator(requestId) {
	// this object will be serialized to JSON and sent in the body of the request
	return {
		key: 'value',
		requestId: requestId
	}
}


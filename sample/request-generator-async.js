"use strict";

/**
 * Sample aync request generator usage.
 * Currently the loadtest timming code seems to need more work because
 * it considers the message generation time into the latency.
 * Also the results are returned before the last messages are processed.
 *
 * Based on request-generator.js by jjohnsonvng:
 * https://github.com/alexfernandez/loadtest/issues/86#issuecomment-211579639
 */

const loadtest = require("../lib/loadtest.js");

const options = {
	url: "https://your.website",
	concurrency: 2,
	method: "POST",
	body: null,
	requestsPerSecond: 5,
	maxSeconds: 5,
	debug: false,
	requestGenerator: (params, options, client, callback) => {
		const request = client(options, callback);
		generateMessageAsync().then(randomMessage => {
			const message = randomMessage;
			const messageString = JSON.stringify(randomMessage);
			options.headers["Content-Type"] = "application/json";
			options.headers["Content-Length"] = Buffer.byteLength(messageString);
			options.body = null;
			console.log("generated message: ", messageString);
			request.write(messageString);
			request.end();
		});
		return request;
	}
};

/**
 * Generate a message asynchronously in 300ms.
 * Returns a promise which resolves into the message object
 */
async function generateMessageAsync() {
	var messagePromise = new Promise(function(resolve, reject) {
		setTimeout(() => {
			const newMessage = {
				hi: "async",
				id: Math.round(Math.random() * 100)
			};
			resolve(newMessage);
		}, 300);
	});
	return messagePromise;
}

loadtest.loadTest(options, (error, results) => {
	if (error) {
		return console.error("Got an error: %s", error);
	}
	console.log(results);
	console.log("Tests run successfully");
});

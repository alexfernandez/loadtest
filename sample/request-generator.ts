/**
 * Sample request generator usage.
 * Contributed by jjohnsonvng:
 * https://github.com/alexfernandez/loadtest/issues/86#issuecomment-211579639
 */

import loadtest from "loadtest"

const options: loadtest.LoadTestOptions = {
    url: "http://yourHost",
    concurrency: 5,
    method: "POST",
    body: "",
    requestsPerSecond: 5,
    maxSeconds: 30,
    requestGenerator: (params, options, client, callback) => {
        const message = '{"hi": "ho"}'
        options.headers["Content-Length"] = message.length
        options.headers["Content-Type"] = "application/json"
        options.body = "YourPostData"
        options.path = "YourURLPath"
        const request = client(options, callback)
        request.write(message)
        return request
    },
}

loadtest.loadTest(options, (error, result) => {
    if (error) {
        return console.error(`Got an error: ${error}`)
    }
    console.log("Tests run successfully", {result})
})

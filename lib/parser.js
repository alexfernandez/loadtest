
const bodySeparator = '\r\n\r\n'
const lineSeparator = '\r\n'


export class Parser {
	constructor(method) {
		this.method = method
		this.pending = null
		this.finished = false
		this.headers = {}
		this.partialBody = false
		this.body = null
		this.statusCode = null
	}

	addPacket(data) {
		if (this.pending) {
			this.pending = Buffer.concat([this.pending, data])
		} else {
			this.pending = data
		}
		if (this.partialBody) {
			this.parseBody(this.pending)
			return
		}
		const division = this.pending.indexOf(bodySeparator)
		if (division == -1) {
			// cannot parse yet
			return
		}
		const messageHeader = this.pending.subarray(0, division)
		this.parseHeader(messageHeader.toString())
		const messageBody = this.pending.subarray(division + 4)
		this.parseBody(messageBody)
	}

	parseHeader(messageHeader) {
		const lines = messageHeader.split(lineSeparator)
		const firstLine = lines.shift()
		const words = firstLine.split(' ')
		if (words.length < 2) {
			throw new Error(`Unexpected response line ${firstLine}`)
		}
		if (words[0] != 'HTTP/1.1') {
			throw new Error(`Unexpected first word ${words[0]}`)
		}
		const statusCode = parseInt(words[1])
		if (!statusCode || statusCode < 100 || statusCode >= 600) {
			throw new Error(`Unexpected status code ${statusCode}`)
		}
		this.statusCode = statusCode
		if (this.hasNoBody(this.statusCode)) {
			// do not parse headers
			return
		}
		for (const line of lines) {
			const colon = line.indexOf(': ')
			if (colon == -1) {
				throw new Error(`Invalid header ${line}`)
			}
			if (line.length == 0) {
				// one empty line is possible after 204
				continue
			}
			const key = line.substring(0, colon).toLowerCase()
			const value = line.substring(colon + 2)
			this.headers[key] = value
		}
	}

	parseBody(messageBody) {
		if (this.hasNoBody(this.statusCode)) {
			if (messageBody.length != 0) {
				throw new Error(`Should not have a body`)
			}
			// do not parse body
			this.finished = true
			return
		}
		const lengthHeader = this.headers['content-length']
		if (!lengthHeader) {
			throw new Error(`Missing content length`)
		}
		const contentLength = parseInt(lengthHeader)
		if (contentLength != messageBody.length) {
			this.partialBody = true
			this.pending = messageBody
			return
		}
		// we do not actually parse the body, have no use for it
		this.finished = true
	}


	hasNoBody(statusCode) {
		if (statusCode < 200 || statusCode == 204 || statusCode == 304) {
			return true
		}
		if (this.method == 'HEAD') {
			return true
		}
		return false
	}
}


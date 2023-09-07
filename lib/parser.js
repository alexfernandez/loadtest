
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
		this.contentLength = 0
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
		this.parseTop(messageHeader)
		const messageBody = this.pending.subarray(division + 4)
		this.parseBody(messageBody)
	}

	parseTop(messageHeader) {
		let firstReturn = messageHeader.indexOf(lineSeparator)
		if (firstReturn == -1) {
			// no headers
			firstReturn = messageHeader.length
		}
		const firstLine = messageHeader.toString('utf8', 0, firstReturn)
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
		let position = firstReturn + 2
		while (position < messageHeader.length) {
			let nextReturn = messageHeader.indexOf(lineSeparator, position)
			if (nextReturn == -1) {
				nextReturn = messageHeader.length
			}
			const line = messageHeader.toString('utf8', position, nextReturn)
			this.parseHeader(line)
			position = nextReturn + 2
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
		if (!this.contentLength) {
			throw new Error(`Missing content length`)
		}
		if (this.contentLength != messageBody.length) {
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

	parseHeader(line) {
		const colon = line.indexOf(': ')
		if (colon == -1) {
			throw new Error(`Invalid header ${line}`)
		}
		const key = line.substring(0, colon).toLowerCase()
		if (key == 'content-length') {
			const value = line.substring(colon + 2)
			this.contentLength = parseInt(value)
		}
		// this.headers[key] = value
	}
}



const bodySeparator = '\r\n\r\n'
const lineSeparator = '\r\n'
const packetInfos = new Map()
// max size to consider packets duplicated
const maxPacketSize = 1000


export class Parser {
	constructor(method) {
		this.method = method
		this.pending = null
		this.finished = false
		this.headers = {}
		this.partialBody = false
		this.packetInfo = null
	}

	addPacket(data) {
		if (this.pending) {
			this.pending = Buffer.concat([this.pending, data])
		} else {
			this.pending = data
		}
		if (this.partialBody) {
			this.parseBody(this.pending, this.packetInfo)
			return
		}
		this.parsePacket()
	}

	parsePacket() {
		const division = this.pending.indexOf(bodySeparator)
		if (division == -1) {
			// cannot parse yet
			return
		}
		this.packetInfo = new PacketInfo(this.pending.length, division)
		const messageHeader = this.pending.subarray(0, division)
		const messageBody = this.pending.subarray(division + 4)
		this.parseFirstLine(messageHeader)
		const key = this.packetInfo.getKey()
		const existing = packetInfos.get(key)
		if (existing && this.packetInfo.isDuplicated(existing)) {
			// no need to parse headers or body
			this.finished = true
			return
		}
		packetInfos.set(key, this.packetInfo)
		this.parseHeaders(messageHeader)
		this.parseBody(messageBody)
	}

	parseFirstLine(messageHeader) {
		let firstReturn = messageHeader.indexOf(lineSeparator)
		if (firstReturn == -1) {
			// no headers
			firstReturn = messageHeader.length
		}
		const firstLine = messageHeader.toString('utf8', 0, firstReturn)
		this.packetInfo.parseFirstLine(firstLine)
	}

	parseHeaders(messageHeader) {
		if (this.packetInfo.hasNoBody(this.method)) {
			// do not parse headers
			return
		}
		let firstReturn = messageHeader.indexOf(lineSeparator)
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
		if (this.packetInfo.hasNoBody(this.method)) {
			if (messageBody.length != 0) {
				throw new Error(`Should not have a body`)
			}
			// do not parse body
			this.finished = true
			return
		}
		if (!this.packetInfo.contentLength) {
			throw new Error(`Missing content length`)
		}
		if (this.packetInfo.contentLength != messageBody.length) {
			this.partialBody = true
			this.pending = messageBody
			return
		}
		// we do not actually parse the body, have no use for it
		this.finished = true
	}

	parseHeader(line) {
		const colon = line.indexOf(': ')
		if (colon == -1) {
			throw new Error(`Invalid header ${line}`)
		}
		const key = line.substring(0, colon).toLowerCase()
		if (key == 'content-length') {
			const value = line.substring(colon + 2)
			this.packetInfo.contentLength = parseInt(value)
		}
		// this.headers[key] = value
	}
}

class PacketInfo {
	constructor(length, division) {
		this.length = length
		this.division = division
		this.contentLength = 0
		this.statusCode = 0
	}

	getKey() {
		return `${this.length}-${this.division}`
	}

	parseFirstLine(firstLine) {
		const words = firstLine.split(' ')
		if (words.length < 2) {
			throw new Error(`Unexpected response line ${firstLine}`)
		}
		if (words[0] != 'HTTP/1.1') {
			throw new Error(`Unexpected first word ${words[0]}`)
		}
		this.statusCode = parseInt(words[1])
		if (!this.statusCode || this.statusCode < 100 || this.statusCode >= 600) {
			throw new Error(`Unexpected status code ${this.statusCode}`)
		}
	}

	hasNoBody(method) {
		if (method == 'HEAD') {
			return true
		}
		if (this.statusCode < 200 || this.statusCode == 204 || this.statusCode == 304) {
			return true
		}
		return false
	}

	isDuplicated(info) {
		if (this.length > maxPacketSize) {
			return false
		}
		return this.length == info.length && this.division == info.division && this.statusCode == info.statusCode
	}
}


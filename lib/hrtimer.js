

/**
 * A high resolution timer. Params:
 *	- delayMs: miliseconds to wait before calls. Can be fractional.
 *	- callback: function to call every time.
 */
export class HighResolutionTimer {

	/**
	 * Create a timer with the given delay.
	 * Important: will run once when started, then once every delayMs.
	 */
	constructor(delayMs, callback) {
		this.delayMs = delayMs
		this.callback = callback
		this.counter = 0;
		this.start = Date.now();
		this.active = true;
		// start timer
		setImmediate(() => this.delayed())
	}

	/**
	 * Delayed running of the callback.
	 */
	delayed() {
		if (!this.active) {
			return false;
		}
		this.callback();
		this.counter ++;
		const diff = (Date.now() - this.start) - (this.counter - 1) * this.delayMs;
		const timeout = Math.floor(this.delayMs - diff);
		if (timeout <= 0) {
			return setImmediate(() => this.delayed())
		}
		this.timer = setTimeout(() => this.delayed(), this.delayMs - diff);
	}

	/**
	 * Show the drift of the timer.
	 */
	traceDrift() {
		const diff = Date.now() - this.start;
		const drift = diff / this.delayMs - this.counter;
		console.debug('Seconds: ' + Math.round(diff / 1000) + ', counter: ' + this.counter + ', drift: ' + drift);
	}

	stop() {
		this.active = false;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	unref() {
		if (this.timer) {
			this.timer.unref()
		}
		return this
	}
}


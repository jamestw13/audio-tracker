const CLOCK_DEFAULTS = {
  toleranceLate: 0.1,
  toleranceEarly: 0.001,
};

export class Event {
  clock: WAAClock;
  deadline: number | null;
  func: () => void;
  _cleared: boolean;
  toleranceLate: number;
  toleranceEarly: number;
  _latestTime: number | null;
  _earliestTime: number | null;
  repeatTime: number | null;

  constructor(clock: WAAClock, deadline: number, func: () => void) {
    this.clock = clock;
    this.func = func;
    this._cleared = false;

    this.toleranceLate = clock.toleranceLate;
    this.toleranceEarly = clock.toleranceEarly;
    this._latestTime = null;
    this._earliestTime = null;
    this.deadline = null;
    this.repeatTime = null;

    this.schedule(deadline);
  }

  clear() {
    this.clock._removeEvent(this);
    this._cleared = true;
    return this;
  }

  repeat(time: number) {
    if (time === 0) throw new Error('delay cannot be 0');
    this.repeatTime = time;
    if (!this.clock._hasEvent(this) && this.deadline !== null) this.schedule(this.deadline + this.repeatTime);
    return this;
  }

  tolerance(values: { late?: number; early?: number }) {
    if (typeof values.late === 'number') this.toleranceLate = values.late;
    if (typeof values.early === 'number') this.toleranceEarly = values.early;
    this._refreshEarlyLateDates();
    if (this.clock._hasEvent(this)) {
      this.clock._removeEvent(this);
      this.clock._insertEvent(this);
    }
    return this;
  }

  isRepeated() {
    return this.repeatTime !== null;
  }

  schedule(deadline: number) {
    this._cleared = false;
    this.deadline = deadline;
    this._refreshEarlyLateDates();

    if (this._earliestTime !== null && this.clock.context.currentTime >= this._earliestTime) {
      this._execute();
    } else if (this.clock._hasEvent(this)) {
      this.clock._removeEvent(this);
      this.clock._insertEvent(this);
    } else {
      this.clock._insertEvent(this);
    }
  }

  timeStretch(tRef: number, ratio: number) {
    if (this.isRepeated()) this.repeatTime = this.repeatTime * ratio;

    let deadline = tRef + ratio * (this.deadline - tRef);
    if (this.isRepeated()) {
      while (this.clock.context.currentTime >= deadline - this.toleranceEarly) deadline += this.repeatTime;
    }
    this.schedule(deadline);
  }

  _execute() {
    if (this.clock._started === false) return;
    this.clock._removeEvent(this);

    if (this.clock.context.currentTime < this._latestTime) {
      try {
        this.func(this);
      } catch (err) {
        setTimeout(() => {
          throw err;
        }, 0);
      }
    } else {
      if (this.onexpired) this.onexpired(this);
      console.warn('event expired');
    }

    if (!this.clock._hasEvent(this) && this.isRepeated() && !this._cleared) {
      this.schedule(this.deadline + this.repeatTime);
    }
  }

  _refreshEarlyLateDates() {
    this._latestTime = this.deadline + this.toleranceLate;
    this._earliestTime = this.deadline - this.toleranceEarly;
  }
}

export default class WAAClock {
  context: AudioContext;
  tickMethod: string;
  toleranceEarly: number;
  toleranceLate: number;
  _events: Event[];
  _started: boolean;
  _clockNode: ScriptProcessorNode | null;
  _intervalId: number | null;

  constructor(
    context: AudioContext,
    opts: { tickMethod?: string; toleranceEarly?: number; toleranceLate?: number } = {},
  ) {
    this.context = context;
    this.tickMethod =
      opts.tickMethod || (context && context.createScriptProcessor ? 'ScriptProcessorNode' : 'setInterval');
    this.toleranceEarly = typeof opts.toleranceEarly === 'number' ? opts.toleranceEarly : CLOCK_DEFAULTS.toleranceEarly;
    this.toleranceLate = typeof opts.toleranceLate === 'number' ? opts.toleranceLate : CLOCK_DEFAULTS.toleranceLate;

    this._events = [];
    this._started = false;

    this._clockNode = null;
    this._intervalId = null;
  }

  setTimeout(func, delay) {
    return this._createEvent(func, this._absTime(delay));
  }

  callbackAtTime(func: () => void, deadline: number) {
    return this._createEvent(func, deadline);
  }

  timeStretch(tRef, events, ratio) {
    events.forEach(event => {
      event.timeStretch(tRef, ratio);
    });
    return events;
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._events = [];

    if (this.tickMethod === 'ScriptProcessorNode') {
      const bufferSize = 256;
      if (!this.context || typeof this.context.createScriptProcessor !== 'function') {
        this._startInterval();
        return;
      }
      this._clockNode = this.context.createScriptProcessor(bufferSize, 1, 1);
      this._clockNode.connect(this.context.destination);
      this._clockNode.onaudioprocess = () => {
        setTimeout(() => {
          this.tick();
        }, 0);
      };
    } else if (this.tickMethod === 'setInterval') {
      this._startInterval();
    } else if (this.tickMethod === 'manual') {
    } else {
      throw new Error('invalid tickMethod ' + this.tickMethod);
    }
  }

  _startInterval() {
    if (this._intervalId != null) return;
    this._intervalId = setInterval(() => this.tick(), 16);
  }

  stop() {
    if (!this._started) return;
    this._started = false;
    if (this._clockNode) {
      try {
        this._clockNode.disconnect();
      } catch (e) {
        /* ignore */
      }
      this._clockNode = null;
    }
    if (this._intervalId != null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  tick() {
    let event = this._events.shift();

    while (event && event._earliestTime <= this.context.currentTime) {
      event._execute();
      event = this._events.shift();
    }

    if (event) this._events.unshift(event);
  }

  _createEvent(func, deadline) {
    return new Event(this, deadline, func);
  }

  _insertEvent(event) {
    this._events.splice(this._indexByTime(event._earliestTime), 0, event);
  }

  _removeEvent(event) {
    const ind = this._events.indexOf(event);
    if (ind !== -1) this._events.splice(ind, 1);
  }

  _hasEvent(event) {
    return this._events.indexOf(event) !== -1;
  }

  _indexByTime(deadline) {
    let low = 0;
    let high = this._events.length;
    let mid;
    while (low < high) {
      mid = Math.floor((low + high) / 2);
      if (this._events[mid]._earliestTime < deadline) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  _absTime(relTime) {
    return relTime + this.context.currentTime;
  }

  _relTime(absTime) {
    return absTime - this.context.currentTime;
  }
}

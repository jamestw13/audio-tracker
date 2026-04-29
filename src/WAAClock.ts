const CLOCK_DEFAULTS = {
  toleranceLate: 0.1,
  toleranceEarly: 0.001,
};

const PROCESSOR_NAME = 'waa-clock-processor';

// Runs on the audio rendering thread. Posts a message every 4 render quanta
// (~11.6ms at 44.1kHz), giving the main-thread scheduler a high-precision heartbeat
// without the jitter of setInterval or the deprecation of ScriptProcessorNode.
const WORKLET_CODE = `
class WAAClockProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frameCount = 0;
  }
  process() {
    this._frameCount++;
    if (this._frameCount >= 4) {
      this._frameCount = 0;
      this.port.postMessage(null);
    }
    return true;
  }
}
registerProcessor('${PROCESSOR_NAME}', WAAClockProcessor);
`;

export class Event {
  clock: WAAClock;
  deadline: number | null;
  func: (event?: Event) => void;
  _cleared: boolean;
  toleranceLate: number;
  toleranceEarly: number;
  _latestTime: number | null;
  _earliestTime: number | null;
  repeatTime: number | null;
  onexpired?: (event: Event) => void;

  constructor(clock: WAAClock, deadline: number, func: (event?: Event) => void) {
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
    if (time === 0) throw new Error('repeat time cannot be 0');
    this.repeatTime = time;
    if (!this.clock._hasEvent(this) && this.deadline !== null) {
      this.schedule(this.deadline + this.repeatTime);
    }
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
    if (this.isRepeated()) this.repeatTime = this.repeatTime! * ratio;

    let deadline = tRef + ratio * (this.deadline! - tRef);
    if (this.isRepeated()) {
      while (this.clock.context.currentTime >= deadline - this.toleranceEarly) {
        deadline += this.repeatTime!;
      }
    }
    this.schedule(deadline);
  }

  _execute() {
    if (!this.clock._started) return;
    this.clock._removeEvent(this);

    if (this.clock.context.currentTime < this._latestTime!) {
      try {
        this.func(this);
      } catch (err) {
        setTimeout(() => {
          throw err;
        }, 0);
      }
    } else {
      if (this.onexpired) this.onexpired(this);
      console.warn('WAAClock: event expired');
    }

    if (!this.clock._hasEvent(this) && this.isRepeated() && !this._cleared) {
      this.schedule(this.deadline! + this.repeatTime!);
    }
  }

  _refreshEarlyLateDates() {
    this._latestTime = this.deadline! + this.toleranceLate;
    this._earliestTime = this.deadline! - this.toleranceEarly;
  }
}

export default class WAAClock {
  context: AudioContext;
  toleranceEarly: number;
  toleranceLate: number;
  _events: Event[];
  _started: boolean;
  _clockNode: AudioWorkletNode | null;
  _ready: Promise<void>;

  constructor(context: AudioContext, opts: { toleranceEarly?: number; toleranceLate?: number } = {}) {
    this.context = context;
    this.toleranceEarly = opts.toleranceEarly ?? CLOCK_DEFAULTS.toleranceEarly;
    this.toleranceLate = opts.toleranceLate ?? CLOCK_DEFAULTS.toleranceLate;
    this._events = [];
    this._started = false;
    this._clockNode = null;

    // Load the worklet module eagerly so it is ready before the user hits play.
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    this._ready = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
  }

  callbackAtTime(func: (event?: Event) => void, deadline: number) {
    return this._createEvent(func, deadline);
  }

  setTimeout(func: (event?: Event) => void, delay: number) {
    return this._createEvent(func, this._absTime(delay));
  }

  timeStretch(tRef: number, events: Event[], ratio: number) {
    events.forEach(event => event.timeStretch(tRef, ratio));
    return events;
  }

  async start() {
    if (this._started) return;
    this._started = true;
    this._events = []; // cleared synchronously — callbackAtTime() calls after this are safe

    await this._ready;

    this._clockNode = new AudioWorkletNode(this.context, PROCESSOR_NAME);
    this._clockNode.port.onmessage = () => this.tick();
    this._clockNode.connect(this.context.destination);
  }

  stop() {
    if (!this._started) return;
    this._started = false;
    if (this._clockNode) {
      try {
        this._clockNode.disconnect();
      } catch {
        /* ignore */
      }
      this._clockNode = null;
    }
  }

  tick() {
    let event = this._events.shift();

    while (event && event._earliestTime! <= this.context.currentTime) {
      event._execute();
      event = this._events.shift();
    }

    if (event) this._events.unshift(event);
  }

  _createEvent(func: (event?: Event) => void, deadline: number) {
    return new Event(this, deadline, func);
  }

  _insertEvent(event: Event) {
    this._events.splice(this._indexByTime(event._earliestTime!), 0, event);
  }

  _removeEvent(event: Event) {
    const ind = this._events.indexOf(event);
    if (ind !== -1) this._events.splice(ind, 1);
  }

  _hasEvent(event: Event) {
    return this._events.indexOf(event) !== -1;
  }

  _indexByTime(deadline: number) {
    let low = 0;
    let high = this._events.length;
    let mid: number;
    while (low < high) {
      mid = Math.floor(low + high) >> 1;
      if (this._events[mid]._earliestTime! < deadline) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  _absTime(relTime: number) {
    return relTime + this.context.currentTime;
  }

  _relTime(absTime: number) {
    return absTime - this.context.currentTime;
  }
}

import { create } from 'zustand';
import WAAClock, { Event } from './WAAClock';

type TrackerState = {
  audioCtx: AudioContext;
  clock: WAAClock;
  steps: number[];
  currentStep: number;
  tickEvent: Event | null;
  tempo: number;
  playing: boolean;
};

export const useTrackerStore = create<TrackerState>(set => {
  const audioCtx = new AudioContext();
  return {
    audioCtx,
    clock: new WAAClock(audioCtx),
    steps: [220, 440, 880, 440, 220, 0, 220, 0, 220, 440, 880, 440, 220, 0, 220, 0],
    currentStep: 0,
    tickEvent: null,
    tempo: 120,
    playing: false,
  };
});

export function playSteps() {
  const { audioCtx, clock, tempo, playing, tickEvent } = useTrackerStore.getState();

  if (!playing) {
    useTrackerStore.setState({ currentStep: -1 });

    clock.start();
    useTrackerStore.setState({
      tickEvent: clock.callbackAtTime(handleTick as () => void, audioCtx.currentTime).repeat(60 / tempo),
      playing: true,
    });
  } else {
    useTrackerStore.setState({ playing: false });

    clock.stop();
    if (tickEvent) {
      tickEvent.clear();
      useTrackerStore.setState({ tickEvent: null });
    }
  }
}

function playNote(audioCtx: AudioContext, deadline: number, frequency: number) {
  const oscillator = audioCtx.createOscillator();
  oscillator.frequency.setValueAtTime(frequency, deadline);
  oscillator.start(deadline);

  const amplifier = audioCtx.createGain();
  oscillator.connect(amplifier);
  amplifier.gain.setValueAtTime(0, deadline);
  amplifier.gain.linearRampToValueAtTime(0.25, deadline + 0.02);
  amplifier.gain.linearRampToValueAtTime(0, deadline + 0.2);

  amplifier.connect(audioCtx.destination);

  setTimeout(() => {
    try {
      amplifier.disconnect();
    } catch {}
    try {
      oscillator.disconnect();
    } catch {}
  }, 3000);
}

function handleTick({ deadline }: { deadline: number }) {
  const { currentStep, steps, audioCtx } = useTrackerStore.getState();

  const nextStep = currentStep + 1;
  useTrackerStore.setState({ currentStep: nextStep });

  if (steps[nextStep % steps.length]) {
    playNote(audioCtx, deadline, steps[nextStep % steps.length]);
  }
}

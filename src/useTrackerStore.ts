import { create } from 'zustand';
import WAAClock, { Event } from './WAAClock';
// import { immer } from 'zustand/middleware/immer';
import { type NoteEnum, PitchTable } from './constants';

export type Channel = { waveform: string; steps: NoteEnum[] };

type TrackerState = {
  channels: Channel[];
  currentStep: number;
  tickEvent: Event | null;
  tempo: number;
  playing: boolean;
};

const audioCtx = new AudioContext();

const clock = new WAAClock(audioCtx);

export const useTrackerStore = create<TrackerState>(() => {
  return {
    channels: [
      {
        waveform: 'sine',
        steps: [
          'C-4',
          'E-4',
          'G-4',
          'E-4',
          'C-4',
          '---',
          'C-4',
          '---',
          'C-4',
          'E-4',
          'G-4',
          'E-4',
          'C-4',
          '---',
          'C-4',
          '---',
        ],
      },
      {
        waveform: 'sawtooth',
        steps: [
          'E-4',
          '---',
          'D-4',
          '---',
          'E-4',
          'F-4',
          'G-4',
          'F-4',
          'E-4',
          '---',
          'D-4',
          '---',
          'E-4',
          'F-4',
          'G-4',
          'F-4',
        ],
      },
    ],
    currentStep: 0,
    tickEvent: null,
    tempo: 120,
    playing: false,
  };
});

export function playSteps() {
  const { tempo, playing, tickEvent } = useTrackerStore.getState();

  if (!playing) {
    useTrackerStore.setState({ currentStep: -1 });

    clock.start();
    useTrackerStore.setState({
      tickEvent: clock.callbackAtTime(handleTick as () => void, audioCtx.currentTime).repeat(60 / tempo / 4),
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

function playNote(audioCtx: AudioContext, deadline: number, pitch: NoteEnum, waveform: string) {
  const oscillator = audioCtx.createOscillator();
  oscillator.frequency.setValueAtTime(PitchTable[pitch], deadline);
  oscillator.type = waveform as OscillatorType;
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
  const { currentStep, channels } = useTrackerStore.getState();

  const nextStep = currentStep + 1;
  useTrackerStore.setState({ currentStep: nextStep });

  channels.forEach(channel => {
    if (channel.steps[nextStep % channel.steps.length]) {
      playNote(audioCtx, deadline, channel.steps[nextStep % channel.steps.length], channel.waveform);
    }
  });
}

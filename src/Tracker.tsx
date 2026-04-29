import { Play, Square } from 'lucide-react';

import { playSteps, useTrackerStore } from './useTrackerStore';
import { pitchByKey, WaveformTable, type NoteEnum } from './constants';

export default function Tracker() {
  const { channels, playing, currentStep } = useTrackerStore();

  return (
    <div className="p-4">
      <button onClick={playSteps} className="mb-4 px-4 py-2 bg-green-500 text-white rounded">
        {playing ? (
          <div className="flex items-center gap-2">
            Stop <Square />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            Play <Play />
          </div>
        )}
      </button>

      <div className={`flex justify-start`}>
        {channels.map((channel, i) => (
          <div key={i} className="grid">
            <select
              value={channel.waveform}
              onChange={e =>
                useTrackerStore.setState(state => ({
                  channels: state.channels.map((c, ci) =>
                    ci === i ? { ...c, waveform: e.target.value as (typeof WaveformTable)[number] } : c,
                  ),
                }))
              }
            >
              {WaveformTable.map((waveform, j) => (
                <option key={j} value={waveform}>
                  {waveform}
                </option>
              ))}
            </select>
            <div className="grid">
              {channel.steps.map((step, j) => (
                <input
                  type="text"
                  key={j}
                  value={step}
                  onKeyUp={e => keyUp(e, i, j, channel.steps)}
                  onChange={() => {}}
                  className={`border-2 border-gray-300 ${currentStep % channel.steps.length === j ? 'border-red-500' : 'border-gray-300'} rounded px-1 py-0`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function keyUp(e: React.KeyboardEvent<HTMLInputElement>, i: number, j: number, steps: NoteEnum[]) {
  const newSteps = [...steps];
  newSteps[j] = pitchByKey[e.key] || '---';
  useTrackerStore.setState(state => ({
    channels: state.channels.map((c, ci) => (ci === i ? { ...c, steps: newSteps } : c)),
  }));
}

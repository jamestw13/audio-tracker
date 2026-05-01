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
            <div className="flex flex-col border-2 border-gray-300 rounded-xs">
              {channel.steps.map((step, j) => (
                <div className="flex  items-center" key={j}>
                  <input
                    type="text"
                    value={step.pitch}
                    onKeyUp={e => pitchKeyUp(e, i, j, channel.steps)}
                    onChange={() => {}}
                    className={`w-12 ${currentStep % channel.steps.length === j ? 'bg-red-900' : j % 4 === 0 ? 'bg-blue-900' : j % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'} px-1 py-0 `}
                  />
                  <input
                    type="text"
                    value={step.instrument}
                    onKeyUp={e => instrumentKeyUp(e, i, j, channel.steps)}
                    onChange={() => {}}
                    className={`w-12 ${currentStep % channel.steps.length === j ? 'bg-red-900' : j % 4 === 0 ? 'bg-blue-900' : j % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'} px-1 py-0 `}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function pitchKeyUp(
  e: React.KeyboardEvent<HTMLInputElement>,
  i: number,
  j: number,
  steps: { pitch: NoteEnum; instrument: number }[],
) {
  const newSteps = [...steps];

  newSteps[j] = { ...newSteps[j], pitch: pitchByKey[e.key] || '---' };
  useTrackerStore.setState(state => {
    const newChannel = { ...state.channels[i], steps: newSteps };
    return {
      channels: [...state.channels.slice(0, i), newChannel, ...state.channels.slice(i + 1)],
    };
  });
}

function instrumentKeyUp(
  e: React.KeyboardEvent<HTMLInputElement>,
  i: number,
  j: number,
  steps: { pitch: NoteEnum; instrument: number }[],
) {
  if (!WaveformTable[Number(e.key)]) return;
  const newSteps = [...steps];
  newSteps[j] = { ...newSteps[j], instrument: Number(e.key) };
  useTrackerStore.setState(state => {
    const newChannel = { ...state.channels[i], steps: newSteps };
    return {
      channels: [...state.channels.slice(0, i), newChannel, ...state.channels.slice(i + 1)],
    };
  });
}

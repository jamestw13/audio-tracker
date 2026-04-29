import { Play, Square } from 'lucide-react';

import { playSteps, useTrackerStore } from './useTrackerStore';

export default function Tracker() {
  const { steps, playing, currentStep } = useTrackerStore();

  return (
    <div className="controls-grid p-4">
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

      <div className="grid">
        {steps.map((step, i) => (
          <input
            type="number"
            key={i}
            value={step}
            onChange={e => {
              const newSteps = [...steps];
              newSteps[i] = Number(e.target.value);
              useTrackerStore.setState({ steps: newSteps });
            }}
            className={`border-2 border-gray-300 ${currentStep % steps.length === i ? 'border-red-500' : 'border-gray-300'} rounded px-1 py-0`}
          />
        ))}
      </div>
    </div>
  );
}

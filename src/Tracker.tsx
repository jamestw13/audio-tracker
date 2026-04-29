import { useState, useRef } from 'react';
import WAAClock from './WAAClock';

import { Play, Square } from 'lucide-react';
import { DrumMachine } from './basicBeat';

import { playSteps, useTrackerStore } from './useTrackerStore';

export default function Tracker() {
  const { steps } = useTrackerStore();
  const currentStep = useTrackerStore(state => state.currentStep);
  return (
    <div className="controls-grid p-4">
      <button onClick={playSteps} className="mb-4 px-4 py-2 bg-green-500 text-white rounded">
        Play Note
      </button>

      <div className="grid">
        {steps.map((step, i) => (
          <input
            type="number"
            key={i}
            value={step}
            onChange={e => {
              const { steps: newSteps } = useTrackerStore.getState();
              newSteps[i] = Number(e.target.value);

              useTrackerStore.setState({ steps: newSteps });
            }}
            className={`border-2 border-gray-300 border-${currentStep % steps.length === i ? 'red-500' : 'gray-300'} rounded px-1 py-0`}
          />
        ))}
      </div>
      {/* <DrumMachine />

      <div className="flex gap-3">
        <button className="flex items-center gap-2" onClick={handlePlayClick}>
          Play <Play />
        </button>
        <button className="flex items-center gap-2" onClick={handleStopClick}>
          Stop <Square />
        </button>
      </div>
      <div className={`flex gap-1`}>
        {channels.map((channel, i) => (
          <ChannelComponent
            key={i}
            channelsRef={channelsRef}
            channel={channel}
            setChannels={setChannels}
            index={i}
            currentStep={currentStep}
          />
        ))}
      </div> */}
    </div>
  );
}

function ChannelComponent({ channel, setChannels, channelsRef, index, currentStep }) {
  const chIndex = typeof channel?.index === 'number' ? channel.index : index;

  return (
    <div className="bg-blue-600 border border-blue-500 grid w-fit">
      <div>Channel {chIndex + 1}</div>
      <div className="grid">
        {channel.steps.map((step, i) => (
          <input
            key={i}
            type="number"
            className={`border-2 ${currentStep % channel.steps.length === i ? 'bg-red-500' : 'bg-blue-500'} bg-transparent px-2 py-1`}
            value={step}
            onChange={e => {
              setChannels(prev => {
                const newChannels = [...prev];
                newChannels[index] = {
                  ...newChannels[index],
                  steps: newChannels[index].steps.map((s, si) => (si === i ? Number(e.target.value) : s)),
                };
                channelsRef.current = newChannels;
                return newChannels;
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

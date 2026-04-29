import { useState, useRef, useEffect } from 'react';
import WAAClock from './WAAClock';

export function DrumMachine() {
  const [steps, setSteps] = useState([440, 0, 220, 0, 0, 0, 220, 0]);
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState(180);

  const tempoRef = useRef(null);
  const contextRef = useRef(null);
  const clockRef = useRef(null);
  const tickEventRef = useRef(null);
  const stepsRef = useRef(steps);

  useEffect(() => {
    contextRef.current = new window.AudioContext();
    tempoRef.current = tempo;
    clockRef.current = new WAAClock(contextRef.current);
    return () => {
      if (tickEventRef.current) tickEventRef.current.clear();
      if (clockRef.current) clockRef.current.stop();
      if (contextRef.current) contextRef.current.close();
    };
  }, []);

  const triggerSound = (context, deadline, step) => {
    const oscillator = context.createOscillator();
    oscillator.frequency.setValueAtTime(step, deadline);
    oscillator.start(deadline);
    oscillator.frequency.linearRampToValueAtTime(50, deadline + 0.15);

    const amplifier = context.createGain();
    oscillator.connect(amplifier);
    amplifier.gain.setValueAtTime(0, deadline);
    amplifier.gain.linearRampToValueAtTime(0.25, deadline + 0.02);
    amplifier.gain.linearRampToValueAtTime(0, deadline + 0.2);

    amplifier.connect(context.destination);

    setTimeout(() => {
      try {
        amplifier.disconnect();
      } catch {}
      try {
        oscillator.disconnect();
      } catch {}
    }, 3000);
  };

  const handleTick = ({ deadline }) => {
    setCurrentStep(prev => {
      const newStep = prev + 1;
      if (stepsRef.current[newStep % stepsRef.current.length]) {
        triggerSound(contextRef.current, deadline, stepsRef.current[newStep % stepsRef.current.length]);
      }
      return newStep;
    });
  };

  const handlePlayPress = () => {
    if (!playing) {
      setPlaying(true);
      setCurrentStep(-1);
      clockRef.current.start();
      tickEventRef.current = clockRef.current
        .callbackAtTime(handleTick, contextRef.current.currentTime)
        .repeat(60 / tempoRef.current / 4);
    } else {
      setPlaying(false);
      clockRef.current.stop();
      if (tickEventRef.current) {
        tickEventRef.current.clear();
        tickEventRef.current = null;
      }
    }
  };

  return (
    <div>
      <div>{`Current Step: ${currentStep % steps.length}`}</div>
      <input
        type="range"
        min="60"
        max="240"
        value={tempo}
        onChange={e => {
          setTempo(() => {
            const newTempo = Number(e.target.value);
            tempoRef.current = newTempo;
            return newTempo;
          });
        }}
      />
      <div className="flex">
        {steps.map((step, i) => (
          <div
            onClick={() => {
              setSteps(prev => {
                const newSteps = prev.map((s, si) => (si === i ? (s === 440 ? 0 : s === 220 ? 440 : 220) : s));
                stepsRef.current = newSteps;
                return newSteps;
              });
            }}
            key={i}
            className={`w-6 h-6 ${step === 440 ? 'bg-blue-500' : step === 220 ? 'bg-green-500' : step === 200 ? 'bg-red-300' : 'bg-gray-300'} ${currentStep % steps.length === i ? 'border-2 border-red-500' : ''}`}
          />
        ))}
      </div>
      <button onClick={handlePlayPress}>{playing ? 'Stop' : 'Play'}</button>
    </div>
  );
}

import Tracker from './Tracker';

function App() {
  return (
    <div className="container-card mx-auto">
      <h1>Simple WebAudio + WAAClock Demo</h1>
      <p className="muted">Use controls below to start audio, play notes, or schedule a note 1s in the future.</p>
      <div className="mt-4">
        <Tracker />
      </div>
    </div>
  );
}

export default App;

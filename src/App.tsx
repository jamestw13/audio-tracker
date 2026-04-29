import Tracker from './Tracker';

function App() {
  return (
    <>
      <div className="flex justify-between mx-auto items-baseline w-full px-20">
        <h1>Audio Tracker</h1>
        <p className="muted">Building out a web-based audio tracker</p>
      </div>
      <div className="mt-4 mx-auto ">
        <Tracker />
      </div>
    </>
  );
}

export default App;

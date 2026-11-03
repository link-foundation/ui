import './App.css';
export function App({ actions = {} }) {
  return (
    <>
      <div id="app">
        <div id="body" className="ui-0">
          <p id="greeting">Hello, links</p>
          <button
            id="ok"
            className="ui-1"
            onClick={() => {
              actions['navigate']?.('home');
            }}
          >
            OK
          </button>
        </div>
      </div>
    </>
  );
}

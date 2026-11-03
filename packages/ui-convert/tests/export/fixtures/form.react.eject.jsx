import './App.css';
export function App({ actions = {} }) {
  return (
    <>
      <form id="login" method="post">
        <label id="email-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="text"
          name="email"
          placeholder="you@example.com"
        />
        <input id="remember" type="checkbox" name="remember" />
        <button id="ok">Sign in</button>
      </form>
    </>
  );
}

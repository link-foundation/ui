# Source export preview

From the repository root, after `npm ci`:

```bash
node examples/code-export/serve.mjs
```

Open <http://127.0.0.1:4175>. The script exports the same LiNo document to
React JSX and a Vue SFC in the example's ignored `dist/` directory and serves
them with Vite. Both use the actual exporter and call the supplied `navigate`
handler when OK is pressed. Stop the server with Ctrl+C.

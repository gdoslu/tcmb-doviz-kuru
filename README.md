# tcmb-doviz-kuru

Indicative exchange rates announced by the Central Bank of Turkey (TCMB).

| Package                                               | What                                       |
| ----------------------------------------------------- | ------------------------------------------ |
| [`tcmb-doviz-kuru`](packages/tcmb-doviz-kuru)         | Typed Node.js library, one dependency      |
| [`tcmb-doviz-kuru-mcp`](packages/tcmb-doviz-kuru-mcp) | MCP server for Claude and other AI clients |

## Development

npm workspaces; run everything from the repository root.

```bash
npm install
npm test             # offline tests of both packages (node:test)
npm run coverage     # library tests + coverage report, fails below 100%
LIVE=1 npm test      # also hit the real TCMB endpoint
npm run lint         # eslint + prettier
npm run typecheck
npm run build
```

The MCP server imports the library's built `dist/`, so the scripts above build the library first.

Pushing to `master` publishes every package whose `version` is not yet on npm, the library first.

## License

Copyright (c) 2016 Gokhan Doslu. Released under the MIT license.

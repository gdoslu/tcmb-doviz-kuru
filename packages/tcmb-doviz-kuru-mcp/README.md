# tcmb-doviz-kuru-mcp

[MCP](https://modelcontextprotocol.io) server for the indicative exchange rates announced by the
Central Bank of Turkey (TCMB), built on [`tcmb-doviz-kuru`](https://www.npmjs.com/package/tcmb-doviz-kuru).
Requires Node.js 22.12+.

## Setup

Claude Code:

```bash
claude mcp add tcmb -- npx -y tcmb-doviz-kuru-mcp
```

Claude Desktop and other clients (`claude_desktop_config.json` or equivalent):

```json
{
  "mcpServers": {
    "tcmb": { "command": "npx", "args": ["-y", "tcmb-doviz-kuru-mcp"] }
  }
}
```

## Tool

### `get_exchange_rates`

| Argument   | Type     | Description                                   |
| ---------- | -------- | --------------------------------------------- |
| `date`     | `string` | `YYYY-MM-DD`. Omit for the latest bulletin.   |
| `currency` | `string` | Only this currency, e.g. `USD`. Omit for all. |

Returns the bulletin as JSON, in the
[library's result format](https://github.com/gdoslu/tcmb-doviz-kuru/tree/master/packages/tcmb-doviz-kuru#result):
rates in Turkish lira per `unit` of the currency (`JPY` is quoted per 100). Weekends and public
holidays have no bulletin and return a tool error.

The server only ever requests `https://www.tcmb.gov.tr`; the source URL is not configurable from
the tool.

## License

Copyright (c) 2016 Gokhan Doslu. Released under the MIT license.

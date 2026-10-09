# tcmb-doviz-kuru

Get Indicative Exchange Rates Announced by the Central Bank of Turkey (TCMB).

Typed, promise-based, one dependency. Requires Node.js 22.12+.

Using an AI assistant? [`tcmb-doviz-kuru-mcp`](https://www.npmjs.com/package/tcmb-doviz-kuru-mcp) serves the same rates over MCP.

## Install

```bash
npm i tcmb-doviz-kuru
```

## Usage

```ts
import { getExchangeRates } from 'tcmb-doviz-kuru';

const today = await getExchangeRates();
const usd = today.currencies.find((c) => c.code === 'USD');
console.log(today.date, usd?.forexSelling);

// Archived rates for a given day
const rates = await getExchangeRates({ date: '2024-01-15' });

// Only one currency
const {
  currencies: [eur],
} = await getExchangeRates({ currency: 'EUR' });
```

CommonJS works too, via `require(esm)`:

```js
const { getExchangeRates } = require('tcmb-doviz-kuru');
```

### Options

| Option     | Type           | Description                                                           |
| ---------- | -------------- | --------------------------------------------------------------------- |
| `date`     | `string`       | `YYYY-MM-DD`. Omit for the latest bulletin.                           |
| `currency` | `CurrencyCode` | Only return this currency (e.g. `USD`, case-insensitive).             |
| `baseUrl`  | `string`       | Archive root, default `https://www.tcmb.gov.tr/kurlar` (e.g. mirror). |
| `url`      | `string`       | Fetch this exact URL instead (ignores `date` and `baseUrl`).          |
| `signal`   | `AbortSignal`  | Cancel the request. Defaults to a 10 second timeout.                  |

Only `https://` URLs are fetched and redirects are not followed. Never build `url` or `baseUrl`
from end-user input: that would let users make your server request arbitrary hosts (SSRF).

### Which day's rates?

TCMB publishes a bulletin on business days at around 15:30 Turkey time. Without a `date` you get
the latest one, which is the previous business day's on weekends, holidays and in the morning.
Always use `rates.date`, not the current date.

### Errors

| Rejects with      | When                                                                          |
| ----------------- | ----------------------------------------------------------------------------- |
| `TypeError`       | Invalid input: a `date` that is not a real `YYYY-MM-DD` day, a non-HTTPS URL. |
| `TcmbError`       | TCMB answered, but not with a bulletin. See `status` below.                   |
| `TimeoutError`    | No answer within 10 seconds (default `signal`).                               |
| `TypeError`/other | Network failures, as thrown by `fetch`.                                       |

`TcmbError` has `status` (the HTTP status, or `undefined` when the response was not a valid
bulletin) and `url`. TCMB publishes no rates on weekends and public holidays, so such dates
reject with `status === 404`:

```ts
import { getExchangeRates, TcmbError } from 'tcmb-doviz-kuru';

try {
  await getExchangeRates({ date: '2026-10-03' }); // a Saturday
} catch (err) {
  if (err instanceof TcmbError && err.status === 404) {
    // no bulletin that day, e.g. try the previous day
  } else throw err;
}
```

### Result

```ts
{
  date: '2026-10-08',
  bulletinNo: '2026/190',
  currencies: [
    {
      code: 'USD',
      unit: 1,
      name: 'ABD DOLARI',
      nameEn: 'US DOLLAR',
      forexBuying: 49.1267,
      forexSelling: 49.2152,
      banknoteBuying: 49.0923,
      banknoteSelling: 49.289,
      crossRateUSD: null,
      crossRateOther: null,
    },
    // ...
  ],
}
```

Missing or non-numeric values are `null`, missing names are `''`. Note that `unit` can be greater than 1 (e.g. `JPY` is quoted per 100).

`parseRates(xml)` and `sourceUrl(date?, baseUrl?)` are exported as well, if you fetch the XML
yourself. `parseRates` throws a `TcmbError` for anything that is not a TCMB bulletin.

## Migrating from v2

- The callback API is gone: `tcmbDovizKuru(cb)` → `await getExchangeRates()`.
- Errors are rejected `Error` instances instead of strings; TCMB-side failures are `TcmbError`.
- The result is flat and camel-cased: `data.tarihDate.currency[i].attributes.kod` → `rates.currencies[i].code`.
- The `encoding` argument was removed; it is read from the XML declaration (archives before 2017 are ISO-8859-9).
- Node.js 22.12+ is required.

## Development

See the [repository README](https://github.com/gdoslu/tcmb-doviz-kuru#development).

## License

Copyright (c) 2016 Gokhan Doslu. Released under the MIT license.

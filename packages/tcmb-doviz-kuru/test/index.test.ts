import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it, mock } from 'node:test';
import { getExchangeRates, parseRates, sourceUrl, TcmbError } from '../src/index.ts';

const fixture = readFileSync(new URL('./fixture.xml', import.meta.url), 'utf8');

/** A one-currency bulletin; `currency` replaces the `<Currency>` element's children */
const bulletin = (currency: string, attrs = 'Tarih="01.01.2024" Bulten_No="2024/1"') =>
  `<Tarih_Date ${attrs}><Currency CurrencyCode="USD">${currency}</Currency></Tarih_Date>`;

const invalidXml = (reason: RegExp) => (err: unknown) =>
  err instanceof TcmbError && err.status === undefined && reason.test(err.message);

describe('sourceUrl', () => {
  it('returns today.xml without a date', () => {
    assert.equal(sourceUrl(), 'https://www.tcmb.gov.tr/kurlar/today.xml');
  });

  const archive: [date: string, path: string][] = [
    ['2024-01-15', '202401/15012024.xml'], // mid-month
    ['2024-01-01', '202401/01012024.xml'], // first day of year
    ['2023-12-31', '202312/31122023.xml'], // last day of year
    ['2024-02-29', '202402/29022024.xml'], // leap day
    ['2025-09-30', '202509/30092025.xml'], // month end
    ['2001-03-05', '200103/05032001.xml'], // old archive, single-digit day/month
  ];
  for (const [date, path] of archive) {
    it(`builds the archive url for ${date}`, () => {
      assert.equal(sourceUrl(date), `https://www.tcmb.gov.tr/kurlar/${path}`);
    });
  }

  it('builds a url for every month of a year', () => {
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      assert.equal(
        sourceUrl(`2025-${mm}-10`),
        `https://www.tcmb.gov.tr/kurlar/2025${mm}/10${mm}2025.xml`,
      );
    }
  });

  for (const bad of [
    '15.01.2024',
    '2024-1-5',
    '2024/01/15',
    '20240115',
    '',
    ' 2024-01-15',
    '2024-01-15T00:00',
  ]) {
    it(`rejects malformed date ${JSON.stringify(bad)}`, () => {
      assert.throws(() => sourceUrl(bad), TypeError);
    });
  }

  // well-formed but not on the calendar: must not turn into a misleading 404
  for (const bad of [
    '2024-02-30',
    '2023-02-29',
    '2024-04-31',
    '2024-13-01',
    '2024-00-10',
    '2024-01-00',
  ]) {
    it(`rejects impossible date ${bad}`, () => {
      assert.throws(() => sourceUrl(bad), TypeError);
    });
  }

  it('uses a custom base url', () => {
    assert.equal(
      sourceUrl(undefined, 'https://mirror.local/kurlar/'),
      'https://mirror.local/kurlar/today.xml',
    );
    assert.equal(
      sourceUrl('2024-01-15', 'https://mirror.local/kurlar'),
      'https://mirror.local/kurlar/202401/15012024.xml',
    );
  });
});

describe('parseRates', () => {
  const rates = parseRates(fixture);

  it('parses bulletin metadata', () => {
    assert.equal(rates.date, '2026-10-08');
    assert.equal(rates.bulletinNo, '2026/190');
    assert.equal(rates.currencies.length, 3);
  });

  it('maps currency fields', () => {
    assert.deepEqual(rates.currencies[0], {
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
    });
  });

  it('keeps Turkish characters and trims names', () => {
    const [, kzt, xdr] = rates.currencies;
    assert.equal(kzt?.name, 'KAZAKİSTAN TENGESİ');
    assert.equal(xdr?.name, 'ÖZEL ÇEKME HAKKI (SDR)');
    assert.equal(xdr?.nameEn, 'SPECIAL DRAWING RIGHT (SDR)');
  });

  it('maps empty values to null', () => {
    const [, kzt, xdr] = rates.currencies;
    assert.equal(kzt?.banknoteBuying, null);
    assert.equal(kzt?.crossRateUSD, 449.09);
    assert.equal(xdr?.forexSelling, null);
    assert.equal(xdr?.crossRateOther, 1.35202);
  });

  it('returns no currencies for an empty bulletin', () => {
    const empty = parseRates(
      '<Tarih_Date Tarih="01.01.2024" Date="01/01/2024" Bulten_No="2024/1"></Tarih_Date>',
    );
    assert.deepEqual(empty, { date: '2024-01-01', bulletinNo: '2024/1', currencies: [] });
  });

  it('maps missing or non-numeric values to null and missing names to ""', () => {
    const [usd] = parseRates(
      bulletin('<Unit>1</Unit><ForexBuying>abc</ForexBuying><ForexSelling>Infinity</ForexSelling>'),
    ).currencies;
    assert.deepEqual(usd, {
      code: 'USD',
      unit: 1,
      name: '',
      nameEn: '',
      forexBuying: null,
      forexSelling: null,
      banknoteBuying: null,
      banknoteSelling: null,
      crossRateUSD: null,
      crossRateOther: null,
    });
  });

  const broken: [what: string, xml: string, reason: RegExp][] = [
    ['an html page', '<html></html>', /missing Tarih_Date/],
    ['an empty root', '<Tarih_Date/>', /missing Tarih_Date/],
    ['a text-only root', '<Tarih_Date>x</Tarih_Date>', /missing Tarih_Date/],
    ['garbage', 'not xml <<<', /malformed XML/],
    ['a missing Tarih', bulletin('<Unit>1</Unit>', 'Bulten_No="1"'), /bad Tarih/],
    [
      'a malformed Tarih',
      bulletin('<Unit>1</Unit>', 'Tarih="2024-01-01" Bulten_No="1"'),
      /bad Tarih/,
    ],
    ['a missing Bulten_No', bulletin('<Unit>1</Unit>', 'Tarih="01.01.2024"'), /missing Bulten_No/],
    ['a missing Unit', bulletin('<Isim>X</Isim>'), /bad Unit for USD/],
    ['a non-numeric Unit', bulletin('<Unit>x</Unit>'), /bad Unit for USD/],
    [
      'a Currency without code',
      '<Tarih_Date Tarih="01.01.2024" Bulten_No="1"><Currency><Unit>1</Unit></Currency></Tarih_Date>',
      /without CurrencyCode/,
    ],
  ];
  for (const [what, xml, reason] of broken) {
    it(`throws TcmbError on ${what}`, () => {
      assert.throws(() => parseRates(xml), invalidXml(reason));
    });
  }

  it('keeps the parser error as cause', () => {
    assert.throws(
      () => parseRates('not xml <<<'),
      (err: unknown) => err instanceof TcmbError && err.cause instanceof Error,
    );
  });
});

describe('getExchangeRates', () => {
  afterEach(() => mock.restoreAll());

  it('fetches and parses rates for a date', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', () =>
      Promise.resolve(new Response(fixture)),
    );
    const rates = await getExchangeRates({ date: '2026-10-08' });
    assert.equal(fetchMock.mock.calls[0]?.arguments[0], sourceUrl('2026-10-08'));
    assert.equal(rates.currencies[0]?.code, 'USD');
  });

  it('filters by currency code', async () => {
    mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(fixture)));
    const rates = await getExchangeRates({ currency: 'kzt' });
    assert.deepEqual(
      rates.currencies.map((c) => c.code),
      ['KZT'],
    );
  });

  it('fetches today.xml without a date', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', () =>
      Promise.resolve(new Response(fixture)),
    );
    await getExchangeRates();
    assert.equal(fetchMock.mock.calls[0]?.arguments[0], sourceUrl());
  });

  it('prefers url over date and baseUrl, passes the signal, refuses redirects', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', () =>
      Promise.resolve(new Response(fixture)),
    );
    const { signal } = new AbortController();
    await getExchangeRates({
      url: 'https://x.local/r.xml',
      baseUrl: 'https://y.local',
      date: '2024-01-15',
      signal,
    });
    assert.deepEqual(fetchMock.mock.calls[0]?.arguments, [
      'https://x.local/r.xml',
      { signal, redirect: 'error' },
    ]);
  });

  it('uses baseUrl and a default timeout', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', () =>
      Promise.resolve(new Response(fixture)),
    );
    await getExchangeRates({ baseUrl: 'https://mirror.local/kurlar', date: '2024-01-15' });
    const [url, init] = fetchMock.mock.calls[0]?.arguments ?? [];
    assert.equal(url, 'https://mirror.local/kurlar/202401/15012024.xml');
    assert.ok(init?.signal instanceof AbortSignal);
  });

  for (const url of [
    'http://www.tcmb.gov.tr/kurlar/today.xml',
    'file:///etc/passwd',
    'not a url',
  ]) {
    it(`refuses ${url}`, async () => {
      const fetchMock = mock.method(globalThis, 'fetch');
      await assert.rejects(getExchangeRates({ url }), TypeError);
      await assert.rejects(getExchangeRates({ baseUrl: url }), TypeError);
      assert.equal(fetchMock.mock.callCount(), 0);
    });
  }

  it('decodes ISO-8859-9 archives', async () => {
    const xml =
      '<?xml version="1.0" encoding="ISO-8859-9"?><Tarih_Date Tarih="02.01.2014" Bulten_No="2014/1">' +
      '<Currency CurrencyCode="CHF"><Unit>1</Unit><Isim>\u00DDSV\u00DD\u00C7RE FRANGI</Isim>' +
      '<CurrencyName>SWISS FRANC</CurrencyName><ForexBuying>2.4112</ForexBuying><ForexSelling/>' +
      '<BanknoteBuying/><BanknoteSelling/><CrossRateUSD/><CrossRateOther/></Currency></Tarih_Date>';
    mock.method(globalThis, 'fetch', () =>
      Promise.resolve(new Response(Buffer.from(xml, 'latin1'))),
    );
    const rates = await getExchangeRates({ date: '2014-01-02' });
    assert.equal(rates.currencies[0]?.name, 'İSVİÇRE FRANGI');
  });

  it('reads a single-quoted encoding declaration', async () => {
    const xml = `<?xml version='1.0' encoding='ISO-8859-9'?>${bulletin('<Unit>1</Unit><Isim>\u00DDSV\u00DD\u00C7RE</Isim>')}`;
    mock.method(globalThis, 'fetch', () =>
      Promise.resolve(new Response(Buffer.from(xml, 'latin1'))),
    );
    const rates = await getExchangeRates();
    assert.equal(rates.currencies[0]?.name, 'İSVİÇRE');
  });

  it('rejects an unsupported encoding', async () => {
    const xml = `<?xml version="1.0" encoding="x-nope"?>${bulletin('<Unit>1</Unit>')}`;
    mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(xml)));
    await assert.rejects(getExchangeRates(), invalidXml(/unsupported encoding "x-nope"/));
  });

  it('defaults to UTF-8 without an XML declaration', async () => {
    const xml = fixture.slice(fixture.indexOf('<Tarih_Date'));
    mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(xml)));
    const rates = await getExchangeRates();
    assert.equal(rates.currencies[1]?.name, 'KAZAKİSTAN TENGESİ');
  });

  it('returns an empty list for an unknown currency', async () => {
    mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(fixture)));
    const rates = await getExchangeRates({ currency: 'XYZ' });
    assert.deepEqual(rates.currencies, []);
  });

  it('rejects on network errors', async () => {
    mock.method(globalThis, 'fetch', () => Promise.reject(new TypeError('fetch failed')));
    await assert.rejects(getExchangeRates(), /fetch failed/);
  });

  it('rejects http errors with a TcmbError carrying status and url', async () => {
    mock.method(globalThis, 'fetch', () =>
      Promise.resolve(new Response('', { status: 404, statusText: 'Not Found' })),
    );
    await assert.rejects(getExchangeRates({ date: '2026-10-10' }), (err: unknown) => {
      assert.ok(err instanceof TcmbError);
      assert.equal(err.name, 'TcmbError');
      assert.equal(err.status, 404);
      assert.equal(err.url, sourceUrl('2026-10-10'));
      assert.match(err.message, /404 Not Found/);
      return true;
    });
  });

  it('rejects an html error page served with 200', async () => {
    mock.method(globalThis, 'fetch', () =>
      Promise.resolve(new Response('<html><title>Page Not Found</title></html>')),
    );
    await assert.rejects(getExchangeRates(), invalidXml(/missing Tarih_Date/));
  });

  it('fetches live rates', { skip: !process.env.LIVE }, async () => {
    const rates = await getExchangeRates();
    assert.ok(rates.currencies.some((c) => c.code === 'USD' && c.forexBuying! > 0));
  });

  it('fetches live ISO-8859-9 archive', { skip: !process.env.LIVE }, async () => {
    const rates = await getExchangeRates({ date: '2014-01-02', currency: 'CHF' });
    assert.equal(rates.currencies[0]?.name, 'İSVİÇRE FRANGI');
  });

  it('rejects a live weekend with status 404', { skip: !process.env.LIVE }, async () => {
    await assert.rejects(
      getExchangeRates({ date: '2026-10-03' }),
      (err: unknown) => err instanceof TcmbError && err.status === 404,
    );
  });

  it('fetches live archived rates', { skip: !process.env.LIVE }, async () => {
    const rates = await getExchangeRates({ date: '2024-01-15', currency: 'usd' });
    assert.equal(rates.date, '2024-01-15');
    assert.equal(rates.currencies[0]?.code, 'USD');
  });
});

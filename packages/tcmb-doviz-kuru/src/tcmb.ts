import { XMLParser } from 'fast-xml-parser';
import type { Currency, ExchangeRates, Options, RawDocument } from './types.ts';

const DEFAULT_BASE_URL = 'https://www.tcmb.gov.tr/kurlar';
const DEFAULT_TIMEOUT_MS = 10_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  isArray: (name) => name === 'Currency',
});

/** Thrown when TCMB responds with an HTTP error or a document that is not a rate bulletin. */
export class TcmbError extends Error {
  /** HTTP status, e.g. `404` for weekends/holidays; `undefined` for invalid documents */
  readonly status: number | undefined;
  readonly url: string | undefined;

  constructor(message: string, options: { status?: number; url?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'TcmbError';
    this.status = options.status;
    this.url = options.url;
  }
}

const invalid = (reason: string, cause?: unknown): never => {
  throw new TcmbError(`Invalid TCMB XML: ${reason}`, { cause });
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Decodes using the XML declaration's encoding; archives before 2017 are ISO-8859-9. */
function decodeXml(bytes: ArrayBuffer): string {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 100));
  const encoding = /encoding=["']([^"']+)["']/i.exec(head)?.[1] ?? 'utf-8';
  let decoder;
  try {
    decoder = new TextDecoder(encoding);
  } catch (cause) {
    return invalid(`unsupported encoding "${encoding}"`, cause);
  }
  return decoder.decode(bytes);
}

/** Builds the TCMB URL for the given `YYYY-MM-DD` date, or today's rates if omitted. */
export function sourceUrl(date?: string, baseUrl = DEFAULT_BASE_URL): string {
  const base = baseUrl.replace(/\/+$/, '');
  if (date === undefined) return `${base}/today.xml`;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  // Date.parse rolls 2024-02-30 over to March 1st, so compare the round trip
  const time = m ? Date.parse(`${date}T00:00:00Z`) : NaN;
  if (!m || Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== date) {
    throw new TypeError(`Invalid date "${date}", expected a valid YYYY-MM-DD`);
  }
  const [, y, mo, d] = m;
  return `${base}/${y}${mo}/${d}${mo}${y}.xml`;
}

/** Parses a TCMB exchange rate XML document. Throws `TcmbError` if it is not one. */
export function parseRates(xml: string): ExchangeRates {
  let doc: RawDocument;
  try {
    doc = parser.parse(xml) as RawDocument;
  } catch (cause) {
    return invalid('malformed XML', cause);
  }
  const root = doc.Tarih_Date;
  if (!root || typeof root !== 'object') return invalid('missing Tarih_Date');
  const tarih = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(str(root.Tarih));
  if (!tarih) return invalid(`bad Tarih "${str(root.Tarih)}"`);
  const [, d, m, y] = tarih;
  const bulletinNo = str(root.Bulten_No) || invalid('missing Bulten_No');
  return {
    date: `${y}-${m}-${d}`,
    bulletinNo,
    currencies: (root.Currency ?? []).map((c): Currency => {
      const code = str(c.CurrencyCode) || invalid('Currency without CurrencyCode');
      return {
        code,
        unit: num(c.Unit) ?? invalid(`bad Unit for ${code}`),
        name: str(c.Isim),
        nameEn: str(c.CurrencyName),
        forexBuying: num(c.ForexBuying),
        forexSelling: num(c.ForexSelling),
        banknoteBuying: num(c.BanknoteBuying),
        banknoteSelling: num(c.BanknoteSelling),
        crossRateUSD: num(c.CrossRateUSD),
        crossRateOther: num(c.CrossRateOther),
      };
    }),
  };
}

/**
 * Fetches indicative exchange rates announced by the Central Bank of Turkey.
 * TCMB publishes no rates on weekends/holidays; such dates reject with a `TcmbError` (status 404).
 */
export async function getExchangeRates(options: Options = {}): Promise<ExchangeRates> {
  const url = options.url ?? sourceUrl(options.date, options.baseUrl);
  if (new URL(url).protocol !== 'https:') throw new TypeError(`Refusing non-HTTPS url: ${url}`);
  const res = await fetch(url, {
    signal: options.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    redirect: 'error', // never follow to http:// or another host
  });
  if (!res.ok) {
    throw new TcmbError(`TCMB request failed: ${res.status} ${res.statusText} (${url})`, {
      status: res.status,
      url,
    });
  }
  const rates = parseRates(decodeXml(await res.arrayBuffer()));
  const code = options.currency?.toUpperCase();
  if (code) rates.currencies = rates.currencies.filter((c) => c.code === code);
  return rates;
}

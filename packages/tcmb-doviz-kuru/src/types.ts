/**
 * Codes in TCMB's bulletin as of 2026-10. Any other string is still accepted, since the
 * list changes over time; the known codes only drive editor autocompletion.
 */
export type CurrencyCode =
  | 'USD'
  | 'AUD'
  | 'DKK'
  | 'EUR'
  | 'GBP'
  | 'CHF'
  | 'SEK'
  | 'CAD'
  | 'KWD'
  | 'NOK'
  | 'SAR'
  | 'JPY'
  | 'RON'
  | 'RUB'
  | 'CNY'
  | 'PKR'
  | 'QAR'
  | 'KRW'
  | 'AZN'
  | 'AED'
  | 'KZT'
  | 'XDR'
  | (string & {});

export interface Currency {
  code: CurrencyCode;
  unit: number;
  name: string;
  nameEn: string;
  forexBuying: number | null;
  forexSelling: number | null;
  banknoteBuying: number | null;
  banknoteSelling: number | null;
  crossRateUSD: number | null;
  crossRateOther: number | null;
}

export interface ExchangeRates {
  /** ISO date, e.g. `2026-10-08` */
  date: string;
  bulletinNo: string;
  currencies: Currency[];
}

export interface Options {
  /** `YYYY-MM-DD`; omit for today's rates */
  date?: string;
  /** Only return this currency code, e.g. `USD` (case-insensitive) */
  currency?: CurrencyCode;
  /** Archive root, defaults to `https://www.tcmb.gov.tr/kurlar`. Must be HTTPS. */
  baseUrl?: string;
  /** Overrides the source URL (`date` and `baseUrl` are ignored). Must be HTTPS. */
  url?: string;
  /** Defaults to a 10 second timeout */
  signal?: AbortSignal;
}

/** Raw `<Currency>` element as returned by the XML parser; nothing about it is guaranteed */
export type RawCurrency = Partial<
  Record<
    | 'CurrencyCode'
    | 'Unit'
    | 'Isim'
    | 'CurrencyName'
    | 'ForexBuying'
    | 'ForexSelling'
    | 'BanknoteBuying'
    | 'BanknoteSelling'
    | 'CrossRateUSD'
    | 'CrossRateOther',
    unknown
  >
>;

export interface RawDocument {
  Tarih_Date?: { Tarih?: unknown; Bulten_No?: unknown; Currency?: RawCurrency[] } | string;
}

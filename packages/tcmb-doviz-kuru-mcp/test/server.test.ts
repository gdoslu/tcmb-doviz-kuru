import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it, mock } from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { ExchangeRates } from 'tcmb-doviz-kuru';
import { createServer } from '../src/server.ts';

const fixture = readFileSync(
  new URL('../../tcmb-doviz-kuru/test/fixture.xml', import.meta.url),
  'utf8',
);

async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverTransport);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
}

const text = (result: { content?: unknown }) =>
  (result.content as { type: string; text: string }[])[0]!.text;

describe('MCP server', () => {
  afterEach(() => mock.restoreAll());

  it('lists get_exchange_rates', async () => {
    const { tools } = await (await connect()).listTools();
    assert.deepEqual(
      tools.map((t) => t.name),
      ['get_exchange_rates'],
    );
  });

  it('returns rates for a date and currency', async () => {
    const fetch = mock.method(globalThis, 'fetch', () => Promise.resolve(new Response(fixture)));
    const result = await (
      await connect()
    ).callTool({ name: 'get_exchange_rates', arguments: { date: '2024-01-15', currency: 'usd' } });
    assert.equal(result.isError, undefined);
    const rates = JSON.parse(text(result)) as ExchangeRates;
    assert.deepEqual(
      rates.currencies.map((c) => c.code),
      ['USD'],
    );
    assert.equal(
      fetch.mock.calls[0]?.arguments[0],
      'https://www.tcmb.gov.tr/kurlar/202401/15012024.xml',
    );
  });

  it('reports a missing bulletin as a tool error', async () => {
    mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('', { status: 404 })));
    const result = await (
      await connect()
    ).callTool({ name: 'get_exchange_rates', arguments: { date: '2026-10-03' } });
    assert.equal(result.isError, true);
    assert.match(text(result), /404/);
  });
});

import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { getExchangeRates } from 'tcmb-doviz-kuru';
import { z } from 'zod';

// Same relative path from src/ and dist/
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string;
  version: string;
};

export function createServer(): McpServer {
  const server = new McpServer({ name: pkg.name, version: pkg.version });
  server.registerTool(
    'get_exchange_rates',
    {
      title: 'TCMB exchange rates',
      description:
        'Indicative exchange rates of the Central Bank of Turkey (TCMB), in Turkish lira (TRY). ' +
        'Rates are per `unit` of the currency, which can be more than 1 (e.g. JPY is per 100). ' +
        'Without a date, returns the latest bulletin (published business days ~15:30 Turkey time); ' +
        'use the returned `date`, not today. Weekends and public holidays have no bulletin.',
      inputSchema: z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('YYYY-MM-DD; omit for the latest bulletin'),
        currency: z.string().optional().describe('Only this currency code, e.g. USD'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    // No url/baseUrl: arguments come from the model, which a prompt injection can steer into
    // requesting internal hosts from the user's machine (SSRF). Always fetch from TCMB.
    async ({ date, currency }) => {
      try {
        const rates = await getExchangeRates({ date, currency });
        return { content: [{ type: 'text', text: JSON.stringify(rates) }] };
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text }], isError: true };
      }
    },
  );
  return server;
}

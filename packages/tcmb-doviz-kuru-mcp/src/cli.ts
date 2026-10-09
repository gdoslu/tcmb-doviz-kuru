#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.ts';

await createServer().connect(new StdioServerTransport());

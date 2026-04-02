#!/usr/bin/env node

import { runCli } from '../src/cli-core.js';

process.exitCode = await runCli(process.argv.slice(2));

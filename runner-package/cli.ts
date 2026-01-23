#!/usr/bin/env node

import { runTestSession } from './runner.js';

runTestSession().catch((error: Error) => {
    console.error('\nTest run failed:', error);
    process.exit(1);
});

// src/instrument.ts
// This file initializes Sentry and MUST be imported before other modules.
// Use: node --import ./dist/instrument.js dist/index.js

import * as Sentry from '@sentry/node';

// Only initialize if DSN is provided and we're in production
const dsn = process.env.SENTRY_DSN;
const isProduction = process.env.NODE_ENV === 'production';

if (dsn && isProduction) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
    // Optionally filter out expected errors
    beforeSend(event) {
      // Don't send if it's a known expected error
      // Example: if (event.exception?.values?.[0]?.type === 'SomeExpectedError') return null;
      return event;
    },
  });

  console.log('Sentry initialized for production error tracking');
}

/* Vitest runs in Node. The app modules end with Object.assign(window, …) (the
   console API) and data.js peeks at window on load, so give them one. Dates are
   checked in UTC so study-day boundaries (04:00 local) are the same everywhere. */
process.env.TZ = 'UTC';
(globalThis as any).window = globalThis;

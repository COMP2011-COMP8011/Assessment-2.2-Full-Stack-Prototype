import { getDatabaseMode, isDatabaseConnected } from '../config/db.js';
import { transactionMode } from '../utils/transaction.js';

/** GET /health — lets the frontend (and markers) check the API and database are up. */
export function health(_req, res) {
  const connected = isDatabaseConnected();
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connected' : 'disconnected',
    databaseMode: getDatabaseMode(),
    transactions: transactionMode(),
    time: new Date().toISOString(),
  });
}

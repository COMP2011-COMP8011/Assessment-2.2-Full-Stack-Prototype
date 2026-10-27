import mongoose from 'mongoose';

// Assessment 1 §3.8 keeps related writes (e.g. completing a task and adding the party's XP)
// in one MongoDB transaction. Transactions need a replica set — MongoDB Atlas and the
// in-memory demo database both are one. A plain local `mongod` is not, so on that setup we
// fall back to running the same steps without a session. Each step is still an atomic
// single-document update with a guard condition, so data stays consistent for normal use.
let transactionsSupported = null; // unknown until the first attempt

export function isTransactionUnsupportedError(err) {
  const codes = [err?.code, err?.originalError?.code, err?.errorResponse?.code];
  if (codes.includes(20)) return true; // IllegalOperation: transactions on a standalone server
  return /Transaction numbers are only allowed|does not support retryable writes|replica set member or mongos/i.test(
    err?.message || '',
  );
}

/**
 * Runs `work(session)` inside a transaction and returns its result. If the database
 * can't run transactions, runs `work(null)` instead (Mongoose treats a null session as none).
 * `work` may be retried by the driver on transient errors, so it must only touch the database.
 */
export async function runInTransaction(work) {
  if (transactionsSupported === false) return work(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    transactionsSupported = true;
    return result;
  } catch (err) {
    if (transactionsSupported !== true && isTransactionUnsupportedError(err)) {
      transactionsSupported = false;
      console.warn('[db] This MongoDB server does not support transactions (standalone). Using atomic single-document updates instead.');
      return work(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

export function transactionMode() {
  if (transactionsSupported === null) return 'untested';
  return transactionsSupported ? 'transactions' : 'single-document';
}

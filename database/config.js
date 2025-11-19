/*
  MySQL has been removed from this project during the migration to MongoDB.
  This file intentionally provides a compatibility shim that surfaces a clear
  error when code attempts to call the old `query`/`transaction` helpers.

  If you intentionally kept references to `require('../database/config')`
  in some modules, please migrate those routes to use the Mongoose models
  (in `server/models/`) or implement a DAL backed by Mongo.
*/

// MySQL removed: compatibility shim.
// During the migration to MongoDB, MySQL helper was intentionally removed.
// This shim keeps require() calls working but throws a clear error if used.

const err = new Error('MySQL support removed. Use MongoDB (Mongoose) instead.');
err.code = 'MYSQL_REMOVED';

function throwRemoved() {
  throw err;
}

module.exports = {
  pool: null,
  query: throwRemoved,
  transaction: throwRemoved,
  healthCheck: async () => ({ ok: false, error: 'MySQL removed from codebase' }),
};
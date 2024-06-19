const sql = require('mssql');

let pool = undefined;

async function PoolCreation() {
  const config = {
    user: process.env.user,
    password: process.env.password,
    server: process.env.server,
    database: 'hit',
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 15000,
    },
    requestTimeout: 10000,
  };
  pool = await new sql.ConnectionPool(config).connect();
}

async function runSql(sqlQ, db) {
  try {
    if (!pool) await PoolCreation();
    const c = `use ${db}; ${sqlQ}`;
    let r = await pool.request().query(c);
    return r.recordset; // Devuelve el conjunto de registros
  } catch (error) {
    console.log(`Error runSql ${sqlQ}: ${error}`)
  }

}

module.exports = {
  runSql
};

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: false }
    : undefined,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5
});

pool.on("error", (err) => {
  console.error("Erreur PostgreSQL:", err.message);
});

async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL non configurée.");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_data (
      data_key TEXT PRIMARY KEY,
      data_value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log("Table PostgreSQL app_data prête.");
}

async function getData(key, fallback = []) {
  const result = await pool.query(
    "SELECT data_value FROM app_data WHERE data_key = $1",
    [key]
  );

  return result.rows.length ? result.rows[0].data_value : fallback;
}

async function saveData(key, value) {
  await pool.query(
    `INSERT INTO app_data (data_key, data_value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (data_key)
     DO UPDATE SET data_value = EXCLUDED.data_value,
                   updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

async function importData(key, value) {
  await pool.query(
    `INSERT INTO app_data (data_key, data_value)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (data_key) DO NOTHING`,
    [key, JSON.stringify(value)]
  );
}

module.exports = {
  pool,
  initializeDatabase,
  getData,
  saveData,
  importData
};

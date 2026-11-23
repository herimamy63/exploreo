const fs = require("fs");
const path = require("path");
const {
  initializeDatabase,
  importData,
  pool
} = require("./database");

const DATA_DIR = path.join(__dirname, "data");

const datasets = [
  ["destinations", "destinations.json"],
  ["bookings", "bookings.json"],
  ["knowledge", "knowledge.json"],
  ["site-content", "site-content.json"],
  ["admin-users", "admin-users.json"]
];

async function migrate() {
  await initializeDatabase();

  for (const [key, filename] of datasets) {
    const filepath = path.join(DATA_DIR, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error(`Fichier manquant: ${filename}`);
    }

    const value = JSON.parse(fs.readFileSync(filepath, "utf8"));

    await importData(key, value);

    const count = Array.isArray(value) ? value.length : 1;
    console.log(`${key}: import vérifié (${count} élément(s)).`);
  }

  console.log("Migration initiale terminée.");
}

migrate()
  .catch((err) => {
    console.error("Échec migration:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

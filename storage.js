const fs = require("fs");
const path = require("path");
const {
  initializeDatabase,
  getData,
  saveData,
  importData
} = require("./database");

const DATA_DIR = path.join(__dirname, "data");

const files = {
  "destinations.json": "destinations",
  "bookings.json": "bookings",
  "knowledge.json": "knowledge",
  "site-content.json": "site-content",
  "admin-users.json": "admin-users"
};

const cache = {};
const useDatabase = Boolean(process.env.DATABASE_URL);

async function initializeStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (useDatabase) {
    await initializeDatabase();
  }

  for (const [filename, key] of Object.entries(files)) {
    const filepath = path.join(DATA_DIR, filename);

    let seed;
    if (fs.existsSync(filepath)) {
      seed = JSON.parse(fs.readFileSync(filepath, "utf8"));
    } else {
      seed = key === "site-content" ? {} : [];
    }

    if (useDatabase) {
      await importData(key, seed);
      cache[key] = await getData(key, seed);
    } else {
      cache[key] = seed;
    }
  }

  console.log(
    useDatabase
      ? "Stockage PostgreSQL initialisé."
      : "Stockage JSON local initialisé."
  );
}

function read(file, fallback = []) {
  const key = files[path.basename(file)];
  if (!key) throw new Error("Fichier de données inconnu.");
  return cache[key] === undefined ? fallback : cache[key];
}

async function write(file, value) {
  const key = files[path.basename(file)];
  if (!key) throw new Error("Fichier de données inconnu.");

  if (useDatabase) {
    await saveData(key, value);
  } else {
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
  }

  cache[key] = value;
}

module.exports = {
  initializeStorage,
  read,
  write
};

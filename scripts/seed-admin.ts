import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const SEED_EMAIL = process.env.SEED_EMAIL;
const SEED_PASSWORD = process.env.SEED_PASSWORD;
const SEED_NAME = process.env.SEED_NAME ?? "Admin";

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.log("[seed] DATABASE_URL not set — skipping.");
    return;
  }
  if (!SEED_EMAIL || !SEED_PASSWORD) {
    console.log("[seed] SEED_EMAIL / SEED_PASSWORD not set — skipping auto-seed.");
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows: existing } = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [SEED_EMAIL.toLowerCase()],
    );

    if (existing.length > 0) {
      console.log(`[seed] User ${SEED_EMAIL} already exists — nothing to do.`);
      return;
    }

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
    const { rows } = await pool.query(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name",
      [SEED_EMAIL.toLowerCase(), passwordHash, SEED_NAME],
    );

    console.log(`[seed] Created user: ${rows[0].email} (id: ${rows[0].id})`);
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("[seed] Failed:", err.message);
  process.exit(1);
});

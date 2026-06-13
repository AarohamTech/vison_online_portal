/**
 * Seed an initial admin user.
 *
 *   node db/seed.mjs                       # uses defaults below
 *   SEED_ADMIN_EMAIL=a@b.com SEED_ADMIN_PASSWORD=Secret123 node db/seed.mjs
 *
 * Idempotent: re-running updates the existing user's password/role.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import bcrypt from "bcryptjs";

const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@vision.local").toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
const fullName = process.env.SEED_ADMIN_NAME ?? "Administrator";

const sql = postgres(
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  { prepare: false }
);

try {
  const hash = await bcrypt.hash(password, 10);
  const rows = await sql`
    insert into profiles (email, password_hash, full_name, role)
    values (${email}, ${hash}, ${fullName}, 'admin')
    on conflict (email) do update
      set password_hash = excluded.password_hash,
          full_name = excluded.full_name,
          role = 'admin',
          updated_at = now()
    returning id, email, role
  `;
  console.log("Seeded admin:", rows[0]);
  console.log("Login with:");
  console.log("  email:   ", email);
  console.log("  password:", password);
} catch (e) {
  console.error("Seed failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

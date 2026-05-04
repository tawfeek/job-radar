// Prisma 7 config. The connection URL lives here (not in schema.prisma —
// Prisma 7 dropped `url = env(...)` in the datasource block). The
// placeholder lets `prisma generate` succeed in CI/Docker without a real
// database reachable; runtime always reads the real DATABASE_URL.
//
// We load .env from both `server/.env` (if present) and `../.env` (repo
// root). Either location works — the root .env is the recommended spot
// per the README, but server/.env is also accepted for convenience.
import path from "node:path";
import { fileURLToPath } from "node:url";
try {
  const dotenv = await import("dotenv");
  const here = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.join(here, ".env") });
  dotenv.config({ path: path.join(here, "..", ".env") });
} catch {}
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});

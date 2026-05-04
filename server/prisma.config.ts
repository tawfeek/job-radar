// Prisma 7 config file. Loaded automatically by the CLI. The placeholder
// DATABASE_URL is here so `prisma generate` works in CI/Docker without a
// real DB reachable; runtime always reads the real value from .env.
import path from 'node:path';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://placeholder@localhost:5432/placeholder';
}

export default {
  schema: path.join(__dirname, 'prisma/schema.prisma'),
};

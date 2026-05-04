// Prisma client wired up with @prisma/adapter-pg. Driver-adapter mode is
// preferred over Prisma's built-in engine because it removes the native
// binary download — better DX on M-series Macs and inside containers.
import './env.js';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export default prisma;

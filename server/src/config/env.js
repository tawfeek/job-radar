// Shared dotenv loader. Two things going on:
//
// 1. `override: true` is intentional — under some shells (and certain task
//    runners) Node sees an empty value for a var that's set to "" in the
//    parent process. Override forces the .env file to win, so a real
//    value never gets silently masked.
//
// 2. We load .env from BOTH server/.env AND the repo root (../.env).
//    The README recommends putting .env in the root, but server/.env is
//    accepted too. Either works; the root version is loaded second so it
//    wins on conflict.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '..', '.env'), override: true });
dotenv.config({ path: path.join(here, '..', '..', '..', '.env'), override: true });

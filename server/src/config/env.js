// Shared dotenv loader. `override: true` is intentional — under some shells
// (and certain task runners) Node sees an empty value for a var that's set
// to an empty string in the parent process. Override forces the .env file
// to win, so a real value in .env is never silently masked.
import dotenv from 'dotenv';
dotenv.config({ override: true });

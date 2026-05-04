// In-process cron, replacing the GitHub Actions workflow used by the
// portfolio repo. Runs all active profiles once a day. Self-hosters get
// scheduling out of the box without setting up CI.
//
// Default: 09:00 server-local time. Override via CRON_SCHEDULE env var
// (e.g. CRON_SCHEDULE="0 7,15 * * *" for twice daily). Disable entirely
// by setting CRON_ENABLED=false.

import cron from 'node-cron';
import prisma from '../config/database.js';
import { runJobSearch } from '../jobs/jobSearch.js';

const DEFAULT_SCHEDULE = '0 9 * * *';

export function startCron() {
  if (process.env.CRON_ENABLED === 'false') {
    console.log('[cron] disabled (CRON_ENABLED=false)');
    return;
  }

  const schedule = process.env.CRON_SCHEDULE || DEFAULT_SCHEDULE;
  if (!cron.validate(schedule)) {
    console.error(`[cron] invalid CRON_SCHEDULE "${schedule}" — cron disabled`);
    return;
  }

  cron.schedule(schedule, async () => {
    console.log('[cron] firing — running all active profiles');
    let profiles;
    try {
      profiles = await prisma.jobSearchProfile.findMany({ where: { active: true } });
    } catch (error) {
      console.error('[cron] failed to list profiles:', error?.message || error);
      return;
    }

    for (const profile of profiles) {
      try {
        const result = await runJobSearch(profile.id);
        console.log(
          `[cron] profile=${profile.id} found=${result.postings.length} new=${result.newCount}`
        );
      } catch (error) {
        console.error(
          `[cron] profile=${profile.id} failed:`,
          error?.message || error
        );
      }
    }
  });

  console.log(`[cron] scheduled "${schedule}"`);
}

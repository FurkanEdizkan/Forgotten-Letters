/**
 * The housekeeping jobs: hourly cleanup of expired sessions, invites and setup tokens and of audit entries past the
 * retention period; a daily backup with pruning of old dumps.
 */
import { db } from './db';
import { config } from './infra/config';
import type { Job } from './infra/jobs';
import * as auditRepo from './repos/audit';
import * as invitesRepo from './repos/invites';
import * as sessionsRepo from './repos/sessions';
import * as backups from './services/backups';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function housekeeping(): Job[] {
	return [
		{
			name: 'cleanup',
			everyMs: HOUR,
			lock: 7_314_101,
			run: async () => {
				const cutoff = new Date(Date.now() - config().RETENTION_DAYS * DAY);
				await sessionsRepo.removeExpired(db());
				await invitesRepo.removeStale(db(), new Date(Date.now() - 30 * DAY));
				await invitesRepo.removeExpiredSetupTokens(db());
				await auditRepo.removeOlderThan(db(), cutoff);
			}
		},
		{
			name: 'daily-backup',
			everyMs: DAY,
			lock: 7_314_102,
			run: async () => {
				const name = await backups.dump('daily');
				await backups.prune();
				return { backup: name };
			}
		}
	];
}

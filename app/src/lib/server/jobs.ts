/**
 * The housekeeping jobs: hourly cleanup of expired sessions and invites and of audit entries past the retention
 * period; a daily backup with pruning of old dumps; a daily purge of campaigns deleted over 30 days ago and of
 * seat links dead for over 30 days.
 */
import { db } from './db';
import { config } from './infra/config';
import type { Job } from './infra/jobs';
import * as auditRepo from './repos/audit';
import * as campaignsRepo from './repos/campaigns';
import * as invitesRepo from './repos/invites';
import * as seatsRepo from './repos/seats';
import * as sessionsRepo from './repos/sessions';
import * as backups from './services/backups';
import { deletedSince } from './services/campaigns';

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
		},
		{
			name: 'campaign-purge',
			everyMs: DAY,
			lock: 7_314_103,
			run: async () => {
				const purged = await campaignsRepo.purgeDeleted(db(), deletedSince());
				await seatsRepo.removeStaleInvites(db(), new Date(Date.now() - 30 * DAY));
				return { campaigns: purged.length };
			}
		}
	];
}

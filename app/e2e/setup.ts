import { expect } from '@playwright/test';
import { action, pageData, signedIn } from './helpers';
import { CM } from './helpers';

/** One campaign, under way, with four seats: enough for every access and invite case. Safe to run again. */
export default async function setup() {
	const cm = await signedIn(CM.username, CM.password);
	await action(cm, '/admin', 'create', { name: 'E2E Front', expectedPlayers: '8' });
	const { stage } = await pageData<{ stage: string }>(cm, '/admin/muster');
	if (stage === 'setup') {
		expect((await action(cm, '/admin/muster', 'seats', { count: '4' })).type).toBe('success');
		expect((await action(cm, '/admin/muster', 'advance')).type).toBe('success');
	}
	if ((await pageData<{ stage: string }>(cm, '/admin/muster')).stage === 'mustering') {
		// A campaign starts with at least two warbands: found two for seats nobody has claimed yet.
		for (const [name, entryZone] of [['Iron Vigil', 'A'], ['Pale Choir', 'B']]) {
			const r = await action(cm, '/warbands/new', 'create', { where: 'campaign', pick: 'new-antioch::', name, playerName: name, entryZone });
			expect(r.type, `found ${name}: ${JSON.stringify(r.data ?? r.error)}`).toBe('redirect');
		}
		expect((await action(cm, '/admin/muster', 'advance', { override: 'on' })).type).toBe('success');
	}
	expect((await pageData<{ stage: string }>(cm, '/admin/muster')).stage).toBe('underway');
	await cm.dispose();
}

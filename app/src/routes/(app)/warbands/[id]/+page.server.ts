import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { ctxOf, formAction, orPageError } from '#lib/server/http';
import * as images from '#lib/server/services/fighter-images';
import * as campaigns from '#lib/server/services/campaigns';
import * as rules from '#lib/server/services/rules';
import * as roster from '#lib/server/services/warband-roster';
import * as holdings from '#lib/server/services/warband-stash';
import * as warbands from '#lib/server/services/warbands';
import * as items from '#lib/server/services/warband-items';
import { copyInput, lineInput, moveInput, warbandPatch } from '#lib/schemas/warbands';
import type { Item, Table, Unit } from '#lib/rules/pack';
import { requireSignedIn } from '../../guard';
import {
	fid,
	fighterForm,
	fighterLeave,
	kitLeave,
	fighterImage,
	fighterLine,
	fighterUpgrade,
	fireteamsForm,
	locationsForm,
	recruitForm,
	seatForm
} from './form';
import type { Actions, PageServerLoad } from './$types';

// The right-hand panel and the dialogs live in the query (?sel=<fighter>|arsenal|campaign, ?add=<group>,
// ?equip=<fighter>, ?stash=<category>, ?export), so a change made inside one reloads its list in place and the
// dialog or panel stays open on its updated choices.
export const load: PageServerLoad = async (event) => {
	requireSignedIn(event);
	const ctx = ctxOf(event);
	const id = event.params.id;
	const q = event.url.searchParams;
	const warband = await orPageError(event, warbands.get(ctx, id));
	const set = warband.rulesExpansions.at(-1) ?? warband.rulesSet;
	const equip = warband.canEdit ? q.get('equip') : null;
	const fighter = warband.fighters.find((x) => x.id === equip) ?? null;
	const chosen = warband.fighters.find((x) => x.id === q.get('sel')) ?? null;
	const [index, els, recruits, armoury, upgrades, stashLines, exported, mine] = await Promise.all([
		orPageError(event, rules.index(ctx, set)),
		orPageError(event, rules.elements(ctx, set, ['unit', 'item', 'table'])),
		warband.canEdit && q.has('add') ? roster.recruits(ctx, id) : null,
		fighter ? roster.armoury(ctx, id, fighter.id) : null,
		chosen ? roster.upgradesFor(ctx, id, chosen.id) : null,
		warband.canEdit && q.has('stash') ? holdings.stashLines(ctx, id) : null,
		q.has('export') ? warbands.exportOf(ctx, id, 'text') : null,
		warband.canEdit ? campaigns.list(ctx, { scope: 'mine', limit: 100 }) : null
	]);
	// Only the units and items this page shows: the fighters' and the open dialog's.
	const unitIds = new Set(warband.fighters.map((x) => x.unitId));
	const itemIds = new Set([
		...warband.fighters.flatMap((x) => x.kit.map((k) => k.itemId)),
		...(armoury ?? []).map((l) => l.itemId),
		...(stashLines ?? []).map((l) => l.itemId),
		...warband.stash.map((s) => s.itemId)
	]);
	return {
		warband,
		set,
		names: index.names,
		keywords: index.keywords,
		units: Object.fromEntries(
			els.filter((e) => e.type === 'unit' && unitIds.has(e.id)).map((e) => [e.id, e.data as Unit])
		),
		items: Object.fromEntries(
			els.filter((e) => e.type === 'item' && itemIds.has(e.id)).map((e) => [e.id, e.data as Item])
		),
		/** The skill and trauma tables, for the advancement and injury pickers. */
		tables: els
			.filter((e) => e.type === 'table')
			.map((e) => e.data as Table)
			.filter((t) => t.kind === 'skill' || t.kind === 'trauma')
			.map((t) => ({
				id: t.id,
				name: t.name,
				kind: t.kind,
				rows: t.rows.map((r) => ({ roll: r.roll, name: r.name }))
			})),
		patrons: warband.canEdit || warband.canChangePatron ? await warbandPatrons(ctx, warband) : [],
		sel: q.get('sel') ?? 'warband',
		addGroup: q.get('add') || null,
		stashCategory: q.get('stash') || null,
		recruits,
		equip: fighter && { fighter, armoury: armoury! },
		equipCategory: q.get('cat') || null,
		upgrades,
		stashLines,
		exportText: exported?.body ?? null,
		seats: (mine?.items ?? [])
			.filter((c) => c.mySeat && c.stage !== 'ended')
			.map((c) => ({ value: c.id, label: c.name }))
	};
};

/** The Patrons this warband's faction (and variant) may serve, for the details form. */
async function warbandPatrons(
	ctx: ReturnType<typeof ctxOf>,
	w: { rulesSet: string; rulesExpansions: string[]; factionId: string; variantId: string | null }
) {
	const c = await warbands.choices(ctx, [w.rulesSet, ...w.rulesExpansions].join('+'));
	return c.factions.find((f) => f.id === w.factionId)?.patrons[w.variantId ?? ''] ?? [];
}

const done = (op: string, id?: string) => ({ op, done: true, ...(id ? { id } : {}) });

export const actions = {
	/**
	 * Save the warband's details or campaign data: name, Patron, dedication, ducat limit, banks, notes, games
	 * played, victory points, failed promotions, ignore limits; with a version check.
	 * Who: the warband's owner; once a seated warband has played, its campaign master for the Patron only.
	 * In: form warbandPatch { version, name?, patronId?, dedication?, ducatLimit?, stashDucats?, unspentGlory?,
	 * notes?, gamesPlayed?, victoryPoints?, failedPromotions?, ignoreLimits? }.
	 * Out: { op: 'patch', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict changed meanwhile or refused.
	 */
	patch: (event) =>
		formAction(event, warbandPatch, async (input, ctx) => {
			await warbands.patch(ctx, event.params.id, input);
			return done('patch');
		}),
	/**
	 * Delete the warband for good and go back to the list.
	 * Who: the warband's owner.
	 * In: form { }.
	 * Out: redirect to /warbands.
	 * Errors: 401 unauthenticated, 403 forbidden, 404 not_found.
	 */
	remove: async (event) => {
		const r = await formAction(event, z.object({}), async (_input, ctx) => {
			await warbands.remove(ctx, event.params.id);
			return done('remove');
		});
		if ('done' in r) redirect(303, '/warbands');
		return r;
	},
	/**
	 * Recruit an entry from the Add fighter dialog, with the upgrades and loadout picked, paid from the banks.
	 * Who: the warband's owner.
	 * In: form { unitId, name?, up:<upgrade id> boxes, loadout (its lines, comma-separated) }.
	 * Out: { op: 'recruit', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict refused with its reasons.
	 */
	recruit: (event) =>
		formAction(event, recruitForm, async (input, ctx) => {
			await roster.recruit(ctx, event.params.id, input);
			return done('recruit');
		}),
	/**
	 * Edit a fighter: name, rank (group), status, Experience, Battle Scars, skills and injuries (one per line).
	 * Who: the warband's owner.
	 * In: form { fid, version, name?, group?, status?, xp?, scars?, skills?, injuries? }.
	 * Out: { op: 'editFighter', done: true, id }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict changed meanwhile or refused.
	 */
	editFighter: (event) =>
		formAction(event, fighterForm, async ({ fid, ...input }, ctx) => {
			await roster.editFighter(ctx, event.params.id, fid, input);
			return done('editFighter', fid);
		}),
	/**
	 * Remove a fighter: refund (its worth back, only before the first game) or delete (nothing back).
	 * Who: the warband's owner.
	 * In: form fighterLeave { fid, mode }.
	 * Out: { op: 'removeFighter', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict refused with its reasons.
	 */
	removeFighter: (event) =>
		formAction(event, fighterLeave, async (input, ctx) => {
			await roster.removeFighter(ctx, event.params.id, input.fid, input.mode);
			return done('removeFighter');
		}),
	/**
	 * Buy kit for a fighter from the Equip dialog.
	 * Who: the warband's owner.
	 * In: form { fid, lineId }.
	 * Out: { op: 'buy', done: true, id: lineId }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict refused with its reasons.
	 */
	buy: (event) =>
		formAction(event, fighterLine, async (input, ctx) => {
			await roster.buy(ctx, event.params.id, input.fid, input.lineId);
			return done('buy', input.lineId);
		}),
	/**
	 * One piece of bought kit leaves a fighter or the Arsenal: sold (half back), refunded (before the first game)
	 * or deleted (nothing back).
	 * Who: the warband's owner.
	 * In: form kitLeave { from: fighter id | 'arsenal', lineId, mode }.
	 * Out: { op: 'leave', done: true, id: from }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict refused or refund after
	 * the first game.
	 */
	leave: (event) =>
		formAction(event, kitLeave, async (input, ctx) => {
			await items.leave(ctx, event.params.id, input.from, input.lineId, input.mode);
			return done('leave', input.from);
		}),
	/**
	 * Move one piece of bought kit between fighters and the Arsenal (no money).
	 * Who: the warband's owner.
	 * In: form moveInput { lineId, from, to }.
	 * Out: { op: 'move', done: true, id: from }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict refused with its reasons.
	 */
	move: (event) =>
		formAction(event, moveInput, async (input, ctx) => {
			await items.move(ctx, event.params.id, input.lineId, input.from, input.to);
			return done('move', input.from);
		}),
	/**
	 * Copy a fighter (entry, upgrades, bought kit), paid from the banks.
	 * Who: the warband's owner.
	 * In: form { fid }.
	 * Out: { op: 'copyFighter', done: true, id: fid }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict refused with its reasons.
	 */
	copyFighter: (event) =>
		formAction(event, fid, async (input, ctx) => {
			await roster.copyFighter(ctx, event.params.id, input.fid);
			return done('copyFighter', input.fid);
		}),
	/**
	 * Copy the whole warband and open the copy.
	 * Who: the warband's owner.
	 * In: form copyInput { name? }.
	 * Out: redirect to the copy.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found.
	 */
	copy: async (event) => {
		let to = '';
		const r = await formAction(event, copyInput, async (input, ctx) => {
			to = (await warbands.copy(ctx, event.params.id, input.name)).id;
			return done('copy');
		});
		if ('done' in r) redirect(303, `/warbands/${to}`);
		return r;
	},
	/**
	 * Give a fighter an upgrade from the Equip dialog.
	 * Who: the warband's owner.
	 * In: form { fid, upgradeId }.
	 * Out: { op: 'upgrade', done: true, id: upgradeId }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict refused with its reasons.
	 */
	upgrade: (event) =>
		formAction(event, fighterUpgrade, async (input, ctx) => {
			await roster.upgrade(ctx, event.params.id, input.fid, input.upgradeId);
			return done('upgrade', input.upgradeId);
		}),
	/**
	 * Take an upgrade off a fighter.
	 * Who: the warband's owner.
	 * In: form { fid, upgradeId }.
	 * Out: { op: 'removeUpgrade', done: true, id: upgradeId }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict refused with its reasons.
	 */
	removeUpgrade: (event) =>
		formAction(event, fighterUpgrade, async (input, ctx) => {
			await roster.removeUpgrade(ctx, event.params.id, input.fid, input.upgradeId);
			return done('removeUpgrade', input.upgradeId);
		}),
	/**
	 * Upload a fighter's picture (multipart field `image`): PNG, JPEG or WebP up to 2 MB, stored as sent.
	 * Who: the warband's owner.
	 * In: multipart form { fid, image }.
	 * Out: { op: 'image', done: true, id: fid }.
	 * Errors: 400 invalid wrong type or too large, 401 unauthenticated, 403 forbidden, 404 not_found.
	 */
	image: (event) =>
		formAction(event, fighterImage, async (input, ctx) => {
			await images.setImage(ctx, event.params.id, input.fid, await images.readLimited(input.image));
			return done('image', input.fid);
		}),
	/**
	 * Remove a fighter's picture.
	 * Who: the warband's owner.
	 * In: form { fid }.
	 * Out: { op: 'clearImage', done: true, id: fid }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found.
	 */
	clearImage: (event) =>
		formAction(event, fid, async (input, ctx) => {
			await images.clearImage(ctx, event.params.id, input.fid);
			return done('clearImage', input.fid);
		}),
	/**
	 * Buy kit into the stash.
	 * Who: the warband's owner.
	 * In: form { lineId }.
	 * Out: { op: 'stashBuy', done: true, id: lineId }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict refused with its reasons.
	 */
	stashBuy: (event) =>
		formAction(event, lineInput, async (input, ctx) => {
			await holdings.stashBuy(ctx, event.params.id, input.lineId);
			return done('stashBuy', input.lineId);
		}),
	/**
	 * Save the fireteams (pairs of fighters).
	 * Who: the warband's owner.
	 * In: form { fireteams (JSON) }.
	 * Out: { op: 'fireteams', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict refused with its reasons.
	 */
	fireteams: (event) =>
		formAction(event, fireteamsForm, async (input, ctx) => {
			await holdings.setFireteams(ctx, event.params.id, input.fireteams);
			return done('fireteams');
		}),
	/**
	 * Save the locations (a name and a note each).
	 * Who: the warband's owner.
	 * In: form { locations (JSON) }.
	 * Out: { op: 'locations', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found.
	 */
	locations: (event) =>
		formAction(event, locationsForm, async (input, ctx) => {
			await holdings.setLocations(ctx, event.params.id, input.locations);
			return done('locations');
		}),
	/**
	 * Put this warband in my seat of a campaign; recheck moves it to the campaign's rules first.
	 * Who: the warband's owner, seated in that campaign.
	 * In: form seatForm { campaignId, recheck? }.
	 * Out: { op: 'assign', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found no seat, 409 conflict in another campaign,
	 * other rules or refused.
	 */
	assign: (event) =>
		formAction(event, seatForm, async (input, ctx) => {
			await warbands.assignToSeat(ctx, input.campaignId, {
				warbandId: event.params.id,
				recheck: !!input.recheck
			});
			return done('assign');
		}),
	/**
	 * Take this warband out of its campaign seat.
	 * Who: the warband's owner (the seat holder).
	 * In: form { campaignId }.
	 * Out: { op: 'unassign', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 404 not_found no seat, 409 conflict campaign ended.
	 */
	unassign: (event) =>
		formAction(event, seatForm, async (input, ctx) => {
			await warbands.clearSeat(ctx, input.campaignId);
			return done('unassign');
		})
} satisfies Actions;

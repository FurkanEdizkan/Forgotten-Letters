import { formAction } from '#lib/server/http';
import {
	changePassword,
	devices,
	setDisplayName,
	signOutEverywhere
} from '#lib/server/services/auth';
import { changePasswordInput, displayNameInput } from '#lib/schemas/auth';
import { ctxOf } from '#lib/server/http';
import { z } from 'zod';
import { requireSignedIn } from '../guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const me = requireSignedIn(event);
	const rows = await devices(ctxOf(event));
	return {
		// The token hash stays on the server; the page only learns which row is this device.
		devices: rows.map((s) => ({
			current: s.idHash === me.sessionHash,
			remember: s.remember,
			userAgent: s.userAgent,
			ip: s.ip,
			lastSeenAt: s.lastSeenAt
		}))
	};
};

export const actions = {
	/**
	 * Change my display name.
	 * Who: any signed-in person.
	 * In: form { displayName }.
	 * Out: { op: 'name', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated.
	 */
	name: (event) =>
		formAction(event, displayNameInput, async ({ displayName }, ctx) => {
			await setDisplayName(ctx, displayName);
			return { op: 'name', done: true };
		}),
	/**
	 * Change my password; my other devices are signed out.
	 * Who: any signed-in person.
	 * In: form { current, password }.
	 * Out: { op: 'password', done: true }.
	 * Errors: 400 invalid (wrong current password, too common, unchanged), 401 unauthenticated.
	 */
	password: (event) =>
		formAction(event, changePasswordInput, async ({ current, password }, ctx) => {
			await changePassword(ctx, current, password);
			return { op: 'password', done: true };
		}),
	/**
	 * Sign out of every other device.
	 * Who: any signed-in person.
	 * In: nothing.
	 * Out: { op: 'everywhere', done: true }.
	 * Errors: 401 unauthenticated.
	 */
	everywhere: (event) =>
		formAction(event, z.object({}), async (_, ctx) => {
			await signOutEverywhere(ctx);
			return { op: 'everywhere', done: true };
		})
} satisfies Actions;

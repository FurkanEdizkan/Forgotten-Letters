/**
 * The copy-wide settings: text size, accent and port, one row in app.settings. Every page reads the look through the
 * root layout, so the row is cached in the process and refreshed after each change (this process is the only
 * writer). A port change asks the custom server to move (infra/listener) inside the transaction: if the new port
 * cannot be opened, nothing is saved.
 */
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import { config } from '../infra/config';
import {
	currentPort,
	listenOnStoredPort,
	movePort,
	PORT_LOCKED_MESSAGE,
	portLocked
} from '../infra/listener';
import * as settingsRepo from '../repos/settings';
import type { SettingsRow } from '../repos/settings';
import { record, type Ctx } from './audit';
import { requireUser } from './auth';
import type { Accent, Settings, SettingsPatch } from '#lib/schemas/settings';

let cached: SettingsRow | null = null;

async function row(): Promise<SettingsRow> {
	return (cached ??= await settingsRepo.get(db()));
}

/** Drop the cached row; the next read loads it again. Called after every write (and by tests). */
export function forgetCachedSettings() {
	cached = null;
}

/** The host name of a Host header ("192.168.1.20:3000" → "192.168.1.20"; IPv6 keeps its brackets). */
function hostnameOf(host: string | null | undefined): string | null {
	if (!host) return null;
	try {
		return new URL(`http://${host}`).hostname || null;
	} catch {
		return null;
	}
}

/**
 * The address people open. ORIGIN wins when it is set (it is the address the group chose, for example behind
 * Caddy). Otherwise the host the browser used, on the port the app listens on now; without the custom server (vite
 * dev) the Host header as it came.
 */
function addressOf(r: SettingsRow, host: string | null | undefined, port = currentPort()): string {
	const origin = config().ORIGIN;
	if (origin) return origin.replace(/\/$/, '');
	const name = hostnameOf(host);
	if (port === null && host && name) return `http://${host}`;
	return `http://${name ?? 'localhost'}:${port ?? r.port}`;
}

/** The address after a move to `port`: the current address with the new port. */
function addressOnPort(r: SettingsRow, host: string | null | undefined, port: number): string {
	const url = new URL(addressOf(r, host));
	url.port = String(port);
	return url.origin;
}

// Before setup the stored port has never been chosen, so the port shown (and offered in the wizard) is the one the
// app listens on now.
const toSettings = (r: SettingsRow, host?: string | null): Settings => ({
	textScale: r.textScale,
	accent: r.accent as Accent,
	port: r.setupCompletedAt ? r.port : (currentPort() ?? r.port),
	portLocked: portLocked(),
	address: addressOf(r, host)
});

/** The settings as every page and GET /api/v1/settings see them. `host` is the request's Host header, if known. */
export async function getSettings(host?: string | null): Promise<Settings> {
	return toSettings(await row(), host);
}

/** Only the look, for the root layout of every page (cached, so it costs no query). */
export async function getAppearance(): Promise<{ textScale: number; accent: Accent }> {
	const r = await row();
	return { textScale: r.textScale, accent: r.accent as Accent };
}

/**
 * At start, after migrations: once setup is done, listen on the stored port (the PORT the server started with is only
 * the first-run default). Before setup the app stays where it started.
 */
export async function listenOnSavedPort(): Promise<void> {
	const r = await row();
	if (r.setupCompletedAt) await listenOnStoredPort(r.port);
}

/**
 * Inside a settings transaction: if `port` differs from where the app listens, move the listener and return the
 * new address. Locked ports refuse a change with the reason and the .env line to edit instead.
 */
export async function movePortInTx(
	r: SettingsRow,
	port: number,
	host: string | null | undefined
): Promise<string | null> {
	const now = currentPort() ?? r.port;
	if (port === now) return null;
	if (portLocked())
		throw new AppError('conflict', PORT_LOCKED_MESSAGE, { port: PORT_LOCKED_MESSAGE });
	try {
		await movePort(port);
	} catch (e) {
		if (e instanceof AppError) throw new AppError(e.code, e.message, { port: e.message });
		throw e;
	}
	return addressOnPort(r, host, port);
}

/**
 * Change some settings. Owner only. A port change moves the listener first and answers with the new address in
 * `moveTo` (the old port closes a little later); without a port change `moveTo` is null.
 */
export async function updateSettings(
	patch: SettingsPatch,
	ctx: Ctx
): Promise<{ settings: Settings; moveTo: string | null }> {
	const me = requireUser(ctx);
	if (me.role !== 'owner')
		throw new AppError('forbidden', 'Only an owner can change the settings.');
	const moveTo = await db().transaction(async (tx: Tx) => {
		const before = await settingsRepo.lockForUpdate(tx);
		const after = await settingsRepo.update(tx, patch, me.id);
		const changed: Record<string, { from: unknown; to: unknown }> = {};
		for (const k of ['textScale', 'accent', 'port'] as const)
			if (patch[k] !== undefined && before[k] !== after[k])
				changed[k] = { from: before[k], to: after[k] };
		if (Object.keys(changed).length)
			await record(tx, ctx, 'settings.changed', { type: 'settings', id: '1' }, changed);
		// Last, so a port that cannot be opened rolls the whole change back.
		return patch.port === undefined ? null : movePortInTx(before, patch.port, ctx.host);
	});
	forgetCachedSettings();
	return { settings: await getSettings(ctx.host), moveTo };
}

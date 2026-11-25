/**
 * The copy-wide settings: text size and accent, one row in app.settings. Every page reads the look through the root
 * layout, so the row is cached in the process and refreshed after each change (this process is the only writer).
 * The port is not a setting: it is picked when the app starts (PORTS, or ./start.sh with Docker), so it is shown
 * read-only with the address people open.
 */
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import { config } from '../infra/config';
import { currentPort, inDocker, portNote } from '../infra/listener';
import * as settingsRepo from '../repos/settings';
import type { SettingsRow } from '../repos/settings';
import { record, type Ctx } from './audit';
import { requireUser } from './auth';
import { PORT, type Accent, type Settings, type SettingsPatch } from '#lib/schemas/settings';

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
 * The address people open. ORIGIN wins when it is set (it is the address the group chose, for example behind Caddy,
 * or the one ./start.sh wrote). Otherwise the host the browser used, as it came, so in Docker the published port
 * shows, never the container's. Without either (start-up logs), localhost on the port the app listens on.
 */
function addressOf(host: string | null | undefined): string {
	const origin = config().ORIGIN;
	if (origin) return origin.replace(/\/$/, '');
	if (host && hostnameOf(host)) return `http://${host}`;
	return `http://localhost:${currentPort() ?? PORT.default}`;
}

/** The port of an address: its explicit port, else the scheme's default. */
function portOf(address: string): number {
	const u = new URL(address);
	return u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
}

// The Port row and the address always agree: the port shown is the address's own.
const toSettings = (r: SettingsRow, host?: string | null): Settings => {
	const address = addressOf(host);
	return {
		textScale: r.textScale,
		accent: r.accent as Accent,
		port: portOf(address),
		address,
		portNote: portNote()
	};
};

/** The settings as every page and GET /api/v1/settings see them. `host` is the request's Host header, if known. */
export async function getSettings(host?: string | null): Promise<Settings> {
	return toSettings(await row(), host);
}

/** Only the look, for the root layout of every page (cached, so it costs no query). */
export async function getAppearance(): Promise<{ textScale: number; accent: Accent }> {
	const r = await row();
	return { textScale: r.textScale, accent: r.accent as Accent };
}

/** True in the Docker image: the Owner's settings page then says the port comes from ./start.sh or APP_PORT. */
export const runsInDocker = (): boolean => inDocker();

/** Change the text size and/or the accent. Owner only. Only what changed is audited. */
export async function updateSettings(patch: SettingsPatch, ctx: Ctx): Promise<Settings> {
	const me = requireUser(ctx);
	if (me.role !== 'owner')
		throw new AppError('forbidden', 'Only an owner can change the settings.');
	// Only the look: a port from an older client never reaches the row (the route's schema refuses it already).
	const look: { textScale?: number; accent?: Accent } = {};
	if (patch.textScale !== undefined) look.textScale = patch.textScale;
	if (patch.accent !== undefined) look.accent = patch.accent;
	await db().transaction(async (tx: Tx) => {
		const before = await settingsRepo.lockForUpdate(tx);
		const after = await settingsRepo.update(tx, look, me.id);
		const changed: Record<string, { from: unknown; to: unknown }> = {};
		for (const k of ['textScale', 'accent'] as const)
			if (k in look && before[k] !== after[k]) changed[k] = { from: before[k], to: after[k] };
		if (Object.keys(changed).length)
			await record(tx, ctx, 'settings.changed', { type: 'settings', id: '1' }, changed);
	});
	forgetCachedSettings();
	return getSettings(ctx.host);
}

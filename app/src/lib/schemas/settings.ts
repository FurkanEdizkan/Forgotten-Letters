/**
 * Input schemas for the copy-wide settings and the first-run setup wizard. Shared by the wizard (each step checks
 * its fields in the browser), the form actions, the API and the settings service.
 */
import { z } from 'zod';
import { newAccountInput } from './auth';

/** The accent presets, in the order the wizard shows them. Each is contrast-tested in tokens.css. */
export const ACCENTS = ['blood', 'brass', 'verdigris', 'bruise', 'ash'] as const;
export type Accent = (typeof ACCENTS)[number];

export const TEXT_SCALE = { min: 90, max: 130, step: 5, default: 100 } as const;
/** The first port tried when PORTS is unset (app/server/ports.js), shown when no other port is known. */
export const PORT = { default: 3000 } as const;

/** Why a port in a settings change is refused. */
export const NO_PORT = 'The port is picked when the app starts. Set PORTS in .env instead.';

export const textScale = z.coerce
	.number()
	.int('Pick a whole percentage.')
	.min(TEXT_SCALE.min, `Use ${TEXT_SCALE.min} % or more.`)
	.max(TEXT_SCALE.max, `Use ${TEXT_SCALE.max} % or less.`)
	.refine((v) => v % TEXT_SCALE.step === 0, `Use steps of ${TEXT_SCALE.step} %.`);

export const accent = z.enum(ACCENTS, 'Pick one of the colours.');

export const appearanceInput = z.object({ textScale, accent });

/** Everything the wizard sends on Finish: the Owner account, then the look. */
export const setupInput = newAccountInput.extend({ textScale, accent });

/**
 * An Owner's change on /owner/settings or PATCH /api/v1/settings; at least one field. Strict: the port is picked
 * when the app starts, so a `port` field is refused with that reason, and any other unknown field too.
 */
export const settingsPatch = z
	.strictObject({
		textScale: textScale.optional(),
		accent: accent.optional(),
		port: z.never(NO_PORT).optional()
	})
	.refine((v) => Object.keys(v).length > 0, 'Change at least one setting.');

export type SetupInput = z.infer<typeof setupInput>;
export type SettingsPatch = Omit<z.infer<typeof settingsPatch>, 'port'>;

/** What every page and GET /api/v1/settings sees. */
export type Settings = {
	textScale: number;
	accent: Accent;
	/** The port of `address`, picked when the app starts; read-only. */
	port: number;
	/** The address people open, for example http://192.168.1.20:3000. */
	address: string;
	/** After a port fallback outside Docker, the note for the Owner; else null. */
	portNote: string | null;
};

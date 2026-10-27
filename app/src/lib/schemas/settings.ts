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
export const PORT = { min: 1024, max: 65535, default: 3000 } as const;

export const textScale = z.coerce
	.number()
	.int('Pick a whole percentage.')
	.min(TEXT_SCALE.min, `Use ${TEXT_SCALE.min} % or more.`)
	.max(TEXT_SCALE.max, `Use ${TEXT_SCALE.max} % or less.`)
	.refine((v) => v % TEXT_SCALE.step === 0, `Use steps of ${TEXT_SCALE.step} %.`);

export const accent = z.enum(ACCENTS, 'Pick one of the colours.');

// Ports under 1024 need admin rights on most systems, so they are refused with that reason.
export const port = z.coerce
	.number('Enter a number.')
	.int('Enter a whole number.')
	.min(PORT.min, `Port ${PORT.min - 1} and below need admin rights. Pick ${PORT.min} or higher.`)
	.max(PORT.max, `Ports stop at ${PORT.max}.`);

export const appearanceInput = z.object({ textScale, accent });

/** Everything the wizard sends on Finish: the Owner account, then the look, then the port. */
export const setupInput = newAccountInput.extend({ textScale, accent, port });

/** An Owner's change on /owner/settings or PATCH /api/v1/settings; at least one field. */
export const settingsPatch = z
	.object({ textScale, accent, port })
	.partial()
	.refine((v) => Object.keys(v).length > 0, 'Change at least one setting.');

export type SetupInput = z.infer<typeof setupInput>;
export type SettingsPatch = z.infer<typeof settingsPatch>;

/** What every page and GET /api/v1/settings sees. */
export type Settings = {
	textScale: number;
	accent: Accent;
	port: number;
	/** True in Docker and in development: the port cannot be changed from the UI. */
	portLocked: boolean;
	/** The address people open, for example http://192.168.1.20:3000. */
	address: string;
};

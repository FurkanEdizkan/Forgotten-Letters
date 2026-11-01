/**
 * Input schemas for campaigns, seats, seat links and join requests. Shared by the wizard (step by step in the
 * browser), the form actions, the API and the services; the messages are what people see next to a field.
 */
import { z } from 'zod';
import { STAGES } from '../campaign-stage';
import { newAccountInput } from './auth';
import { checkValues, presetByKey, RULE_KINDS } from '../house-rule-presets';

export const KINDS = ['carcass_front', 'generic'] as const;
export const VISIBILITIES = ['listed', 'private'] as const;
export const SEATS_MIN = 2;
export const SEATS_MAX = 30;
export const HOUSE_RULES_MAX = 30;

/** Forms send "" for an empty optional field. */
const blank = <T extends z.ZodType>(s: T) =>
	z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional());

export const campaignName = z
	.string()
	.trim()
	.min(1, 'Enter a name.')
	.max(80, 'Use at most 80 characters.');

export const description = z.string().trim().max(500, 'Use at most 500 characters.');

/**
 * One house rule: from the preset library (`preset` names it, `values` fit its fields) or the CM's own words
 * (`preset: null`, always passive, no values). Rules saved before the library read as the CM's own.
 */
export const houseRule = z
	.object({
		name: z.string().trim().min(1, 'Name the rule.').max(60, 'Use at most 60 characters.'),
		text: z.string().trim().max(500, 'Use at most 500 characters.').default(''),
		on: z.boolean(),
		kind: z.enum(RULE_KINDS).default('passive'),
		preset: z.string().max(60).nullable().default(null),
		values: z.record(z.string(), z.union([z.number(), z.boolean(), z.string().max(60)])).default({})
	})
	.superRefine((r, ctx) => {
		if (r.preset === null) {
			if (r.kind !== 'passive')
				ctx.addIssue({
					code: 'custom',
					message: 'Your own rules are played at the table.',
					path: ['kind']
				});
			if (Object.keys(r.values).length)
				ctx.addIssue({
					code: 'custom',
					message: 'Your own rules have no values.',
					path: ['values']
				});
			return;
		}
		const p = presetByKey(r.preset);
		if (!p)
			return ctx.addIssue({
				code: 'custom',
				message: 'That preset does not exist.',
				path: ['preset']
			});
		if (r.kind !== p.kind)
			ctx.addIssue({ code: 'custom', message: 'Wrong kind for this preset.', path: ['kind'] });
		for (const [key, message] of Object.entries(checkValues(p, r.values)))
			ctx.addIssue({ code: 'custom', message, path: ['values', key] });
	});

export const houseRules = z
	.array(houseRule)
	.max(HOUSE_RULES_MAX, `Use at most ${HOUSE_RULES_MAX} house rules.`)
	.superRefine((rules, ctx) => {
		const seen = new Set<string>();
		rules.forEach((r, i) => {
			if (!r.preset) return;
			if (seen.has(r.preset))
				ctx.addIssue({
					code: 'custom',
					message: 'This rule is already in the list.',
					path: [i, 'preset']
				});
			seen.add(r.preset);
		});
	});

const settingsFields = {
	name: campaignName,
	description: description.default(''),
	gamesPerPlayer: blank(z.coerce.number().int().min(1, 'Use 1 to 50.').max(50, 'Use 1 to 50.')),
	startsOn: blank(z.iso.date('Pick a date.')),
	endsOn: blank(z.iso.date('Pick a date.')),
	visibility: z.enum(VISIBILITIES)
};

const datesInOrder = (v: { startsOn?: string; endsOn?: string }) =>
	!v.startsOn || !v.endsOn || v.endsOn >= v.startsOn;
const datesIssue = { message: 'The end is before the start.', path: ['endsOn'] };

export const seatCountAtCreate = z.coerce
	.number()
	.int()
	.min(SEATS_MIN, `Use ${SEATS_MIN} to ${SEATS_MAX} seats.`)
	.max(SEATS_MAX, `Use ${SEATS_MIN} to ${SEATS_MAX} seats.`);

export const campaignCreate = z
	.object({
		...settingsFields,
		kind: z.enum(KINDS),
		seats: seatCountAtCreate,
		houseRules: houseRules.default([])
	})
	.refine(datesInOrder, datesIssue);

/** Settings after creation; the type cannot change. */
export const campaignPatch = z
	.object({
		...settingsFields,
		houseRules: houseRules.optional(),
		version: z.coerce.number().int().min(1)
	})
	.refine(datesInOrder, datesIssue);

export const stageMove = z.object({ to: z.enum(STAGES) });

/** Seats to add; the total stays within the limit (checked by the service). */
export const seatCount = z.object({
	count: z.coerce
		.number()
		.int()
		.min(1, 'Add at least 1 seat.')
		.max(SEATS_MAX - SEATS_MIN, `Use at most ${SEATS_MAX} seats in all.`)
});

export const seatName = z
	.string()
	.trim()
	.min(1, 'Name the seat.')
	.max(40, 'Use at most 40 characters.');

export const seatPatch = z
	.object({
		version: z.coerce.number().int().min(1),
		name: seatName.optional(),
		free: z.boolean().optional()
	})
	.refine((v) => v.name !== undefined || v.free === true, {
		message: 'Send name or free.',
		path: ['name']
	});

/** A person by id: add by name, add a co-CM, hand over the CM role. */
export const personInput = z.object({ userId: z.uuid() });

export const requestInput = z.object({
	note: z.string().trim().max(300, 'Use at most 300 characters.').default('')
});

export const approveInput = z.object({ seatId: z.uuid() });

/** Taking a seat: signed in sends nothing; a visitor sends a new account. */
export const seatAcceptInput = z.union([newAccountInput, z.object({}).strict()]);

export const campaignScopeQuery = z.object({
	scope: z.enum(['mine', 'listed', 'deleted']).default('mine'),
	after: z.uuid().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50)
});

export const candidatesQuery = z.object({ q: z.string().trim().min(1).max(32) });

export type Kind = (typeof KINDS)[number];
export type Visibility = (typeof VISIBILITIES)[number];
export type HouseRule = z.infer<typeof houseRule>;
export type CampaignCreate = z.infer<typeof campaignCreate>;
export type CampaignPatch = z.infer<typeof campaignPatch>;

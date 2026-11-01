/**
 * The house rule library: presets a CM drags onto a campaign. Pure, shared by the editor, the schema and the API.
 * Two kinds: `passive` rules players apply at the table (the app only shows them) and `configuration` rules that
 * set a game value the app uses from roadmap step 3 on (`step` says when). Our own wording only: the rules are
 * named by concept, never quoted from the books. Values are checked against each preset's fields by
 * `checkValues`.
 */

export const RULE_KINDS = ['passive', 'configuration'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export type ValueField =
	| {
			key: string;
			label: string;
			type: 'inches' | 'number';
			default: number;
			min: number;
			max: number;
			unit?: string;
	  }
	| { key: string; label: string; type: 'boolean'; default: boolean }
	| {
			key: string;
			label: string;
			type: 'choice';
			default: string;
			choices: { value: string; label: string }[];
	  };

export type RuleValues = Record<string, number | boolean | string>;

export type Preset = {
	key: string;
	kind: RuleKind;
	name: string;
	summary: string;
	/** Not in the books at all; the UI marks it "house rule". */
	houseOnly?: boolean;
	/** Only offered for this campaign type. */
	only?: 'carcass_front';
	/** The roadmap step that will use (configuration) or show (passive) it. */
	step: 3 | 4 | 5 | 6;
	fields: ValueField[];
};

const yes = (key: string, label: string, def = false): ValueField => ({
	key,
	label,
	type: 'boolean',
	default: def
});

export const PRESETS: readonly Preset[] = [
	{
		key: 'campaign-length',
		kind: 'configuration',
		name: 'Campaign length',
		summary:
			'How many games each player plays. Games past the printed table keep raising the ducat limit and field strength by a fixed step.',
		step: 3,
		fields: [
			{ key: 'games', label: 'Games per player', type: 'number', default: 12, min: 4, max: 20 },
			{
				key: 'ducatStep',
				label: 'Ducats per extra game',
				type: 'number',
				default: 100,
				min: 0,
				max: 300,
				unit: 'ducats'
			},
			{
				key: 'fieldStep',
				label: 'Field strength per extra game',
				type: 'number',
				default: 1,
				min: 0,
				max: 3
			}
		]
	},
	{
		key: 'starting-threshold',
		kind: 'configuration',
		name: 'Starting ducat limit',
		summary: 'Start warbands above or below the first ducat limit.',
		step: 4,
		fields: [
			{
				key: 'offset',
				label: 'Change',
				type: 'number',
				default: 0,
				min: -300,
				max: 300,
				unit: 'ducats'
			}
		]
	},
	{
		key: 'starting-glory',
		kind: 'configuration',
		name: 'Starting glory',
		summary: 'Every warband starts with some glory points.',
		houseOnly: true,
		step: 4,
		fields: [
			{ key: 'glory', label: 'Glory at creation', type: 'number', default: 0, min: 0, max: 10 }
		]
	},
	{
		key: 'attacker-rotation',
		kind: 'passive',
		name: 'Attacker before repeat',
		summary: 'Nobody is the attacker a second time until everyone has been the attacker once.',
		step: 5,
		fields: []
	},
	{
		key: 'aggressor-tiebreak',
		kind: 'configuration',
		name: 'Attacker tie-break',
		summary: 'When two players have been the attacker equally often, this decides who attacks.',
		step: 5,
		fields: [
			{
				key: 'method',
				label: 'Decided by',
				type: 'choice',
				default: 'roll-off',
				choices: [
					{ value: 'roll-off', label: 'A roll-off' },
					{ value: 'lower-cvp', label: 'Fewer campaign points' },
					{ value: 'lower-value', label: 'Lower warband value' }
				]
			}
		]
	},
	{
		key: 'trench-depth',
		kind: 'configuration',
		name: 'Trench depth',
		summary: 'The depth at which a trench wall must be climbed instead of walked over.',
		step: 6,
		fields: [
			{ key: 'depth', label: 'Depth', type: 'inches', default: 3, min: 1, max: 4 },
			yes('wallAtDepthIsOpen', 'A wall at exactly that depth is open ground', true)
		]
	},
	{
		key: 'elevation-bonus',
		kind: 'configuration',
		name: 'Elevation bonus',
		summary: 'Models shooting from well above their target get a bonus to the attack.',
		houseOnly: true,
		step: 6,
		fields: [
			{
				key: 'minHeight',
				label: 'Height above the target',
				type: 'inches',
				default: 3,
				min: 1,
				max: 6
			},
			{
				key: 'bonus',
				label: 'Bonus dice',
				type: 'number',
				default: 1,
				min: 0,
				max: 2,
				unit: 'dice'
			}
		]
	},
	{
		key: 'cover-contact',
		kind: 'configuration',
		name: 'Cover only in contact',
		summary: 'A model counts as in cover only while it touches the terrain piece.',
		step: 6,
		fields: [yes('strict', 'Only in contact')]
	},
	{
		key: 'scenario-choice',
		kind: 'configuration',
		name: 'Scenario selection',
		summary: 'How the scenario for a game is chosen.',
		step: 5,
		fields: [
			{
				key: 'method',
				label: 'Chosen by',
				type: 'choice',
				default: 'table',
				choices: [
					{ value: 'table', label: 'A roll on the table' },
					{ value: 'aggressor-picks', label: 'The attacker' },
					{ value: 'agreed', label: 'The players agree' }
				]
			}
		]
	},
	{
		key: 'no-repeat-scenario',
		kind: 'passive',
		name: 'No repeat scenarios',
		summary: 'Two warbands never replay a scenario they have already fought against each other.',
		step: 5,
		fields: []
	},
	{
		key: 'lenient-trauma',
		kind: 'configuration',
		name: 'Lenient trauma',
		summary:
			'A softer roll after the game for wounded models, and optionally one escape from death per model.',
		houseOnly: true,
		step: 6,
		fields: [
			{ key: 'modifier', label: 'Roll modifier', type: 'number', default: 0, min: 0, max: 2 },
			yes('oneFreeSave', 'One free save per model')
		]
	},
	{
		key: 'free-exploration-rerolls',
		kind: 'configuration',
		name: 'Exploration rerolls',
		summary:
			'Whether the core rulebook’s free exploration rerolls apply, and whether a location can be found twice.',
		only: 'carcass_front',
		step: 6,
		fields: [
			yes('freeRerolls', 'Free rerolls'),
			yes('locationsRepeat', 'Locations can be found again', true)
		]
	},
	{
		key: 'ammunition-always-lost',
		kind: 'configuration',
		name: 'Ammunition always used up',
		summary: 'Single-use ammunition is always gone after the game, used or not.',
		step: 6,
		fields: [yes('alwaysLost', 'Always used up')]
	},
	{
		key: 'upgrades-after-recruit',
		kind: 'configuration',
		name: 'Late upgrades',
		summary: 'Models may buy an upgrade after they were recruited, once each.',
		step: 4,
		fields: [yes('allowed', 'Allowed')]
	},
	{
		key: 'latecomer-catchup',
		kind: 'configuration',
		name: 'Latecomer catch-up',
		summary:
			'Players who join late start at the leader’s ducat limit and experience, and optionally more.',
		step: 4,
		fields: [yes('glory', 'Also glory'), yes('exploration', 'Also exploration results')]
	},
	{
		key: 'opponent-scouts-on-loss',
		kind: 'configuration',
		name: 'Loser still scouts',
		summary: 'The attacker’s opponent scouts the zone even when they lose.',
		only: 'carcass_front',
		step: 5,
		fields: [yes('enabled', 'On')]
	},
	{
		key: 'glory-track-cvp',
		kind: 'configuration',
		name: 'Glory deeds score campaign points',
		summary: 'Each deed on the glory track also scores a campaign point.',
		only: 'carcass_front',
		step: 6,
		fields: [yes('enabled', 'On', true)]
	},
	{
		key: 'events-once-per-game',
		kind: 'configuration',
		name: 'One random event per game',
		summary: 'At most one unforeseen event per game instead of one per turn.',
		step: 6,
		fields: [yes('perGame', 'Once per game')]
	}
];

export const presetByKey = (key: string) => PRESETS.find((p) => p.key === key);

/** The preset's default values. */
export const defaultValues = (p: Preset): RuleValues =>
	Object.fromEntries(p.fields.map((f) => [f.key, f.default]));

/** Field messages keyed by value key, or an empty object when the values fit the preset. */
export function checkValues(p: Preset, values: RuleValues): Record<string, string> {
	const out: Record<string, string> = {};
	for (const f of p.fields) {
		const v = values[f.key];
		if (f.type === 'boolean') {
			if (typeof v !== 'boolean') out[f.key] = 'Choose yes or no.';
		} else if (f.type === 'choice') {
			if (!f.choices.some((c) => c.value === v)) out[f.key] = 'Choose one of the options.';
		} else if (typeof v !== 'number' || !Number.isInteger(v) || v < f.min || v > f.max) {
			out[f.key] = `Use ${f.min} to ${f.max}${f.type === 'inches' ? ' inches' : ''}.`;
		}
	}
	for (const k of Object.keys(values))
		if (!p.fields.some((f) => f.key === k)) out[k] = 'This preset has no such value.';
	return out;
}

/** "Depth: 2″ · A wall at exactly that depth is open ground: yes", for the campaign page. */
export function describeValues(p: Preset, values: RuleValues): string {
	return p.fields
		.map((f) => {
			const v = values[f.key] ?? f.default;
			if (f.type === 'boolean') return `${f.label}: ${v ? 'yes' : 'no'}`;
			if (f.type === 'choice')
				return `${f.label}: ${f.choices.find((c) => c.value === v)?.label ?? v}`;
			return `${f.label}: ${v}${f.type === 'inches' ? '″' : f.unit ? ` ${f.unit}` : ''}`;
		})
		.join(' · ');
}

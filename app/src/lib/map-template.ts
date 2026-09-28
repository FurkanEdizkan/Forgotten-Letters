/**
 * The Map Studio's file format: a campaign map's zones (positions, links, resources, scenarios) as YAML.
 * The map image is uploaded on its own; positions are fractions (0–1) of its width and height.
 */
import { parse, stringify } from 'yaml';
import { RESOURCES, type Archetype, type Resource, type Zone, type ZoneType } from './rules/types';
import { slug, type TemplateError } from './faction-template';

export const ZONE_TYPES: ZoneType[] = ['entry', 'basic', 'special'];
export const ARCHETYPES: Archetype[] = ['no-mans-land', 'derelict-ruins', 'trench-lines'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Check zones (from a file or the editor) and tidy them; errors name the zone and field. */
export function readZones(input: unknown): { zones: Zone[] | null; errors: TemplateError[] } {
	const errors: TemplateError[] = [];
	const err = (path: string, message: string) => errors.push({ path, message });
	const list = isObj(input) ? input.zones : input;
	if (!Array.isArray(list)) return { zones: null, errors: [{ path: 'zones', message: 'must be a list of zones' }] };
	const text = (v: unknown, max = 2000) => (v == null || v === '' ? undefined : String(v).trim().slice(0, max) || undefined);
	const zones: Zone[] = list.map((raw, i) => {
		const p = `zones[${i}]`;
		const o = isObj(raw) ? raw : (err(p, 'must be a zone'), {} as Obj);
		const name = text(o.name, 120) ?? (err(`${p}.name`, 'is required'), '');
		const id = text(o.id, 60) ?? slug(name);
		const type = ZONE_TYPES.find((t) => t === o.type) ?? (err(`${p}.type`, `must be one of: ${ZONE_TYPES.join(', ')}`), 'basic');
		const resources = (Array.isArray(o.resources) ? o.resources : typeof o.resources === 'string' ? o.resources.split(/[\s,]+/) : [])
			.map((r) => String(r).toUpperCase())
			.filter(Boolean);
		for (const r of resources) if (!RESOURCES.includes(r as Resource)) err(`${p}.resources`, `"${r}" is not one of ${RESOURCES.join(', ')}`);
		const archetype = o.archetype ? (ARCHETYPES.find((a) => a === o.archetype) ?? (err(`${p}.archetype`, `must be one of: ${ARCHETYPES.join(', ')}`), undefined)) : undefined;
		const omen = o.omen ? (o.omen === 'first' || o.omen === 'each' ? o.omen : (err(`${p}.omen`, 'must be first or each'), undefined)) : undefined;
		const pos = isObj(o.pos) ? { x: Number(o.pos.x), y: Number(o.pos.y) } : undefined;
		if (pos && !(pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1)) err(`${p}.pos`, 'x and y must be between 0 and 1');
		const weight = o.enclave_weight ?? o.enclaveWeight;
		const aliases = Array.isArray(o.aliases) ? o.aliases.map(String).filter(Boolean) : [];
		const z: Zone = {
			id,
			name,
			type,
			resources: resources.filter((r): r is Resource => RESOURCES.includes(r as Resource)),
			links: (Array.isArray(o.links) ? o.links : []).map(String),
			...(aliases.length ? { aliases } : {}),
			...(text(o.scenario, 120) ? { scenario: text(o.scenario, 120) } : {}),
			...(archetype ? { archetype } : {}),
			...(text(o.bonus) ? { bonus: text(o.bonus) } : {}),
			...(omen ? { omen: omen as Zone['omen'] } : {}),
			...(weight != null && Number(weight) > 1 ? { enclaveWeight: Math.round(Number(weight)) } : {}),
			...(o.house === true || o.drawn === true ? { house: true } : {}),
			...(pos ? { pos: { x: Math.round(pos.x * 10000) / 10000, y: Math.round(pos.y * 10000) / 10000 } } : {})
		};
		return z;
	});
	const ids = new Set<string>();
	zones.forEach((z, i) => {
		if (ids.has(z.id)) err(`zones[${i}].id`, `"${z.id}" is used twice`);
		ids.add(z.id);
	});
	zones.forEach((z, i) => z.links.forEach((l) => ids.has(l) || err(`zones[${i}].links`, `no zone with id "${l}"`)));
	if (!zones.some((z) => z.type === 'entry')) err('zones', 'needs at least one entry zone (where warbands start)');
	return errors.length ? { zones: null, errors } : { zones, errors };
}

export function parseZones(text: string) {
	try {
		return readZones(parse(text));
	} catch (e) {
		return { zones: null, errors: [{ path: '(file)', message: (e as Error).message.split('\n')[0] }] };
	}
}

const HEADER = `# Map Studio zones. Upload the map image in Admin → Map; import this file there.
#
#   id            short id (entry zones often use a letter); links refer to these
#   type          entry (warbands start here) | basic | special
#   resources     any of F (Favour), R (Relics), S (Supplies), T (Territories)
#   scenario      a named scenario played here, or
#   archetype     no-mans-land | derelict-ruins | trench-lines (a random scenario of that kind)
#   bonus         a special zone's Outpost bonus
#   omen          first | each: the first (or every) warband to raise an Outpost here gains an Omen
#   enclave_weight  counts as this many zones for the Largest Enclave
#   house         true: not printed on the map image, so the app draws it (and "house zones" can switch it off)
#   links         the zones next to this one (links work both ways)
#   pos           where it sits, as fractions of the map image's width (x) and height (y)
`;

export function toZonesYaml(zones: Zone[]) {
	const out = zones.map((z) => ({
		id: z.id,
		name: z.name,
		type: z.type,
		...(z.resources.length ? { resources: z.resources } : {}),
		...(z.aliases?.length ? { aliases: z.aliases } : {}),
		...(z.scenario ? { scenario: z.scenario } : {}),
		...(z.archetype ? { archetype: z.archetype } : {}),
		...(z.bonus ? { bonus: z.bonus } : {}),
		...(z.omen ? { omen: z.omen } : {}),
		...(z.enclaveWeight ? { enclave_weight: z.enclaveWeight } : {}),
		...(z.house ? { house: true } : {}),
		links: z.links,
		...(z.pos ? { pos: z.pos } : {})
	}));
	return HEADER + '\n' + stringify({ zones: out }, { lineWidth: 110, flowCollectionPadding: false });
}

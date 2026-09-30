import { weatherByRoll } from '$lib/rules/weather';
import { AMBIENT_KINDS, FX_LABELS, TIME_OF_DAY, type FxConfig, type FxKind, type FxLayer } from './types';

export interface RegionLike {
	name: string | null;
	zones: string[] | null;
	weatherEvent: number | null;
	active: boolean;
	layers: Partial<Record<FxKind, FxLayer>>;
}

/** What every viewer is seeing, in words, for the weather console's "Now" line. */
export function weatherNow(fx: FxConfig, regions: RegionLike[]) {
	const running = (layers: Partial<Record<FxKind, FxLayer>>) => AMBIENT_KINDS.filter((k) => layers[k]?.on);
	return {
		time: TIME_OF_DAY[fx.timeOfDay].label,
		layers: running(fx.layers).map((k) => `${FX_LABELS[k]} ${Math.round((fx.layers[k]?.intensity ?? 0) * 100)}%`),
		wind: fx.wind < -0.05 ? 'wind west' : fx.wind > 0.05 ? 'wind east' : 'still',
		regions: regions
			.filter((r) => r.active)
			.map((r) => {
				const event = r.weatherEvent ? weatherByRoll(r.weatherEvent)?.name : undefined;
				const what = [r.name, event].filter(Boolean).join(': ') || running(r.layers).map((k) => FX_LABELS[k]).join(', ') || 'Regional weather';
				const where = r.zones ? `${r.zones.length} zone${r.zones.length === 1 ? '' : 's'}` : 'whole map';
				return `${what} (${where})`;
			}),
		random: fx.random.on && fx.random.kinds.length ? `random portents every ~${fx.random.everySeconds} s` : null
	};
}

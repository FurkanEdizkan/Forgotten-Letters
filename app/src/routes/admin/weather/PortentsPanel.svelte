<script lang="ts">
	import { enhance } from '$app/forms';
	import { TRIGGER_LABELS, type FxConfig, type TriggerKind } from '$lib/fx/types';
	import type { Zone } from '$lib/rules/types';

	/** One-off strikes every map plays at once, the zeppelin, and random portents on a timer. */
	let { fx = $bindable(), zones, form }: { fx: FxConfig; zones: Zone[]; form: Record<string, unknown> | null } = $props();

	let where = $state('');
	let struck = $state<string | null>(null);
	const kinds = Object.entries(TRIGGER_LABELS) as [TriggerKind, string][];
	function toggleRandom(kind: TriggerKind) {
		fx.random.kinds = fx.random.kinds.includes(kind) ? fx.random.kinds.filter((k) => k !== kind) : [...fx.random.kinds, kind];
	}
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<div class="stack">
	<form
		method="POST"
		action="?/trigger"
		class="card"
		use:enhance={({ submitter }) => {
			const label = (submitter as HTMLButtonElement | null)?.textContent?.trim() ?? 'Portent';
			return async ({ update }) => {
				await update({ reset: false });
				struck = label;
				setTimeout(() => (struck = null), 2500);
			};
		}}
	>
		<fieldset>
			<legend>Strike now</legend>
			<label class="inline">
				Where
				<select name="zone" bind:value={where}>
					<option value="">Anywhere</option>
					{#each zones as z (z.id)}<option value={z.id}>{z.name}</option>{/each}
				</select>
			</label>
			<div class="tiles strikes">
				{#each kinds as [kind, label] (kind)}
					<button name="kind" value={kind} class="tile strike">{label}</button>
				{/each}
			</div>
			<p class="hint" role="status">{struck ? `${struck}: playing on every map.` : 'Every map plays it at the same moment.'}</p>
		</fieldset>
	</form>

	<form method="POST" action="?/zeppelin" class="card" use:enhance={keep}>
		<fieldset>
			<legend>Zeppelin</legend>
			<label class="wide">Banner text <input name="text" placeholder="The Iron Sultanate's airship passes over the Vivarium" /></label>
			<div class="inline">
				<label class="inline">
					Route over
					<select name="via">
						<option value="">Anywhere</option>
						{#each zones as z (z.id)}<option value={z.id}>{z.name}</option>{/each}
					</select>
				</label>
				<label class="inline">Crossing <input name="seconds" type="number" min="15" max="180" value="45" class="num" /> s</label>
				<label class="inline"><input type="checkbox" name="bomb" /> Bomb that zone</label>
			</div>
			<div class="inline">
				<button>Launch the zeppelin</button>
				{#if form && 'zeppelin' in form}<span class="ok" role="status">Aloft on every map.</span>{/if}
			</div>
		</fieldset>
	</form>

	<fieldset class="card">
		<legend>Random portents</legend>
		<label class="switch">
			<input type="checkbox" role="switch" bind:checked={fx.random.on} />
			<span>{fx.random.on ? 'On' : 'Off'}</span>
		</label>
		<div class="inline" class:dim={!fx.random.on}>
			<label class="inline">About every <input type="number" min="5" max="600" bind:value={fx.random.everySeconds} class="num" /> seconds, one of:</label>
		</div>
		<div class="tiles" class:dim={!fx.random.on}>
			{#each kinds as [kind, label] (kind)}
				<button type="button" class="tile" aria-pressed={fx.random.kinds.includes(kind)} onclick={() => toggleRandom(kind)}>{label}</button>
			{/each}
		</div>
	</fieldset>
</div>

<style>
	.strikes {
		margin-top: 10px;
	}
	.strike {
		justify-content: center;
		font-weight: 600;
	}
	.wide {
		display: grid;
		gap: 4px;
		margin-bottom: 8px;
	}
	.dim {
		opacity: 0.55;
	}
	.ok {
		color: var(--supplies);
		font-weight: 600;
	}
</style>

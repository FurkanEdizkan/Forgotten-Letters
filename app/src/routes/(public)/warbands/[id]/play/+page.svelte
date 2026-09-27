<script lang="ts">
	import KeywordChips from '$lib/components/KeywordChips.svelte';

	/** Play Mode: the warband at the table — each model's profile, weapons with their full rules, and trackers for the game. */
	let { data } = $props();

	type Track = { blood: number; down: boolean; out: boolean; used: string[] };
	const key = $derived(`cf-play-${data.warband.id}`);
	let track = $state<Record<string, Track>>({});
	$effect(() => {
		try {
			track = JSON.parse(localStorage.getItem(key) ?? '{}');
		} catch {
			track = {};
		}
	});
	function save() {
		try {
			localStorage.setItem(key, JSON.stringify(track));
		} catch {
			/* storage unavailable: trackers live for this visit only */
		}
	}
	const blank: Track = { blood: 0, down: false, out: false, used: [] };
	/** Read-only while rendering; changes go through `edit`. */
	const t = (id: string): Track => track[id] ?? blank;
	function edit(id: string, f: (x: Track) => Track) {
		track = { ...track, [id]: f(t(id)) };
		save();
	}
	const bump = (id: string, d: number) => edit(id, (x) => ({ ...x, blood: Math.max(0, x.blood + d) }));
	const toggle = (id: string, k: 'down' | 'out') => edit(id, (x) => ({ ...x, [k]: !x[k] }));
	const consume = (id: string, item: string) =>
		edit(id, (x) => ({ ...x, used: x.used.includes(item) ? x.used.filter((u) => u !== item) : [...x.used, item] }));
	function newGame() {
		track = {};
		save();
	}
</script>

<svelte:head><title>{data.warband.name} · Play Mode</title></svelte:head>

<div class="page tc">
	<header class="bar">
		<a href="/warbands/{data.warband.id}" class="back">← Builder</a>
		<h1>{data.warband.name}</h1>
		<span class="meta">{data.warband.variant ?? data.warband.faction} · {data.warband.rating.ducats} D | {data.warband.rating.glory} G · {data.models.length} models</span>
		<button type="button" class="reset" onclick={newGame}>New game</button>
	</header>

	<main class="grid">
		{#each data.models as m (m.id)}
			{@const s = t(m.id)}
			<article class="card" class:down={s.down} class:out={s.out}>
				<header>
					<div>
						<h2>{m.name || m.type}</h2>
						<p>{m.name ? m.type : ''}{m.fireteams.length ? ` · ${m.fireteams.join(', ')}` : ''}</p>
					</div>
					<div class="trackers" role="group" aria-label="Trackers for {m.name || m.type}">
						<span class="blood" title="Blood Markers">
							<button type="button" aria-label="Remove a Blood Marker" onclick={() => bump(m.id, -1)}>−</button>
							<b>{s.blood}</b>
							<button type="button" aria-label="Add a Blood Marker" onclick={() => bump(m.id, 1)}>+</button>
						</span>
						<button type="button" class="flag" aria-pressed={s.down} onclick={() => toggle(m.id, 'down')}>Down</button>
						<button type="button" class="flag out" aria-pressed={s.out} onclick={() => toggle(m.id, 'out')}>Out</button>
					</div>
				</header>
				<div class="stats">
					<div><span>Move</span><strong>{m.stats.movement ?? '—'}</strong></div>
					<div><span>Melee</span><strong>{m.stats.melee ?? '—'}</strong></div>
					<div><span>Ranged</span><strong>{m.stats.ranged ?? '—'}</strong></div>
					<div><span>Armour</span><strong>{m.armour}</strong></div>
					<div><span>Base</span><strong>{m.stats.base ?? '—'}</strong></div>
				</div>
				{#if m.keywords.length}<KeywordChips keywords={m.keywords} glossary={data.glossary} dark />{/if}
				{#each m.weapons as w, i (i)}
					<section class="weapon">
						<h3>
							{w.name}
							{#if w.keywords.some((k) => /consumable/i.test(k)) || w.category === 'grenade'}
								<button type="button" class="used" aria-pressed={s.used.includes(`${i}`)} onclick={() => consume(m.id, `${i}`)}>{s.used.includes(`${i}`) ? 'Used' : 'Ready'}</button>
							{/if}
						</h3>
						<dl>
							<dt>Range</dt><dd>{w.range ?? '—'}</dd>
							<dt>Type</dt><dd>{w.type ?? '—'}</dd>
						</dl>
						{#if w.keywords.length}<KeywordChips keywords={w.keywords} glossary={data.glossary} dark />{/if}
						{#if w.text}<p class="rules">{w.text}</p>{/if}
					</section>
				{/each}
				{#if m.other.length}
					<section class="weapon">
						<h3>Kit</h3>
						{#each m.other as o, i (i)}<p class="rules"><b>{o.name}</b>{o.keywords.length ? ` (${o.keywords.join(', ')})` : ''}{o.text ? `: ${o.text}` : ''}</p>{/each}
					</section>
				{/if}
				{#if m.abilities.length}
					<section class="weapon">
						<h3>Abilities</h3>
						{#each m.abilities as a (a.name)}<p class="rules"><b>{a.name}:</b> {a.text}</p>{/each}
					</section>
				{/if}
				{#if m.injuries.length || m.skills.length}
					<p class="scars">{[...m.skills, ...m.injuries].join(' · ')}</p>
				{/if}
			</article>
		{/each}
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--night);
		color: var(--bone);
		padding-bottom: 40px;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		padding: 10px clamp(12px, 3vw, 28px);
		background: #6b1a14;
		position: sticky;
		top: 0;
		z-index: 5;
	}
	.bar h1 {
		margin: 0;
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 1.4rem;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	.back {
		color: var(--bone);
	}
	.meta {
		opacity: 0.85;
		font-size: 0.9rem;
	}
	.reset {
		margin-left: auto;
		padding: 5px 12px;
		background: transparent;
		border: 1px solid rgba(236, 229, 211, 0.4);
		color: var(--bone);
		font: inherit;
		cursor: pointer;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
		gap: 14px;
		padding: 16px clamp(12px, 3vw, 28px);
	}
	.card {
		background: rgba(38, 35, 30, 0.96);
		border: 1px solid rgba(236, 229, 211, 0.12);
		padding: 12px 14px;
		display: grid;
		gap: 10px;
		align-content: start;
		transition: opacity 0.2s;
	}
	.card.down {
		border-color: #c8a13a;
	}
	.card.out {
		opacity: 0.45;
	}
	.card > header {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: flex-start;
	}
	h2 {
		margin: 0;
		font-family: var(--font-title);
		font-weight: 400;
		font-size: 1.35rem;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	.card > header p {
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.75;
	}
	.trackers {
		display: flex;
		gap: 6px;
		align-items: center;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.blood {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px;
		background: #4a1512;
	}
	.blood b {
		min-width: 1.4em;
		text-align: center;
	}
	.blood button,
	.flag,
	.used {
		min-width: 2rem;
		min-height: 2rem;
		padding: 2px 8px;
		background: #2e2a24;
		border: 1px solid rgba(236, 229, 211, 0.25);
		color: var(--bone);
		font: inherit;
		cursor: pointer;
	}
	.flag[aria-pressed='true'] {
		background: #c8a13a;
		color: #15130e;
	}
	.flag.out[aria-pressed='true'] {
		background: #8f1f18;
		color: var(--bone);
	}
	.used {
		margin-left: 8px;
		font-size: 0.75rem;
		min-height: 1.6rem;
	}
	.used[aria-pressed='true'] {
		opacity: 0.55;
		text-decoration: line-through;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 4px;
		text-align: center;
	}
	.stats div {
		display: grid;
		gap: 2px;
		font-size: 0.72rem;
	}
	.stats strong {
		padding: 5px 2px;
		background: rgba(52, 48, 41, 0.96);
		font-size: 0.95rem;
	}
	.weapon {
		border-top: 1px solid rgba(236, 229, 211, 0.1);
		padding-top: 8px;
		display: grid;
		gap: 6px;
	}
	h3 {
		display: flex;
		align-items: center;
		margin: 0;
		font-family: var(--font-body);
		font-size: 1rem;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr auto 1fr;
		gap: 2px 8px;
		margin: 0;
		font-size: 0.86rem;
	}
	dt {
		opacity: 0.65;
	}
	dd {
		margin: 0;
	}
	.rules {
		margin: 0;
		font-size: 0.86rem;
		color: rgba(236, 229, 211, 0.82);
	}
	.scars {
		margin: 0;
		font-size: 0.82rem;
		font-style: italic;
		opacity: 0.8;
	}
</style>

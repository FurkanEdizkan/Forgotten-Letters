<script lang="ts">
	/** A printable roster sheet, set like a page of the book. */
	let { data } = $props();
	const money = (n: number, c: string) => `${n} ${c === 'glory' ? '☼' : 'D'}`;
</script>

<svelte:head><title>{data.warband.name} · Roster</title></svelte:head>

<main class="sheet">
	<p class="noprint"><a href="/warbands/{data.warband.id}">← Builder</a> · <button type="button" onclick={() => print()}>Print</button></p>
	<header>
		<h1>{data.warband.name}</h1>
		<p>
			{data.warband.variant ? `${data.warband.variant} — ` : ''}{data.warband.faction}{data.warband.player ? ` · ${data.warband.player}` : ''}
			· Rating {data.warband.rating.ducats} Ducats | {data.warband.rating.glory} Glory · Strongbox {data.warband.ducats} D | {data.warband.glory} ☼
		</p>
	</header>
	{#each data.models as m (m.id)}
		<section class="model">
			<h2>{m.name || m.type} <small>{m.name ? m.type : ''} · {m.category === 'elite' ? 'Elite' : m.category === 'troop' ? 'Troop' : 'Mercenary'}{m.fireteams.length ? ` · ${m.fireteams.join(', ')}` : ''}</small></h2>
			<table class="profile">
				<thead><tr><th>Movement</th><th>Ranged</th><th>Melee</th><th>Armour</th><th>Base</th></tr></thead>
				<tbody><tr><td>{m.stats.movement ?? '—'}</td><td>{m.stats.ranged ?? '—'}</td><td>{m.stats.melee ?? '—'}</td><td>{m.armour}</td><td>{m.stats.base ?? '—'}</td></tr></tbody>
			</table>
			<p><b>Keywords:</b> {m.keywords.join(', ') || '—'}</p>
			{#if m.weapons.length}
				<table class="kit">
					<thead><tr><th>Weapon</th><th>Type</th><th>Range</th><th>Keywords</th><th>Cost</th></tr></thead>
					<tbody>
						{#each m.weapons as w, i (i)}<tr><td>{w.name}</td><td>{w.type ?? ''}</td><td>{w.range ?? ''}</td><td>{w.keywords.join(', ')}</td><td>{w.cost ? money(w.cost, w.currency) : 'fixed'}</td></tr>{/each}
					</tbody>
				</table>
			{/if}
			{#if m.other.length}<p><b>Kit:</b> {m.other.map((o) => `${o.name}${o.cost ? ` (${money(o.cost, o.currency)})` : ''}`).join(', ')}</p>{/if}
			{#if m.abilities.length}<p class="abilities">{#each m.abilities as a (a.name)}<span><b>{a.name}:</b> {a.text} </span>{/each}</p>{/if}
			{#if m.upgrades.length || m.skills.length || m.injuries.length}
				<p><b>Campaign:</b> XP {m.experience}{m.upgrades.length ? ` · ${m.upgrades.join(', ')}` : ''}{m.skills.length ? ` · ${m.skills.join(', ')}` : ''}{m.injuries.length ? ` · ${m.injuries.join(', ')}` : ''}</p>
			{/if}
		</section>
	{/each}
	{#if data.warband.stash.length}<p><b>Arsenal:</b> {data.warband.stash.join(', ')}</p>{/if}
</main>

<style>
	.sheet {
		max-width: 52rem;
		margin: 0 auto;
		padding: 24px 20px 40px;
		background: var(--paper, #fbf9f4);
		color: #15130e;
		font-size: 0.92rem;
	}
	header {
		border-bottom: 2px solid #15130e;
		margin-bottom: 12px;
	}
	h1 {
		margin: 0;
		font-family: var(--font-title);
		font-size: 2rem;
	}
	h2 {
		margin: 14px 0 4px;
		font-family: var(--font-title);
		font-weight: 400;
		font-size: 1.3rem;
		text-transform: none;
		letter-spacing: 0;
		color: #8b1a14;
	}
	h2 small {
		font-family: var(--font-body);
		font-size: 0.85rem;
		color: #5a5650;
	}
	.model {
		break-inside: avoid;
		border-bottom: 1px solid #c8c1b0;
		padding-bottom: 8px;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		margin: 4px 0;
	}
	th,
	td {
		border: 1px solid #c8c1b0;
		padding: 3px 6px;
		text-align: left;
		font-size: 0.85rem;
	}
	th {
		background: #efe9dc;
	}
	.profile td,
	.profile th {
		text-align: center;
	}
	p {
		margin: 4px 0;
	}
	.abilities {
		font-size: 0.85rem;
	}
	@media print {
		.noprint {
			display: none;
		}
		.sheet {
			max-width: none;
			padding: 0;
		}
		:global(header.site),
		:global(body > div > header) {
			display: none;
		}
	}
</style>

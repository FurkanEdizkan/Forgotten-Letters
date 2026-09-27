<script lang="ts">
	import Portrait from '$lib/components/Portrait.svelte';

	let { data } = $props();

	const fmt = (d: Date | null) =>
		d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
</script>

<div class="top">
	<h1>Games</h1>
	<a class="button" href="/admin/games/new">Arrange a game</a>
</div>

<h2>On the field</h2>
{#if data.active.length}
	<ul>
		{#each data.active as g (g.id)}
			<li>
				<a href="/admin/games/{g.id}">
					<span class="pair">
						<Portrait name={g.aggressor.player} portrait={g.aggressor.portrait} symbol={g.aggressor.symbol} faction={g.aggressor.faction} size={40} />
						<Portrait name={g.defender.player} portrait={g.defender.portrait} symbol={g.defender.symbol} faction={g.defender.faction} size={40} />
					</span>
					<span class="what">
						<strong>{g.aggressor.player} vs {g.defender.player}</strong>
						<small>{g.zone} · {g.scenario ?? 'no scenario'}{g.weather ? ` · ${g.weather}` : ''}</small>
					</span>
					<span class="go">Record result →</span>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted"><em>No games in progress.</em></p>
{/if}

<h2>The chronicle</h2>
{#if data.done.length}
	<ul>
		{#each data.done as g (g.id)}
			<li>
				<a href="/admin/games/{g.id}">
					<span class="pair">
						<Portrait name={g.aggressor.player} portrait={g.aggressor.portrait} symbol={g.aggressor.symbol} faction={g.aggressor.faction} size={40} />
						<Portrait name={g.defender.player} portrait={g.defender.portrait} symbol={g.defender.symbol} faction={g.defender.faction} size={40} />
					</span>
					<span class="what">
						<strong>
							{g.aggressor.player} vs {g.defender.player} —
							{g.winner === g.aggressor.id ? `${g.aggressor.player} won` : g.winner === g.defender.id ? `${g.defender.player} won` : 'draw'}
						</strong>
						<small>{g.zone} · {g.scenario ?? ''}{g.weather ? ` · ${g.weather}` : ''} · {fmt(g.committedAt)}</small>
					</span>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted"><em>No battles recorded yet.</em></p>
{/if}

<style>
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.button {
		padding: 8px 14px;
		background: var(--blood);
		color: var(--parchment);
		text-decoration: none;
		font-variant-caps: small-caps;
		letter-spacing: 0.06em;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	li a {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 8px 12px;
		background: var(--parchment);
		border: 1px solid var(--rule);
		color: inherit;
		text-decoration: none;
	}
	li a:hover {
		border-color: var(--blood);
	}
	.pair {
		display: flex;
		gap: 4px;
	}
	.what {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	.go {
		color: var(--blood);
		white-space: nowrap;
	}
	small,
	.muted {
		color: var(--muted);
	}
</style>

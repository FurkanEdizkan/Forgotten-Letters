<script lang="ts">
	import LiveMap from '$lib/components/LiveMap.svelte';
	import Portrait from '$lib/components/Portrait.svelte';
	import ZoneFacts from '$lib/components/ZoneFacts.svelte';
	import BattlePanel from '$lib/components/BattlePanel.svelte';
	import { getLive } from '$lib/context';
	import { buildGraph } from '$lib/rules/zones';
	import { weatherByRoll } from '$lib/rules/weather';

	const live = getLive();
	const s = $derived(live.current);
	const graph = $derived(buildGraph(s.campaign.houseZones));
	const wb = $derived(new Map(s.warbands.map((w) => [w.id, w])));

	let zoneId = $state<string | null>(null);
	let warbandId = $state<string | null>(null);
	let showStandings = $state(false);

	// Per-viewer switch for weather effects (battery, motion sensitivity).
	let fxEnabled = $state(true);
	$effect(() => {
		try {
			const v = localStorage.getItem('cf-fx');
			if (v !== null) fxEnabled = v === '1';
		} catch {
			/* storage unavailable */
		}
	});
	function toggleFx() {
		fxEnabled = !fxEnabled;
		try {
			localStorage.setItem('cf-fx', fxEnabled ? '1' : '0');
		} catch {
			/* storage unavailable */
		}
	}
	const mapWide = $derived(s.regions.find((r) => r.zones === null && r.weatherEvent));

	const zone = $derived(zoneId ? graph.zones.get(zoneId) : undefined);
	const warband = $derived(warbandId ? wb.get(warbandId) : undefined);
	const zoneGame = $derived(zoneId ? s.active.find((g) => g.zone === zoneId) : undefined);
	const zoneName = (id: string) => graph.zones.get(id)?.name ?? id;
</script>

<svelte:head><title>{s.campaign.name} · Live</title></svelte:head>

<div class="stage">
	<LiveMap
		snapshot={s}
		selected={warbandId}
		onzone={(id) => {
			zoneId = id;
			warbandId = null;
		}}
		onwarband={(id) => {
			warbandId = warbandId === id ? null : id;
			zoneId = null;
		}}
		{fxEnabled}
		subscribeTriggers={live.onTrigger}
	/>

	<header class="bar">
		<div class="title">
			<span class="kicker">Trench Crusade</span>
			<span class="name">{s.campaign.name}</span>
		</div>
		<nav>
			<button class="chip" onclick={toggleFx} aria-pressed={fxEnabled} title="Weather effects on this device">
				<span class="long">{fxEnabled ? 'Weather on' : 'Weather off'}</span><span class="short" class:off={!fxEnabled}>Weather</span>
			</button>
			<button class="chip" onclick={() => (showStandings = !showStandings)}>Standings</button>
			<a class="chip" href="/zones">Zones</a>
			<a class="chip" href="/history">Chronicle</a>
			<span class="dot" class:on={live.connected} title={live.connected ? 'Live' : 'Reconnecting…'}></span>
		</nav>
	</header>

	{#if mapWide?.weatherEvent}
		{@const we = weatherByRoll(mapWide.weatherEvent)}
		<div class="omen">{mapWide.name ? `${mapWide.name}: ` : ''}<strong>{we?.name}</strong> across the front</div>
	{/if}

	{#if s.active.length}
		<div class="playing" aria-label="Now playing">
			{#each s.active as g (g.id)}
				{@const a = wb.get(g.aggressor)}
				{@const d = wb.get(g.defender)}
				<button class="battle" onclick={() => { zoneId = g.zone; warbandId = null; }}>
					<span class="pair">
						{#if a}<Portrait name={a.player} portrait={a.portrait} symbol={a.symbol} size={30} />{/if}
						{#if d}<Portrait name={d.player} portrait={d.portrait} symbol={d.symbol} size={30} />{/if}
					</span>
					<span class="txt">
						<strong>{a?.player} vs {d?.player}</strong>
						<small>{zoneName(g.zone)}{g.weatherEvent ? ` · ${weatherByRoll(g.weatherEvent)?.name}` : ''}</small>
					</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if showStandings}
		<aside class="drawer">
			<h2>Standings</h2>
			<ol>
				{#each s.standings as row, i (row.id)}
					{@const w = wb.get(row.id)}
					{#if w}
						<li>
							<span class="rank">{i + 1}</span>
							<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} size={34} />
							<a href="/players/{w.id}" class="who"><strong>{w.player}</strong><small>{w.name}</small></a>
							<span class="score"><strong>{row.total}</strong><small>{w.games}/{s.campaign.gamesPerPlayer}</small></span>
						</li>
					{/if}
				{/each}
			</ol>
			<a href="/players">Full standings →</a>
		</aside>
	{/if}

	{#if zone && zoneGame}
		<aside class="sheet wide">
			<button class="close" aria-label="Close" onclick={() => (zoneId = null)}>×</button>
			<BattlePanel game={zoneGame} {zone} snapshot={s} {zoneName} />
		</aside>
	{:else if zone}
		<aside class="sheet">
			<button class="close" aria-label="Close" onclick={() => (zoneId = null)}>×</button>
			<div class="kicker">{zone.type === 'entry' ? 'Entry Zone' : zone.type === 'special' ? 'Special Zone' : 'Zone'}{zone.house ? ' · our campaign' : ''}</div>
			<h2>{zone.name}</h2>
			<ZoneFacts {zone} snapshot={s} compact />
			<a class="lore-link" href="/zones/{zone.id}">Read the lore →</a>
		</aside>
	{:else if warband}
		<aside class="sheet">
			<button class="close" aria-label="Close" onclick={() => (warbandId = null)}>×</button>
			<div class="who-head">
				<Portrait name={warband.player} portrait={warband.portrait} symbol={warband.symbol} size={64} />
				<div>
					<h2>{warband.player}</h2>
					<div class="muted">{warband.name}</div>
				</div>
			</div>
			<p>
				<strong>{warband.cvp}</strong> CVP · {warband.games}/{s.campaign.gamesPerPlayer} games · {warband.wins} won ·
				{warband.dice}D6 exploration
			</p>
			<p class="muted">
				At {zoneName(warband.position)} · {warband.outposts.length} Outposts ({warband.supplied.length} supplied) ·
				{warband.scouted.length} zones scouted{warband.omens ? ` · ${warband.omens} Omen${warband.omens > 1 ? 's' : ''}` : ''}
			</p>
			<a href="/players/{warband.id}">Campaign Tracker →</a>
		</aside>
	{/if}
</div>

<style>
	.stage {
		position: fixed;
		inset: 0;
		background: var(--ink);
		overflow: hidden;
	}
	.bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: linear-gradient(rgba(35, 26, 18, 0.92), rgba(35, 26, 18, 0));
		pointer-events: none;
	}
	.bar > * {
		pointer-events: auto;
	}
	.title {
		display: grid;
		line-height: 1.05;
		color: var(--parchment);
	}
	.kicker {
		font-variant-caps: small-caps;
		letter-spacing: 0.14em;
		font-size: 0.8rem;
		color: var(--rule);
	}
	.name {
		font-family: var(--font-display);
		font-size: 1.5rem;
	}
	nav {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.chip {
		padding: 5px 10px;
		font-size: 0.85rem;
		background: rgba(35, 26, 18, 0.85);
		border: 1px solid var(--rule);
		color: var(--parchment);
		text-decoration: none;
		font-variant-caps: small-caps;
		letter-spacing: 0.06em;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--muted);
	}
	.dot.on {
		background: #6fbf4a;
		box-shadow: 0 0 6px #6fbf4a;
	}
	.omen {
		position: absolute;
		bottom: 12px;
		right: 12px;
		max-width: calc(100% - 24px);
		padding: 5px 12px;
		background: rgba(35, 26, 18, 0.85);
		color: var(--parchment);
		border: 1px solid var(--blood);
		font-size: 0.9rem;
	}
	.playing {
		position: absolute;
		top: 58px;
		left: 12px;
		right: 12px;
		display: flex;
		gap: 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.battle {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: none;
		padding: 4px 10px 4px 4px;
		background: rgba(246, 237, 219, 0.95);
		color: var(--ink);
		border: 1px solid var(--blood);
		text-align: left;
		font-variant-caps: normal;
		letter-spacing: 0;
	}
	.battle:hover {
		background: var(--paper);
	}
	.pair {
		display: flex;
	}
	.pair :global(.portrait + .portrait) {
		margin-left: -8px;
	}
	.txt {
		display: grid;
		line-height: 1.15;
		font-size: 0.85rem;
	}
	.txt small {
		color: var(--blood);
	}
	.drawer {
		position: absolute;
		top: 58px;
		right: 12px;
		width: min(22rem, calc(100% - 24px));
		max-height: calc(100% - 80px);
		overflow-y: auto;
		padding: 12px 14px;
		background: var(--paper);
		border: 1px solid var(--rule);
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
	}
	.drawer h2 {
		margin: 0 0 6px;
	}
	.drawer ol {
		list-style: none;
		padding: 0;
		margin: 0 0 10px;
		display: grid;
		gap: 4px;
	}
	.drawer li {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.rank {
		width: 1.4em;
		text-align: right;
		color: var(--muted);
	}
	.who {
		display: grid;
		flex: 1;
		min-width: 0;
		color: inherit;
		text-decoration: none;
		line-height: 1.15;
	}
	.who small,
	.score small {
		color: var(--muted);
		font-size: 0.8em;
	}
	.score {
		display: grid;
		text-align: right;
		line-height: 1.1;
	}
	.sheet {
		position: absolute;
		left: 12px;
		bottom: 12px;
		width: min(26rem, calc(100% - 24px));
		max-height: 55%;
		overflow-y: auto;
		padding: 14px 16px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-top: 3px solid var(--blood);
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
	}
	.sheet h2 {
		margin: 0 0 6px;
		font-size: 1.8rem;
	}
	.sheet p {
		margin: 4px 0;
	}
	.sheet .kicker {
		color: var(--blood);
	}
	.sheet.wide {
		width: min(52rem, calc(100% - 24px));
		max-height: 72%;
	}
	.close {
		position: absolute;
		top: 6px;
		right: 6px;
		padding: 0 10px;
		font-size: 1.3rem;
		background: none;
		color: var(--ink);
		border: none;
	}
	.lore-link {
		display: inline-block;
		margin-top: 10px;
		font-variant-caps: small-caps;
		letter-spacing: 0.04em;
	}
	.who-head {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.muted {
		color: var(--muted);
	}
	.short {
		display: none;
	}
	.short.off {
		text-decoration: line-through;
		opacity: 0.6;
	}
	.chip {
		white-space: nowrap;
	}
	@media (max-width: 34rem) {
		.bar {
			padding: 6px 8px;
		}
		.title .kicker {
			display: none;
		}
		.name {
			font-size: 1.15rem;
			white-space: nowrap;
		}
		.chip {
			padding: 4px 7px;
			font-size: 0.75rem;
		}
		.long {
			display: none;
		}
		.short {
			display: inline;
		}
		.playing {
			top: 46px;
			left: 8px;
			right: 8px;
		}
		.drawer {
			top: 46px;
		}
		.sheet {
			left: 8px;
			right: 8px;
			width: auto;
			bottom: 8px;
		}
	}
</style>

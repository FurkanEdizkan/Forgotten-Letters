<script lang="ts">
	import LiveMap from '$lib/components/LiveMap.svelte';
	import Portrait from '$lib/components/Portrait.svelte';
	import Seal from '$lib/components/Seal.svelte';
	import { sealLook } from '$lib/seals';
	import ZoneFacts from '$lib/components/ZoneFacts.svelte';
	import BattlePanel from '$lib/components/BattlePanel.svelte';
	import BattleControls from '$lib/components/BattleControls.svelte';
	import ArrangeBattle from '$lib/components/ArrangeBattle.svelte';
	import Dice from '$lib/components/Dice.svelte';
	import Lockup from '$lib/components/Lockup.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import BattleHud from '$lib/components/BattleHud.svelte';
	import RoundPanel from '$lib/components/RoundPanel.svelte';
	import RollToasts from '$lib/components/RollToasts.svelte';
	import ResultBanner from '$lib/components/ResultBanner.svelte';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { cubicOut } from 'svelte/easing';
	import { page } from '$app/state';
	import type { BattleResultEvent, DiceRoll } from '$lib/fx/types';
	import { getLive } from '$lib/context';
	import { buildGraph } from '$lib/rules/zones';
	import { weatherByRoll } from '$lib/rules/weather';

	const live = getLive();
	const s = $derived(live.current);
	const graph = $derived(buildGraph(s.campaign.houseZones));
	const wb = $derived(new Map(s.warbands.map((w) => [w.id, w])));

	let zoneId = $state<string | null>(null);
	let warbandId = $state<string | null>(null);
	/** A battle picked out of several on one zone (its details sheet shows that one, not the zone's first). */
	let gameId = $state<string | null>(null);
	/** A zone holding several battles, zoomed into so they can be told apart and tapped. */
	let peekZone = $state<string | null>(null);
	let showStandings = $state(false);
	// Height of the smoke band that holds the chrome; the map plate starts below it.
	let bandH = $state(64);
	const isAdmin = $derived(!!page.data.isAdmin);
	// Visitors who haven't signed in see the map, the standings and a way to sign in; nothing else.
	const signedIn = $derived(!!page.data.user);
	const signInHref = $derived(`/login?next=${encodeURIComponent(page.url.pathname + page.url.search)}`);
	// The round of battles: the viewer's warbands, and map taps routed to the round panel while picking a battlefield.
	const mine = $derived(((page.data.user as { warbandIds?: string[] } | null)?.warbandIds ?? []) as string[]);
	let roundPicking = $state(false);
	let pickZone = $state<string | null>(null);

	// Hell on Earth dice rolled anywhere show up on every map.
	let project = $state<((zoneId: string) => { x: number; y: number } | null) | undefined>();
	let dice = $state<{ roll: DiceRoll; zone: string; key: number } | null>(null);
	// Special events (a zeppelin crossing) carry a banner for as long as they last.
	let event = $state<{ text: string; key: number } | null>(null);
	let eventTimer: ReturnType<typeof setTimeout> | undefined;
	// A battle's result plays on every screen: the camera goes there, and the banner lands once the monument stands.
	let result = $state<{ battle: BattleResultEvent; zone: string; key: number } | null>(null);
	$effect(() =>
		live.onTrigger((t) => {
			if (t.kind === 'battle-result' && t.battle && t.zone) result = { battle: t.battle, zone: t.zone, key: t.seed };
			if (t.kind === 'dice' && t.dice && t.zone) dice = { roll: t.dice, zone: t.zone, key: t.seed };
			if (t.kind === 'zeppelin' && t.zeppelin) {
				event = { text: t.zeppelin.text, key: t.seed };
				clearTimeout(eventTimer);
				eventTimer = setTimeout(() => (event = null), t.zeppelin.seconds * 1000);
			}
		})
	);

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
	const zoneGame = $derived(
		zoneId ? (s.active.find((g) => g.id === gameId && g.zone === zoneId) ?? s.active.find((g) => g.zone === zoneId)) : undefined
	);
	const peekCount = $derived(peekZone ? s.active.filter((g) => g.zone === peekZone).length : 0);
	const zoneName = (id: string) => graph.zones.get(id)?.name ?? id;

	// Active battle mode: /?battle=<game> flies into a battle being fought (shareable, so the TV can sit in it).
	const battleId = $derived(page.url.searchParams.get('battle'));
	const battle = $derived(battleId ? s.active.find((g) => g.id === battleId && g.status === 'in_progress') : undefined);
	const focus = $derived(battle?.zone ?? result?.zone ?? peekZone ?? null);

	/** A battle's own marker: one being fought is entered (again: its details); a planned one opens its details. */
	function openBattle(id: string) {
		const g = s.active.find((x) => x.id === id);
		if (!g) return;
		warbandId = null;
		peekZone = null;
		if (g.status === 'in_progress' && g.id !== battleId) {
			zoneId = null;
			enterBattle(g.id);
			return;
		}
		gameId = g.id;
		zoneId = g.zone;
	}
	const enterBattle = (id: string) => goto(`?battle=${id}`, { noScroll: true, keepFocus: true });
	const leaveBattle = () => {
		zoneId = null;
		goto('/', { noScroll: true, keepFocus: true });
	};
	function endResult() {
		const id = result?.battle.gameId;
		result = null;
		if (id && id === battleId) leaveBattle();
	}

	// /?replay=<game>: play a finished battle's result again, on this screen only.
	$effect(() => {
		const id = page.url.searchParams.get('replay');
		if (!id) return;
		fetch(`/api/battle-result/${encodeURIComponent(id)}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((b: BattleResultEvent | null) => {
				const z = s.monuments.find((m) => m.gameId === id)?.zone;
				if (b && z) live.play({ kind: 'battle-result', zone: z, seed: Math.floor(Math.random() * 2 ** 31), battle: b });
			});
		goto('/', { replaceState: true, noScroll: true, keepFocus: true });
	});
</script>

<svelte:head><title>{s.campaign.name} · Live</title></svelte:head>

<svelte:window
	onkeydown={(e) => {
		// In a battle, Esc steps back one level: the details page first, then out of the battle.
		if (e.key === 'Escape' && !battle && peekZone) {
			peekZone = null;
			return;
		}
		if (e.key !== 'Escape' || !battle) return;
		if (zoneId || warbandId) {
			zoneId = null;
			warbandId = null;
		} else leaveBattle();
	}}
/>

<div class="stage" style:--band="{bandH}px">
	<div class="plate">
		<LiveMap
			snapshot={s}
			selected={warbandId}
			onzone={(id) => {
				if (roundPicking) {
					pickZone = id;
					return;
				}
				const here = s.active.filter((g) => g.zone === id);
				// Several battles on this zone: fly closer so they fan apart, then the player taps the one they want.
				if (here.length > 1 && !battle) {
					zoneId = null;
					warbandId = null;
					peekZone = id;
					return;
				}
				if (here.length === 1) return openBattle(here[0].id);
				peekZone = null;
				gameId = null;
				zoneId = id;
				warbandId = null;
			}}
			onbattle={openBattle}
			focusGame={battle?.id ?? null}
			focusScale={battle || result ? 3 : 1.5}
			onwarband={(id) => {
				warbandId = warbandId === id ? null : id;
				zoneId = null;
			}}
			{fxEnabled}
			subscribeTriggers={live.onTrigger}
			{focus}
			clockSkew={live.clockSkew}
			bind:project
		/>
	</div>

	{#if battle}
		{#key battle.id}
			<BattleHud
				game={battle}
				zone={graph.zones.get(battle.zone)}
				snapshot={s}
				stepped={!!(zone || warband)}
				ondetails={() => {
					zoneId = battle.zone;
					warbandId = null;
				}}
				onleave={leaveBattle}
			/>
		{/key}
	{/if}

	{#if result}
		{#key result.key}<ResultBanner battle={result.battle} onclose={endResult} />{/key}
	{/if}

	{#if event}
		{#key event.key}<div class="event-banner" role="status">
				<Mark name="cross" size="0.8em" />
				{event.text}
			</div>{/key}
	{/if}

	{#if dice}
		{#key dice.key}
			{@const at = project?.(dice.zone)}
			<Dice
				roll={dice.roll}
				zoneName={zoneName(dice.zone)}
				at={at ? { x: at.x, y: at.y + bandH } : null}
				onclose={() => (dice = null)}
			/>
		{/key}
	{/if}

	<div class="band" bind:clientHeight={bandH}>
		<header class="bar" class:guest={!signedIn}>
			<Lockup name={s.campaign.name} href="/players" compact />
			<nav>
				{#if signedIn}
					<button class="chip" onclick={() => (showStandings = !showStandings)}>Standings</button>
				{:else}
					<!-- On a phone the docked standings would cover the map, so they fold into this chip. -->
					<button class="chip phone-only" onclick={() => (showStandings = !showStandings)}>Standings</button>
					<a class="chip" href={signInHref}>Sign in</a>
				{/if}
				<span
					class="dot"
					class:on={live.connected}
					title={live.connected ? 'Live' : 'Reconnecting…'}
				></span>
			</nav>
		</header>
		{#if s.active.length}
			<div class="playing" aria-label="Now playing">
				{#each s.active as g (g.id)}
					{@const a = wb.get(g.aggressor)}
					{@const d = wb.get(g.defender)}
					<button
						class="battle"
						class:planned={g.status === 'scheduled'}
						onclick={() => {
							// A battle being fought is entered, as from the map; a planned one opens its zone's page.
							// Clicked again from inside that battle, it opens the details.
							if (g.status === 'in_progress') {
								warbandId = null;
								if (g.id === battleId) zoneId = g.zone;
								else {
									zoneId = null;
									enterBattle(g.id);
								}
								return;
							}
							openBattle(g.id);
						}}
					>
						<span class="pair">
							{#if a}<Portrait
									name={a.player}
									portrait={a.portrait}
									symbol={a.symbol} faction={a.faction} seal={a.seal}
									size={30}
								/>{/if}
							{#if d}<Portrait
									name={d.player}
									portrait={d.portrait}
									symbol={d.symbol} faction={d.faction} seal={d.seal}
									size={30}
								/>{/if}
						</span>
						<span class="txt">
							<strong>{a?.player} <span class="vs">vs</span> {d?.player}</strong>
							<small
								>{g.status === 'scheduled' ? 'Planned · ' : ''}{zoneName(g.zone)}{g.weatherEvent
									? ` · ${weatherByRoll(g.weatherEvent)?.name}`
									: ''}</small
							>
						</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if s.campaign.stage === 'underway' && !battle}
		<div class="round-dock"><RoundPanel snapshot={s} zones={graph.zones} {mine} bind:pickZone bind:picking={roundPicking} /></div>
	{/if}
	<RollToasts subscribe={live.onTrigger} />
	{#if peekZone && peekCount > 1}
		<div class="peek" role="status">
			{peekCount} battles at {zoneName(peekZone)} — tap one
			<button class="ghost small" onclick={() => (peekZone = null)}>Back</button>
		</div>
	{/if}

	<!-- One switch, top-left of the map: clear the sky to read the plain battle map, then back to the battlefield as it stands. -->
	<button
		class="chip sky"
		class:in-battle={!!battle}
		onclick={toggleFx}
		title={fxEnabled ? 'Hide weather and animations: the plain battle map' : 'Show the battlefield as it stands now, weather and all'}
	>
		{fxEnabled ? 'Clear skies' : 'Satellite view'}
	</button>

	{#if s.campaign.stage === 'mustering'}
		<div class="muster-banner" role="status">
			<strong>Mustering</strong>
			{s.warbands.length} warband{s.warbands.length === 1 ? ' has' : 's have'} come ashore · the campaign begins when every seat is ready
			{#if page.data.user}<a href="/muster">Your muster →</a>{/if}
		</div>
	{/if}

	{#if mapWide?.weatherEvent && !battle}
		{@const we = weatherByRoll(mapWide.weatherEvent)}
		<div class="omen">
			{mapWide.name ? `${mapWide.name}: ` : ''}<strong>{we?.name}</strong> across the front
		</div>
	{/if}

	{#snippet standingsList(symbolOnly: boolean)}
		<h2>Standings</h2>
		<ol>
			{#each s.standings as row, i (row.id)}
				{@const w = wb.get(row.id)}
				{#if w}
					<li>
						<span class="rank">{i + 1}</span>
						{#if !symbolOnly}
							<Portrait name={w.player} portrait={w.portrait} symbol={w.symbol} faction={w.faction} seal={w.seal} size={34} />
						<!-- Visitors see the faction's symbol, never the player's portrait: its seal, else the warband's own symbol. -->
						{:else if w.seal ?? sealLook(w.faction)}
							<Seal look={w.seal} faction={w.faction} size={34} label={w.name} />
						{:else if w.symbol}
							<img class="symbol" src={w.symbol} alt="" width="34" height="34" />
						{:else}
							<Portrait name={w.player} faction={w.faction} size={34} />
						{/if}
						<a href="/players/{w.id}" class="who"><strong>{w.player}</strong><small>{w.name}</small></a>
						<span class="score"><strong>{row.total}</strong><small>{w.games}/{s.campaign.gamesPerPlayer}</small></span>
					</li>
				{/if}
			{/each}
		</ol>
		<a href="/players">Full standings →</a>
	{/snippet}

	<!-- In a battle the two warbands take the screen; the standings wait until the viewer leaves. -->
	{#if !signedIn && !battle}
		<aside class="dock" aria-label="Standings">{@render standingsList(true)}</aside>
	{/if}
	{#if showStandings}
		<aside class="drawer">{@render standingsList(!signedIn)}</aside>
	{/if}

	{#if zone && zoneGame}
		<aside class="sheet wide" class:in-battle={!!battle} transition:fly={{ x: 48, duration: 380, easing: cubicOut }}>
			<button class="close" aria-label="Close" onclick={() => (zoneId = null)}
				><Mark name="close" /></button
			>
			{#if zoneGame.status === 'in_progress' && zoneGame.id !== battleId}
				<button class="enter" onclick={() => enterBattle(zoneGame.id)}>Enter the battle</button>
			{/if}
			<BattlePanel game={zoneGame} {zone} snapshot={s} {zoneName}>
				{#snippet controls()}
					{#if isAdmin}<BattleControls game={zoneGame} {zone} snapshot={s} />{/if}
				{/snippet}
			</BattlePanel>
			<footer class="running-foot">{zone.name}</footer>
		</aside>
	{:else if zone}
		<aside class="sheet" class:in-battle={!!battle} transition:fly={{ x: 48, duration: 380, easing: cubicOut }}>
			<button class="close" aria-label="Close" onclick={() => (zoneId = null)}
				><Mark name="close" /></button
			>
			<h2>{zone.name}</h2>
			<p class="kind">
				{zone.type === 'entry'
					? 'Entry Zone'
					: zone.type === 'special'
						? 'Special Zone'
						: 'Zone'}{zone.house ? ' of our campaign' : ''}
			</p>
			<ZoneFacts {zone} snapshot={s} compact />
			<a class="lore-link" href="/zones/{zone.id}">Read the lore →</a>
			{#if isAdmin && zone.type !== 'entry'}<ArrangeBattle zoneId={zone.id} />{/if}
			<footer class="running-foot">{zone.name}</footer>
		</aside>
	{:else if warband}
		<aside class="sheet" class:in-battle={!!battle} transition:fly={{ x: 48, duration: 380, easing: cubicOut }}>
			<button class="close" aria-label="Close" onclick={() => (warbandId = null)}
				><Mark name="close" /></button
			>
			<div class="who-head">
				<Portrait
					name={warband.player}
					portrait={warband.portrait}
					symbol={warband.symbol} faction={warband.faction} seal={warband.seal}
					size={64}
				/>
				<div>
					<h2>{warband.player}</h2>
					<div class="muted">{warband.name}</div>
				</div>
			</div>
			<p>
				<strong>{warband.cvp}</strong> CVP · {warband.games}/{s.campaign.gamesPerPlayer} games · {warband.wins}
				won ·
				{warband.dice}D6 exploration
			</p>
			<p class="muted">
				At {zoneName(warband.position)} · {warband.outposts.length} Outposts ({warband.supplied
					.length} supplied) ·
				{warband.scouted.length} zones scouted{warband.omens
					? ` · ${warband.omens} Omen${warband.omens > 1 ? 's' : ''}`
					: ''}
			</p>
			<p class="links"><a href="/warbands/{warband.id}">Warband</a> · <a href="/players/{warband.id}">Campaign Tracker</a></p>
			<footer class="running-foot">{warband.name}</footer>
		</aside>
	{/if}
</div>

<style>
	.enter {
		display: block;
		width: 100%;
		margin: 0 0 10px;
		padding: 9px 14px;
		background: #8f1f18;
		color: var(--bone);
		border: 1px solid #b3261e;
		font: inherit;
		font-weight: 600;
		letter-spacing: 0.04em;
		cursor: pointer;
	}
	.enter:hover {
		background: #a3170f;
	}
	/* The painted night around the map; panels are pages of the book laid over it. */
	.stage {
		position: fixed;
		inset: 0;
		background: var(--night);
		overflow: hidden;
	}
	/* The map plate sits below a band of smoke that carries all the chrome. */
	.plate {
		position: absolute;
		top: var(--band);
		left: 0;
		right: 0;
		bottom: 0;
	}
	.band {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 2;
		display: grid;
		gap: 8px;
		padding: 10px 14px;
		background: var(--night);
		border-bottom: 1px solid rgba(236, 229, 211, 0.18);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
	}
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		/* The navigation handle floats in this corner. */
		padding-left: 2.75rem;
	}
	nav {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		padding: 5px 12px;
		background: rgba(21, 19, 14, 0.78);
		border: 1px solid rgba(236, 229, 211, 0.35);
		color: var(--bone);
		text-decoration: none;
		font-family: var(--font-title);
		font-weight: 400;
		font-size: 1rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
		transition:
			border-color 0.18s var(--ease-out),
			color 0.18s var(--ease-out);
	}
	.chip:hover {
		background: rgba(21, 19, 14, 0.9);
		border-color: var(--ember);
		color: #fff;
	}
	/* Floats on the map plate itself, clear of the navigation handle over the band. */
	.sky {
		position: absolute;
		z-index: 2;
		top: calc(var(--band) + 14px);
		left: 14px;
	}
	/* Inside a battle the HUD's Leave button takes that corner: the switch moves to the other end of the top row, above the HUD. */
	.sky.in-battle {
		z-index: 5;
		left: auto;
		right: 14px;
	}
	.dot {
		width: 9px;
		height: 9px;
		margin-left: 4px;
		border-radius: 50%;
		background: var(--smoke);
	}
	.dot.on {
		background: #95b54c;
	}
	.event-banner {
		position: absolute;
		z-index: 3;
		top: calc(var(--band) + 40px);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 12px;
		max-width: calc(100% - 24px);
		padding: 10px 22px;
		background: rgba(21, 19, 14, 0.92);
		color: var(--bone);
		border-top: 2px solid var(--blood-bright);
		border-bottom: 2px solid var(--blood-bright);
		font-family: var(--font-display);
		font-size: 1.45rem;
		text-align: center;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
		animation: banner 0.7s var(--ease-out);
		pointer-events: none;
	}
	.event-banner :global(.mark) {
		color: var(--blood-bright);
	}
	@keyframes banner {
		from {
			opacity: 0;
			transform: translate(-50%, -14px);
			filter: blur(4px);
		}
	}
	/* The round of battles, under the sky switch on the left. */
	.round-dock {
		position: absolute;
		z-index: 2;
		top: calc(var(--band) + 60px);
		left: 14px;
		bottom: 60px;
		display: flex;
		align-items: flex-start;
		pointer-events: none;
	}
	.round-dock > :global(*) {
		pointer-events: auto;
	}
	.peek {
		position: absolute;
		z-index: 3;
		left: 50%;
		bottom: 14px;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 8px 6px 16px;
		background: rgba(21, 19, 14, 0.92);
		color: var(--bone);
		border-top: 2px solid var(--blood-bright);
	}
	.peek button {
		color: var(--bone);
		border-color: rgba(236, 229, 211, 0.4);
		background: none;
	}
	.muster-banner {
		position: absolute;
		z-index: 2;
		left: 50%;
		bottom: 14px;
		transform: translateX(-50%);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: center;
		gap: 4px 10px;
		max-width: calc(100% - 28px);
		padding: 8px 18px;
		background: rgba(21, 19, 14, 0.9);
		color: var(--bone);
		border-top: 2px solid var(--blood-bright);
		text-align: center;
	}
	.muster-banner strong {
		font-family: var(--font-title);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ember);
	}
	.muster-banner a {
		color: var(--bone);
		font-weight: 700;
	}
	.omen {
		position: absolute;
		z-index: 2;
		bottom: 14px;
		left: 14px;
		max-width: calc(100% - 28px);
		padding: 6px 14px;
		background: rgba(21, 19, 14, 0.88);
		color: var(--bone);
		border: 1px solid var(--blood-bright);
		font-size: 0.95rem;
	}
	.omen strong {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.15rem;
		color: var(--ember);
	}
	/* Battles in play: small pages pinned along the top of the map. */
	.playing {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.battle {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: none;
		padding: 4px 12px 4px 4px;
		background: var(--paper);
		color: var(--ink);
		border: 1px solid var(--ink);
		border-top: 2px solid var(--blood);
		text-align: left;
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 1rem;
		text-transform: none;
		letter-spacing: 0;
	}
	.battle.planned {
		border-top-style: dashed;
		border-top-color: var(--ink);
	}
	.battle:hover {
		background: var(--paper);
		color: var(--ink);
		border-color: var(--blood);
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
		font-size: 0.88rem;
	}
	.vs {
		font-family: var(--font-display);
		font-weight: 400;
		color: var(--blood);
	}
	.txt small {
		color: var(--muted);
	}
	.drawer,
	.dock {
		position: absolute;
		z-index: 3;
		top: calc(var(--band) + 12px);
		right: 14px;
		width: min(22rem, calc(100% - 28px));
		max-height: calc(100% - var(--band) - 26px);
		overflow-y: auto;
		padding: 14px 16px;
		background: var(--paper);
		border-top: 2px solid var(--blood);
		box-shadow: 0 16px 50px rgba(0, 0, 0, 0.6);
	}
	/* Docked standings sit under the book-page sheets, which lay over them. */
	.dock {
		z-index: 2;
	}
	.phone-only {
		display: none;
	}
	.bar.guest {
		padding-left: 0;
	}
	.drawer h2,
	.dock h2 {
		margin: 0 0 8px;
	}
	.drawer ol,
	.dock ol {
		list-style: none;
		padding: 0;
		margin: 0 0 10px;
		border-top: 2px solid var(--ink);
	}
	.drawer li,
	.dock li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 0;
		border-bottom: 1px solid var(--rule);
	}
	.rank {
		width: 1.4em;
		text-align: right;
		font-family: var(--font-display);
		font-size: 1.25rem;
		color: var(--blood);
	}
	.symbol {
		flex: none;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		object-fit: cover;
	}
	.who {
		display: grid;
		flex: 1;
		min-width: 0;
		color: inherit;
		text-decoration: none;
		line-height: 1.15;
	}
	.who:hover strong {
		color: var(--blood);
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
		font-variant-numeric: lining-nums;
	}
	.score strong {
		font-size: 1.25rem;
	}
	/* A page of the book, laid over the right edge of the map. */
	.sheet {
		position: absolute;
		z-index: 3;
		top: calc(var(--band) + 12px);
		right: 14px;
		bottom: 14px;
		width: min(27rem, calc(100% - 28px));
		overflow-y: auto;
		padding: 18px 22px 22px;
		background: var(--paper);
		border-top: 2px solid var(--blood);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65);
		overscroll-behavior: contain;
	}
	.sheet h2 {
		margin: 0 30px 4px 0;
		font-size: 2.1rem;
	}
	.sheet p {
		margin: 4px 0;
	}
	.kind {
		font-family: var(--font-title);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.sheet .running-foot {
		margin: 28px 0 0;
		font-size: 0.95rem;
	}
	.sheet.wide {
		width: min(54rem, calc(100% - 28px));
	}
	/* In a battle the details page sits under the top row, so Leave and the sky switch stay reachable. */
	.sheet.in-battle {
		top: calc(var(--band) + 62px);
	}
	.close {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 36px;
		height: 36px;
		padding: 0;
		font-size: 1.1rem;
		background: none;
		color: var(--ink);
		border: 1px solid transparent;
	}
	.close:hover {
		background: none;
		color: var(--blood);
		border-color: var(--rule);
	}
	.lore-link {
		display: inline-block;
		margin: 14px 0 6px;
		font-weight: 600;
	}
	.who-head {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 8px;
	}
	.who-head h2 {
		margin: 0;
	}
	.muted {
		color: var(--muted);
	}
	@media (max-width: 34rem) {
		.band {
			padding: 8px;
			gap: 6px;
		}
		.bar :global(.lockup .name) {
			font-size: 0.95rem;
			white-space: nowrap;
		}
		.bar :global(.lockup .series) {
			font-size: 0.56rem;
		}
		nav {
			gap: 4px;
		}
		.chip {
			padding: 3px 6px;
			font-size: 0.74rem;
			letter-spacing: 0.04em;
		}
		.drawer {
			top: calc(var(--band) + 8px);
			right: 8px;
			width: calc(100% - 16px);
		}
		.sheet,
		.sheet.wide {
			top: auto;
			left: 8px;
			right: 8px;
			bottom: 8px;
			width: auto;
			max-height: 62%;
			padding: 14px 16px 18px;
		}
	}
	@media (max-width: 40rem) {
		.dock {
			display: none;
		}
		.phone-only {
			display: inline-flex;
		}
	}
</style>

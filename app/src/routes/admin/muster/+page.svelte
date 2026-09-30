<script lang="ts">
	import { enhance } from '$app/forms';
	import { STAGES, STAGE_LABELS } from '$lib/campaign-flow';
	import { FACTIONS } from '$lib/rules/factions';

	let { data, form } = $props();
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const at = $derived(STAGES.indexOf(data.stage));
	const ready = $derived(data.seats.filter((s) => s.steps.ready).length);
	const withWarband = $derived(data.seats.filter((s) => s.warband).length);
	const needDeal = $derived(data.seats.some((s) => s.warband && !s.warband.visionCard && !s.warband.visionOffer?.length));
	const faction = (id: string) => FACTIONS.find((f) => f.id === id)?.name ?? id;
	const vision = (id: string) => data.visions.find((v) => v.id === id)?.name ?? id;
	let copied = $state(false);
	async function copy(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* the link stays selectable */
		}
	}
</script>

<svelte:head><title>Muster · Admin</title></svelte:head>

<h1>Muster</h1>

<ol class="stages" aria-label="Campaign stage">
	{#each STAGES as s, i (s)}
		<li class:done={i < at} class:now={i === at} aria-current={i === at ? 'step' : undefined}>{STAGE_LABELS[s]}</li>
	{/each}
</ol>

<section class="next rules-box">
	{#if data.stage === 'setup'}
		<h2>Set up the seats</h2>
		<p>One seat per player. Each gets an invite link once mustering opens; you can also build a warband for a seat yourself.</p>
		<form method="POST" action="?/seats" class="inline" use:enhance={keep}>
			<label class="inline">Seats <input name="count" type="number" min="2" max="16" value={Math.max(data.expectedPlayers, data.seats.length)} class="num" /></label>
			<button class="small">{data.seats.length ? 'Add missing seats' : 'Create the seats'}</button>
		</form>
		{#if data.seats.length >= 2}
			<form method="POST" action="?/advance" use:enhance={keep}><button>Open mustering</button></form>
		{/if}
	{:else if data.stage === 'mustering'}
		<h2>Mustering: {ready} of {data.seats.length} ready</h2>
		<p>Send each seat its invite link. Players join, build their warband and keep one of two Vision cards. You can do any step for a player.</p>
		<div class="inline">
			{#if needDeal}<form method="POST" action="?/deal" use:enhance={keep}><button class="small">Deal Vision cards</button></form>{/if}
			<form method="POST" action="?/advance" class="inline" use:enhance={keep}>
				<button disabled={withWarband < 2}>Start the campaign</button>
				{#if ready < data.seats.length}<label class="inline"><input type="checkbox" name="override" /> Start without the seats that aren't ready</label>{/if}
			</form>
		</div>
	{:else if data.stage === 'underway'}
		<h2>The campaign is under way</h2>
		<p>Rounds of battles run from the live map. Seats and warbands can still be edited here.</p>
	{:else}
		<h2>The campaign has ended</h2>
	{/if}
	{#if form?.message}<p class="note" role="status">{form.message}</p>{/if}
</section>

{#if form && 'invite' in form && form.invite}
	<section class="issued rules-box" role="status">
		<h3>Invite link</h3>
		<p>Send this to the player. It works once and for 7 days; it is shown only now.</p>
		<div class="inline">
			<code class="link">{form.invite.url}</code>
			<button type="button" class="small" onclick={() => copy(form.invite.url)}>{copied ? 'Copied' : 'Copy'}</button>
		</div>
	</section>
{/if}

{#if data.seats.length}
	<div class="scroll">
		<table class="ledger">
			<thead>
				<tr><th>Seat</th><th>Player</th><th>Warband</th><th>Entry</th><th>Vision</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.seats as s (s.playerId)}
					<tr class:ready={s.steps.ready}>
						<td>
							<form method="POST" action="?/rename" class="rename" use:enhance={keep}>
								<input type="hidden" name="player" value={s.playerId} />
								<span class="num-seat">{s.seat ?? '–'}</span>
								<input name="name" value={s.name} aria-label="Seat name" />
							</form>
						</td>
						<td>
							{#if s.account}
								<a href="/admin/players/{s.account.id}">{s.account.username}</a>
							{:else if s.invite?.state === 'valid'}
								<span class="muted">Invited · link open until {new Date(s.invite.expiresAt).toLocaleDateString()}</span>
								<form method="POST" action="?/revoke" use:enhance={keep}><input type="hidden" name="invite" value={s.invite.id} /><button class="link">Revoke</button></form>
							{:else if data.stage !== 'setup'}
								{#if s.invite}<span class="muted">Link {s.invite.state}</span>{/if}
								<form method="POST" action="?/invite" use:enhance={keep}>
									<input type="hidden" name="player" value={s.playerId} />
									<button class="ghost small">{s.invite ? 'New invite link' : 'Invite link'}</button>
								</form>
							{:else}
								<span class="muted">Invites open at mustering</span>
							{/if}
						</td>
						<td>
							{#if s.warband}
								<a href="/warbands/{s.warband.id}">{s.warband.name}</a> <small class="muted">{faction(s.warband.faction)}</small>
							{:else}
								<span class="muted">Not yet</span>
							{/if}
						</td>
						<td>
							{#if s.warband}
								<form method="POST" action="?/entry" use:enhance={keep}>
									<input type="hidden" name="warband" value={s.warband.id} />
									<select name="entryZone" value={s.warband.entryZone ?? ''} onchange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Entry Zone">
										{#each data.entryZones as z (z.id)}<option value={z.id}>{z.id}{z.id === s.suggestedEntry ? ' ·' : ''}</option>{/each}
									</select>
								</form>
							{:else}
								<span class="muted">{s.suggestedEntry}</span>
							{/if}
						</td>
						<td>
							{#if s.warband?.visionCard}
								<span title="Secret until the reveal">Kept: {vision(s.warband.visionCard)}</span>
							{:else if s.warband?.visionOffer?.length}
								<div class="offer">
									{#each s.warband.visionOffer as card (card)}
										<form method="POST" action="?/choose" use:enhance={keep}>
											<input type="hidden" name="warband" value={s.warband.id} />
											<input type="hidden" name="card" value={card} />
											<button class="ghost small" title="Keep this one for the player">{vision(card)}</button>
										</form>
									{/each}
								</div>
							{:else}
								<span class="muted">{s.warband ? 'Not dealt' : '—'}</span>
							{/if}
						</td>
						<td class="state">{s.steps.ready ? 'Ready' : s.steps.next === 'account' ? 'Needs a player' : s.steps.next === 'warband' ? 'Needs a warband' : 'Choosing Vision'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="muted">A “·” marks the seat's suggested Entry Zone. To build a warband for a seat yourself, use <a href="/warbands/new">New warband</a>.</p>
{/if}

<style>
	.stages {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		list-style: none;
		margin: 12px 0 18px;
		padding: 0;
		counter-reset: stage;
	}
	.stages li {
		counter-increment: stage;
		padding: 6px 16px 6px 12px;
		border: 1px solid var(--rule);
		margin-right: -1px;
		color: var(--muted);
		font-family: var(--font-title);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.stages li::before {
		content: counter(stage) '. ';
	}
	.stages li.done {
		color: var(--ink-soft);
	}
	.stages li.now {
		background: var(--ink);
		color: var(--parchment);
		border-color: var(--ink);
	}
	.next h2 {
		margin: 0 0 4px;
	}
	.next p {
		margin: 4px 0 10px;
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
	}
	.num {
		width: 4.5rem;
	}
	.note {
		font-weight: 600;
	}
	.issued {
		margin-top: 12px;
	}
	.link {
		user-select: all;
		overflow-wrap: anywhere;
		padding: 2px 6px;
		background: var(--paper);
		border: 1px solid var(--rule);
	}
	.scroll {
		overflow-x: auto;
		margin-top: 18px;
	}
	.ledger {
		width: 100%;
		border-collapse: collapse;
		border-top: 2px solid var(--ink);
		border-bottom: 2px solid var(--ink);
	}
	.ledger th {
		text-align: left;
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-soft);
		padding: 6px 10px 4px 0;
		border-bottom: 1px solid var(--rule);
	}
	.ledger td {
		padding: 6px 10px 6px 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: middle;
	}
	.rename {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.rename input {
		width: 9rem;
	}
	.num-seat {
		width: 1.6em;
		font-family: var(--font-display);
		color: var(--blood);
		font-size: 1.2rem;
	}
	.offer {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.state {
		white-space: nowrap;
		color: var(--ink-soft);
	}
	tr.ready .state {
		color: var(--supplies);
		font-weight: 700;
	}
	.muted {
		color: var(--muted);
	}
	button.link {
		padding: 0;
		background: none;
		border: 0;
		color: var(--blood);
		text-decoration: underline;
		font: inherit;
	}
</style>

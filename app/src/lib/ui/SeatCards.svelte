<!--
  The manage page's seats as cards (one per seat: number, name or player, state) with the picked seat's details
  beside them (SeatPanel). Replaces the seat table. Keyboard: the cards are buttons; the picked one is pressed.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import { joinOpen, type Stage } from '#lib/campaign-stage';
	import { SEATS_MIN } from '#lib/schemas/campaigns';
	import type { ApiSeat } from '#lib/api-types';
	import type { FormResult } from './form-result';
	import SeatPanel from './SeatPanel.svelte';

	type Props = { seats: ApiSeat[]; stage: Stage; form: FormResult };
	let { seats, stage, form }: Props = $props();
	const s = m.campaigns.manage.seats;

	let picked = $state<string | null>(null);
	// A removed seat drops the pick.
	const seat = $derived(seats.find((x) => x.id === picked) ?? null);

	const stateOf = (x: ApiSeat) =>
		x.player
			? { label: s.stTaken, tone: 'taken' }
			: x.link?.state === 'ready'
				? { label: s.stReady, tone: 'ready' }
				: x.link?.state === 'old'
					? { label: s.stOld, tone: 'old' }
					: { label: s.stNone, tone: 'none' };
</script>

<div class="seats">
	<ul class="cards" aria-label={s.cards}>
		{#each seats as x (x.id)}
			{@const st = stateOf(x)}
			<li>
				<button
					type="button"
					class="card"
					aria-pressed={picked === x.id}
					onclick={() => (picked = picked === x.id ? null : x.id)}
				>
					<span class="num data">{s.seat} {x.number}</span>
					<span class="who">{x.player?.displayName ?? x.name}</span>
					<span class="state {st.tone}">{st.label}</span>
				</button>
			</li>
		{/each}
	</ul>
	{#if seat}
		<SeatPanel
			{seat}
			{form}
			editable={stage !== 'ended'}
			links={joinOpen(stage, 'link')}
			removable={seats.length > SEATS_MIN}
		/>
	{:else}
		<p class="pick dim">{s.pick}</p>
	{/if}
</div>

<style>
	.seats {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
		gap: var(--space-4);
		align-items: start;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.card {
		display: grid;
		gap: var(--space-1);
		justify-items: start;
		width: 100%;
		padding: var(--space-3);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		color: var(--bone);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--easing),
			border-color var(--duration-fast) var(--easing);
	}
	.card:hover {
		background: var(--panel-hover);
	}
	.card[aria-pressed='true'] {
		border-color: var(--blood-bright);
		box-shadow: inset var(--border-status-edge) 0 0 var(--blood-bright);
	}
	.card:focus-visible {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: 2px;
	}
	.num {
		color: var(--bone-faint);
		font-size: var(--size-label);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.who {
		font-weight: 600;
	}
	.state {
		padding: 0 var(--space-2);
		border: var(--border-hairline) solid currentColor;
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		line-height: 1.6;
	}
	.taken {
		color: var(--ok);
	}
	.ready {
		color: var(--warn);
	}
	.old {
		color: var(--danger);
	}
	.none {
		color: var(--bone-faint);
	}
	.pick {
		padding: var(--space-4);
		border: var(--border-hairline) dashed var(--rule-strong);
	}
</style>

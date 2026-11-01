<!--
  The warband's campaign seat: the campaign it sits in (with Take out of the seat), or a pick of the player's seats
  in running campaigns to assign it to (with a re-check against the campaign's rules when they differ).
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import type { ApiWarband } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Select from '#lib/ui/Select.svelte';

	type Props = { warband: ApiWarband; seats: { value: string; label: string }[]; form: FormResult };
	let { warband: wb, seats, form }: Props = $props();
	const b = m.warbands.builder;
	const assign = $derived(resultOf(form, 'assign'));
	const unassign = $derived(resultOf(form, 'unassign'));
</script>

<section class="seat">
	<h3 class="sub">{b.seat}</h3>
	{#if wb.seat}
		<p><a href="/campaigns/{wb.seat.campaignId}">{wb.seat.campaignName}</a></p>
		{#if wb.canEdit}
			<form method="POST" action="?/unassign" use:enhance>
				<input type="hidden" name="op" value="unassign" />
				<input type="hidden" name="campaignId" value={wb.seat.campaignId} />
				<Button type="submit">{b.unassign}</Button>
			</form>
		{/if}
		{#if unassign.error}<Message kind="danger">{unassign.error}</Message>{/if}
	{:else if wb.canEdit}
		<p class="dim small">{b.seatHint}</p>
		{#if seats.length}
			<form
				class="row"
				method="POST"
				action="?/assign"
				use:enhance={() =>
					({ update }) =>
						update({ reset: false })}
			>
				<input type="hidden" name="op" value="assign" />
				<Select label={b.pickSeat} name="campaignId" options={seats} />
				<Button type="submit">{b.assign}</Button>
				{#if assign.fields.recheck}
					<Button type="submit" name="recheck" value="true">{b.recheck}</Button>
				{/if}
			</form>
			{#if assign.error}<Message kind="danger">{assign.error}</Message>{/if}
		{:else}
			<p class="dim">{b.noSeats}</p>
		{/if}
	{:else}
		<p class="dim">{m.warbands.notSeated}</p>
	{/if}
</section>

<style>
	.seat {
		display: grid;
		gap: var(--space-2);
	}
	.sub {
		margin: var(--space-2) 0 0;
		padding-bottom: 2px;
		border-bottom: var(--border-hairline) solid var(--blood);
		color: var(--bone-dim);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	p {
		margin: 0;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: end;
	}
	.small {
		font-size: var(--size-label);
	}
</style>

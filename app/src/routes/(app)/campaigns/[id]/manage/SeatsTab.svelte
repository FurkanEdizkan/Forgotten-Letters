<!--
  The Seats tab: the "Campaign created" message after the wizard, one "Fill a seat by name" control, "Make links
  for empty seats" and "Withdraw all links" (confirm in place), the seat cards with the
  picked seat's details, and Add seats under them.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Plus from '@lucide/svelte/icons/plus';
	import Link from '@lucide/svelte/icons/link';
	import { m } from '#lib/messages';
	import { joinOpen, type Stage } from '#lib/campaign-stage';
	import { SEATS_MAX } from '#lib/schemas/campaigns';
	import type { ApiSeat } from '#lib/api-types';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import PersonPicker from '#lib/ui/PersonPicker.svelte';
	import SeatCards from '#lib/ui/SeatCards.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Select from '#lib/ui/Select.svelte';

	type Candidate = { id: string; displayName: string; username: string };
	type Props = {
		seats: ApiSeat[];
		stage: Stage;
		created: boolean;
		find: string;
		candidates: Candidate[];
		form: FormResult;
	};
	let { seats, stage, created, find, candidates, form }: Props = $props();
	const s = m.campaigns.manage.seats;

	// Lowest seat first, so the pickers preselect it.
	const empty = $derived(seats.filter((x) => !x.player).sort((a, b) => a.number - b.number));
	const seatOptions = $derived(empty.map((x) => ({ value: x.id, label: x.name })));
	const allLinks = $derived(resultOf(form, 'links'));

	const revokeAll = $derived(resultOf(form, 'revokeAll'));
	const assign = $derived(resultOf(form, 'assign'));
	const add = $derived(resultOf(form, 'addSeats'));
	const editable = $derived(stage !== 'ended');
	const anyOpenLink = $derived(seats.some((x) => !x.player && x.link));
</script>

{#if created && !form}<Message>{m.campaigns.manage.created}</Message>{/if}

{#if joinOpen(stage, 'by_name')}
	{#if empty.length}
		<PersonPicker
			label={s.findLabel}
			placeholder={s.findPlaceholder}
			findLabel={s.find}
			param="find"
			tab="seats"
			query={find}
			people={candidates}
			peopleLabel={s.people}
			noMatch={s.noMatch}
			action="?/assign"
			op="assign"
			submit={s.assign}
			error={assign.error}
		>
			{#snippet extra()}
				<Select label={s.seat} name="seatId" options={seatOptions} />
			{/snippet}
		</PersonPicker>
		{#if assign.done}<Message>{s.assigned}</Message>{/if}
	{:else}
		<p class="dim">{s.noEmpty}</p>
	{/if}
{/if}

{#if editable}
	<div class="linkbar">
		{#if joinOpen(stage, 'link') && empty.length}
			<form method="POST" action="?/links" use:enhance>
				<input type="hidden" name="op" value="links" />
				<Button type="submit" icon={Link}>{s.allLinks}</Button>
			</form>
		{/if}
		{#if anyOpenLink}
			<form method="POST" action="?/revokeAll" use:enhance>
				<input type="hidden" name="op" value="revokeAll" />
				<ConfirmButton label={s.revokeAll} confirm={s.revokeAllConfirm} />
			</form>
		{/if}
	</div>
	{#if allLinks.error}<Message kind="danger">{allLinks.error}</Message>{/if}
	{#if revokeAll.error}<Message kind="danger">{revokeAll.error}</Message>{/if}
	{#if revokeAll.done}
		<p class="dim" role="status">{s.withdrawnAll(Number(revokeAll.done.withdrawn ?? 0))}</p>
	{/if}
	{#if !joinOpen(stage, 'link')}<p class="dim">{s.linksClosed}</p>{/if}
{/if}

<SeatCards {seats} {stage} {form} />

{#if editable}
	<form class="add" method="POST" action="?/addSeats" use:enhance>
		<input type="hidden" name="op" value="addSeats" />
		<div class="count">
			<Field
				label={s.addCount}
				name="count"
				type="number"
				inputmode="numeric"
				min={1}
				max={Math.max(1, SEATS_MAX - seats.length)}
				value="1"
				error={add.fields.count}
			/>
		</div>
		<Button type="submit" icon={Plus} disabled={seats.length >= SEATS_MAX}>{s.add}</Button>
		<span class="dim small data">{s.footer(seats.length, SEATS_MAX)}</span>
	</form>
	{#if add.error && !add.fields.count}<Message kind="danger">{add.error}</Message>{/if}
{/if}

<style>
	.linkbar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.add {
		display: flex;
		align-items: end;
		gap: var(--space-3);
	}
	.count {
		width: 8rem;
	}
	.small {
		font-size: var(--size-label);
		padding-bottom: var(--space-2);
	}
</style>

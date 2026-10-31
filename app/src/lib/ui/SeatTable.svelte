<!--
  The manage page's seat table (DESIGN.md §7, Seat table): Seat, Player, Joined, Actions. A filled seat offers
  "Free seat" (confirm in place); an open seat offers "Make link" and Remove. A new link shows once, in the secret
  box under its row. The pencil renames a seat in place. Posts to the page's rename, free, removeSeat, link and
  revoke actions, each with its op and seat id so a message lands in the right row.
-->
<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Link from '@lucide/svelte/icons/link';
	import { m } from '#lib/messages';
	import { joinOpen, type Stage } from '#lib/campaign-stage';
	import { SEATS_MIN } from '#lib/schemas/campaigns';
	import type { ApiSeat, ApiSeatLink } from '#lib/api-types';
	import { day } from './campaign-facts';
	import { resultOf, type FormResult } from './form-result';
	import { absoluteLink } from './links';
	import Button from './Button.svelte';
	import ConfirmButton from './ConfirmButton.svelte';
	import Field from './Field.svelte';
	import Message from './Message.svelte';
	import SecretBox from './SecretBox.svelte';

	type Props = { seats: ApiSeat[]; stage: Stage; form: FormResult };
	let { seats, stage, form }: Props = $props();
	const s = m.campaigns.manage.seats;

	const editable = $derived(stage !== 'ended');
	const links = $derived(joinOpen(stage, 'link'));
	let renaming = $state<string | null>(null);

	/** The link just made for this seat, by itself or with all the others. */
	const freshLink = (id: string): ApiSeatLink | null => {
		const one = resultOf(form, 'link', id).done?.link as ApiSeatLink | undefined;
		return one ?? null;
	};
	const errorFor = (id: string) =>
		['rename', 'free', 'removeSeat', 'link', 'revoke']
			.map((op) => resultOf(form, op, id).error)
			.find(Boolean) ?? null;
	// The rename field stays open on a failure, so its reason shows under it.
	const renamed: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') renaming = null;
		};
	// A campaign keeps at least two seats.
	const removable = $derived(seats.length > SEATS_MIN);
</script>

<table class="table">
	<thead>
		<tr>
			<th scope="col" class="num">{s.number}</th>
			<th scope="col">{s.name}</th>
			<th scope="col">{s.player}</th>
			<th scope="col">{s.joined}</th>
			<th scope="col"><span class="visually-hidden">{s.actions}</span></th>
		</tr>
	</thead>
	<tbody>
		{#each seats as seat (seat.id)}
			{@const link = freshLink(seat.id)}
			{@const error = errorFor(seat.id)}
			<tr>
				<td class="num">{seat.number}</td>
				<td>
					{#if renaming === seat.id}
						<form class="inline" method="POST" action="?/rename" use:enhance={renamed}>
							<input type="hidden" name="op" value="rename" />
							<input type="hidden" name="id" value={seat.id} />
							<input type="hidden" name="version" value={seat.version} />
							<Field
								label={s.newName(seat.name)}
								name="name"
								value={seat.name}
								maxlength={40}
								required
								error={resultOf(form, 'rename', seat.id).fields.name}
							/>
							<Button type="submit">{s.renameSave}</Button>
							<Button onclick={() => (renaming = null)}>{s.renameCancel}</Button>
						</form>
					{:else}
						<span class="seat">
							{seat.name}
							{#if editable}
								<button
									type="button"
									class="icon"
									aria-label={s.rename(seat.name)}
									title={s.rename(seat.name)}
									onclick={() => (renaming = seat.id)}
									><Pencil size={15} strokeWidth={1.5} aria-hidden={true} /></button
								>
							{/if}
						</span>
					{/if}
				</td>
				<td>
					{#if seat.player}{seat.player.displayName}
					{:else}<span class="dim"
							>{s.openSeat}{#if seat.hasOpenLink && !link}
								· {s.linkOut}{/if}</span
						>{/if}
				</td>
				<td class="dim">{seat.joinedAt ? day(seat.joinedAt) : s.notYet}</td>
				<td>
					{#if editable}
						<div class="actions">
							{#if seat.player}
								<form method="POST" action="?/free" use:enhance>
									<input type="hidden" name="op" value="free" />
									<input type="hidden" name="id" value={seat.id} />
									<input type="hidden" name="version" value={seat.version} />
									<ConfirmButton label={s.free} confirm={s.freeConfirm} />
								</form>
							{:else}
								{#if links}
									<form method="POST" action="?/link" use:enhance>
										<input type="hidden" name="op" value="link" />
										<input type="hidden" name="id" value={seat.id} />
										<Button type="submit" icon={Link}
											>{seat.hasOpenLink || link ? s.newLink : s.makeLink}</Button
										>
									</form>
								{/if}
								{#if seat.hasOpenLink || link}
									<form method="POST" action="?/revoke" use:enhance>
										<input type="hidden" name="op" value="revoke" />
										<input type="hidden" name="id" value={seat.id} />
										<Button type="submit">{s.revoke}</Button>
									</form>
								{:else if removable}
									<form method="POST" action="?/removeSeat" use:enhance>
										<input type="hidden" name="op" value="removeSeat" />
										<input type="hidden" name="id" value={seat.id} />
										<ConfirmButton label={s.remove} confirm={s.removeConfirm} />
									</form>
								{/if}
							{/if}
						</div>
					{/if}
				</td>
			</tr>
			{#if link || error}
				<tr class="sub">
					<td></td>
					<td colspan="4">
						{#if error}<Message kind="danger">{error}</Message>{/if}
						{#if link}
							<SecretBox
								label={s.linkFor(link.seatName)}
								value={absoluteLink(link.url)}
								help={s.linkHelp(day(link.expiresAt))}
							/>
						{/if}
					</td>
				</tr>
			{/if}
		{/each}
	</tbody>
</table>

<style>
	.seat {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.icon {
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: var(--border-hairline) solid transparent;
		background: transparent;
		color: var(--bone-dim);
		cursor: pointer;
	}
	.icon:hover {
		color: var(--bone);
		border-color: var(--rule-strong);
	}
	.inline {
		display: flex;
		align-items: end;
		gap: var(--space-2);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
		justify-content: flex-end;
	}
	.actions form {
		display: contents;
	}
	tr.sub td {
		height: auto;
		padding-top: 0;
	}
	tr.sub:hover {
		background: transparent;
	}
	tr.sub td > :global(* + *) {
		margin-top: var(--space-2);
	}
</style>

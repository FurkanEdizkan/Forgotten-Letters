<!--
  The Requests tab: open requests to join, each with the person (display name and username), when they asked, their
  note, and Approve into an empty seat (the lowest one picked) or Decline.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import type { ApiJoinRequest, ApiSeat } from '#lib/api-types';
	import { day } from '#lib/ui/campaign-facts';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Select from '#lib/ui/Select.svelte';

	type Props = { requests: ApiJoinRequest[]; seats: ApiSeat[]; form: FormResult };
	let { requests, seats, form }: Props = $props();
	const r = m.campaigns.manage.requests;

	const seatOptions = $derived(
		seats
			.filter((x) => !x.player)
			.sort((a, b) => a.number - b.number)
			.map((x) => ({ value: x.id, label: x.name }))
	);
	const errorFor = (id: string) =>
		resultOf(form, 'approve', id).error ?? resultOf(form, 'decline', id).error;
</script>

{#if requests.length}
	{#if !seatOptions.length}<p class="dim">{r.noSeat}</p>{/if}
	<ul class="list">
		{#each requests as q (q.id)}
			{@const error = errorFor(q.id)}
			<li>
				<div class="who">
					<p>
						<b>{q.person.displayName}</b>
						<code class="dim">{q.person.username}</code>
						<span class="dim small">· {r.asked(day(q.createdAt))}</span>
					</p>
					{#if q.note}<p class="dim">{q.note}</p>{/if}
					{#if error}<Message kind="danger">{error}</Message>{/if}
				</div>
				<div class="act">
					{#if seatOptions.length}
						<form method="POST" action="?/approve" use:enhance>
							<input type="hidden" name="op" value="approve" />
							<input type="hidden" name="id" value={q.id} />
							<Select label={r.seat} name="seatId" options={seatOptions} />
							<Button type="submit">{r.approve}</Button>
						</form>
					{/if}
					<form method="POST" action="?/decline" use:enhance>
						<input type="hidden" name="op" value="decline" />
						<input type="hidden" name="id" value={q.id} />
						<Button type="submit">{r.decline}</Button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{:else}
	<EmptyState text={r.empty} />
{/if}

<style>
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: var(--border-opening) solid var(--rule-strong);
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-5);
		align-items: end;
		padding: var(--space-3) 0;
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	.who {
		display: grid;
		gap: var(--space-1);
	}
	.act,
	.act form {
		display: flex;
		align-items: end;
		gap: var(--space-2);
	}
	.small {
		font-size: var(--size-label);
	}
</style>

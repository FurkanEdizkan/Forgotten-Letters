<!--
  One seat's details beside the seat cards: rename in place, the player or the link, and the seat's actions.
  Copy link fetches the stored link and copies it; the page only ever shows its last four characters. Posts to the
  manage page's rename, free, removeSeat, link and revoke actions with the seat id, so messages land here.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { enhance, type SubmitFunction } from '#lib/ui/enhance';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Link from '@lucide/svelte/icons/link';
	import Copy from '@lucide/svelte/icons/copy';
	import { m } from '#lib/messages';
	import type { ApiSeat, ApiSeatLink } from '#lib/api-types';
	import { day } from './campaign-facts';
	import { copyText } from './copy';
	import { resultOf, type FormResult } from './form-result';
	import { absoluteLink } from './links';
	import Button from './Button.svelte';
	import ConfirmButton from './ConfirmButton.svelte';
	import Field from './Field.svelte';
	import Message from './Message.svelte';

	type Props = {
		seat: ApiSeat;
		form: FormResult;
		editable: boolean;
		/** Links can be made (mustering). */
		links: boolean;
		removable: boolean;
	};
	let { seat, form, editable, links, removable }: Props = $props();
	const s = m.campaigns.manage.seats;

	let renaming = $state(false);
	let copied = $state(false);
	let byHand = $state<string | null>(null);
	let copyError = $state<string | null>(null);

	const fresh = $derived(resultOf(form, 'link', seat.id).done?.link as ApiSeatLink | undefined);
	const error = $derived(
		['rename', 'free', 'removeSeat', 'link', 'revoke']
			.map((op) => resultOf(form, op, seat.id).error)
			.find(Boolean) ?? null
	);
	const link = $derived(seat.link);

	// Switching seats clears the last copy's note.
	$effect(() => {
		void seat.id;
		copied = false;
		byHand = null;
		copyError = null;
	});

	async function copy() {
		copied = false;
		byHand = null;
		copyError = null;
		let url = fresh?.url;
		if (!url) {
			const res = await fetch(`/api/v1/campaigns/${page.params.id}/seats/${seat.id}/invite`);
			const body = await res.json();
			if (!res.ok) {
				copyError = body?.message ?? s.linkOld;
				return;
			}
			url = body.url as string;
		}
		const text = absoluteLink(url);
		if (await copyText(text)) copied = true;
		else byHand = text;
	}

	const renamed: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') renaming = false;
		};
</script>

<aside class="panel" aria-label={seat.name}>
	{#if renaming}
		<form class="rename" method="POST" action="?/rename" use:enhance={renamed}>
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
			<div class="row">
				<Button type="submit">{s.renameSave}</Button>
				<Button onclick={() => (renaming = false)}>{s.renameCancel}</Button>
			</div>
		</form>
	{:else}
		<h3>
			<span class="num data">#{seat.number}</span>
			{seat.name}
			{#if editable}
				<button
					type="button"
					class="icon"
					aria-label={s.rename(seat.name)}
					title={s.rename(seat.name)}
					onclick={() => (renaming = true)}
					><Pencil size={15} strokeWidth={1.5} aria-hidden={true} /></button
				>
			{/if}
		</h3>
	{/if}

	<dl>
		<dt>{s.player}</dt>
		<dd class:dim={!seat.player}>{seat.player?.displayName ?? s.openSeat}</dd>
		{#if seat.player}
			<dt>{s.joined}</dt>
			<dd>{seat.joinedAt ? day(seat.joinedAt) : s.notYet}</dd>
		{:else}
			<dt>{s.link}</dt>
			<dd class:dim={!link && !fresh}>
				{#if fresh || link?.state === 'ready'}{s.linkLasts}
				{:else if link?.state === 'old'}{s.linkOld}
				{:else}{s.linkNone}{/if}
			</dd>
			{#if link}
				<dt>{s.linkMade}</dt>
				<dd>{day(link.createdAt)}</dd>
				<dt>{s.linkOpened}</dt>
				<dd class:dim={!link.openedAt}>{link.openedAt ? day(link.openedAt) : s.notYet}</dd>
			{/if}
		{/if}
	</dl>

	{#if error}<Message kind="danger">{error}</Message>{/if}
	{#if fresh}<Message>{s.linkMadeNow}</Message>{/if}

	{#if !seat.player && (fresh || link?.state === 'ready')}
		<div class="linkbox">
			<span class="data"
				>{s.linkMasked((fresh ? fresh.url : '').slice(-4) || link?.tail || '')}</span
			>
			<Button kind="primary" icon={Copy} onclick={copy}>{s.copyLink}</Button>
		</div>
		{#if copied}<p class="ok" role="status">{s.copied}</p>{/if}
		{#if copyError}<Message kind="danger">{copyError}</Message>{/if}
		{#if byHand}
			<p class="dim">{s.copyByHand}</p>
			<input
				class="byhand data"
				readonly
				value={byHand}
				onfocus={(e) => e.currentTarget.select()}
			/>
		{/if}
	{/if}

	{#if editable}
		<div class="row">
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
						<Button type="submit" icon={Link}>{link || fresh ? s.newLink : s.makeLink}</Button>
					</form>
				{/if}
				{#if link || fresh}
					<form method="POST" action="?/revoke" use:enhance>
						<input type="hidden" name="op" value="revoke" />
						<input type="hidden" name="id" value={seat.id} />
						<Button type="submit">{s.revoke}</Button>
					</form>
				{/if}
				{#if removable && !link && !fresh}
					<form method="POST" action="?/removeSeat" use:enhance>
						<input type="hidden" name="op" value="removeSeat" />
						<input type="hidden" name="id" value={seat.id} />
						<ConfirmButton label={s.remove} confirm={s.removeConfirm} />
					</form>
				{/if}
			{/if}
		</div>
	{/if}
</aside>

<style>
	.panel {
		position: sticky;
		top: var(--space-4);
		display: grid;
		align-content: start;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--panel-raised);
		border: var(--border-hairline) solid var(--rule-strong);
	}
	h3 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
	}
	.num {
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
	.icon {
		display: grid;
		place-items: center;
		width: 1.8em;
		height: 1.8em;
		border: 0;
		background: transparent;
		color: var(--bone-dim);
		cursor: pointer;
	}
	.icon:hover {
		color: var(--bone);
	}
	.icon:focus-visible {
		outline: var(--border-focus) solid var(--blood-bright);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-4);
		margin: 0;
	}
	dt {
		color: var(--bone-faint);
	}
	dd {
		margin: 0;
	}
	.linkbox {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.rename {
		display: grid;
		gap: var(--space-2);
	}
	.ok {
		margin: 0;
		color: var(--ok);
		font-size: var(--size-label);
	}
	.byhand {
		width: 100%;
		padding: var(--space-2);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		color: var(--bone);
	}
</style>

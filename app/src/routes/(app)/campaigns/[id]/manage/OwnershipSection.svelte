<!--
  Campaign ownership, the last part of Settings (decision 81), for this campaign's CM and the site Owner only.
  Transfer CM hands the role to a co-CM (a site Owner who is not the CM may also take it: "Me" comes first) and posts
  to ?/transfer; Delete campaign posts to ?/remove. Both confirm in place. It shows on ended campaigns too.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { m } from '#lib/messages';
	import type { ApiCampaign } from '#lib/api-types';
	import type { Role } from '#lib/roles';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Select from '#lib/ui/Select.svelte';

	type Props = {
		campaign: ApiCampaign;
		me: { id: string; displayName: string; role: Role };
		form: FormResult;
	};
	let { campaign, me, form }: Props = $props();
	const o = m.campaigns.manage.ownership;

	// The site Owner takes the role themselves, or hands it on; the CM hands it to a co-CM.
	const ownerTakes = $derived(me.role === 'owner' && campaign.myRole !== 'cm');
	const options = $derived([
		...(ownerTakes ? [{ value: me.id, label: o.me(me.displayName) }] : []),
		...campaign.members
			.filter((x) => x.role === 'co_cm' && x.userId !== me.id)
			.map((x) => ({ value: x.userId, label: x.displayName }))
	]);
	const transferred = $derived(resultOf(form, 'transfer'));
	const removed = $derived(resultOf(form, 'remove'));
</script>

<section class="ownership" aria-labelledby="ownership-heading">
	<h3 id="ownership-heading">{o.heading}</h3>
	<p class="dim">{o.hint}</p>
	<div class="parts">
		<div class="part">
			<h4>{o.transferHeading}</h4>
			<p class="dim">{ownerTakes ? o.transferHintOwner : o.transferHint}</p>
			{#if options.length}
				<form class="row" method="POST" action="?/transfer" use:enhance>
					<input type="hidden" name="op" value="transfer" />
					<Select label={o.newCm} name="id" {options} />
					<ConfirmButton label={o.transfer} confirm={o.transferConfirm} />
				</form>
			{:else}
				<p class="dim">{o.noCoCms}</p>
				<div><Button disabled icon={TriangleAlert}>{o.transfer}</Button></div>
			{/if}
			{#if transferred.error}<Message kind="danger">{transferred.error}</Message>{/if}
		</div>
		<div class="part">
			<h4>{o.deleteHeading}</h4>
			<p class="dim">{o.deleteText}</p>
			<form method="POST" action="?/remove" use:enhance>
				<input type="hidden" name="op" value="remove" />
				<ConfirmButton label={o.delete} confirm={o.deleteConfirm} />
			</form>
			{#if removed.error}<Message kind="danger">{removed.error}</Message>{/if}
		</div>
	</div>
</section>

<style>
	.ownership {
		display: grid;
		gap: var(--space-3);
		max-width: 52rem;
		margin-top: var(--space-6);
	}
	.parts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.part {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		padding: var(--space-4);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.part > * {
		margin: 0;
	}
	h4 {
		margin: 0;
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.row {
		display: flex;
		align-items: end;
		gap: var(--space-3);
	}
	.row :global(.field) {
		flex: 1;
	}
</style>

<!--
  /campaigns: your campaigns and the listed ones you are not in, as cards. Owners and Admins get "New campaign";
  the CM and Owners get "Deleted", a second view of this page (?view=deleted) with Restore. "Ask to join" opens a
  short optional note in the card, then turns into a disabled "Request sent".
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { m } from '#lib/messages';
	import { canInCampaign, canRunCampaigns } from '#lib/campaign-rights';
	import { day } from '#lib/ui/campaign-facts';
	import CampaignCard from '#lib/ui/CampaignCard.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import { resultOf } from '#lib/ui/form-result';
	import type { ApiCampaignCard } from '#lib/api-types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const c = m.campaigns;

	const role = $derived(data.me.role);
	const runner = $derived(canRunCampaigns(role));
	const showDeleted = $derived(data.deleted.length > 0 || role === 'owner');
	let asking = $state<string | null>(null);

	// One `form` for every card: the op and the campaign id say which card a result belongs to.
	// The server's answer wins after a withdraw; until then the request just sent counts.
	const sent = (card: ApiCampaignCard) =>
		!resultOf(form, 'withdraw', card.id).done &&
		(card.myOpenRequest || !!resultOf(form, 'ask', card.id).done);
</script>

<svelte:head
	><title>{data.view === 'deleted' ? c.deletedTitle : c.title} · {m.app.name}</title></svelte:head
>

{#if data.view === 'deleted'}
	<div class="head">
		<h1>{c.deletedTitle}</h1>
		<Button href="/campaigns">{c.backToList}</Button>
	</div>
	<p class="dim">{c.deletedIntro}</p>
	{#if resultOf(form, 'restore').done}<Message>{c.restored}</Message>{/if}
	{#if data.deleted.length}
		<div class="cards">
			{#each data.deleted as card (card.id)}
				<CampaignCard
					{card}
					facts={[c.deletedOn(card.deletedAt ? day(card.deletedAt) : ''), c.cmIs(card.cmName)]}
				>
					{#snippet actions()}
						{#if canInCampaign(card.myRole, role, 'restore')}
							<form method="POST" action="?/restore" use:enhance>
								<input type="hidden" name="op" value="restore" />
								<input type="hidden" name="id" value={card.id} />
								<Button type="submit">{c.restore}</Button>
							</form>
						{/if}
						{@const error = resultOf(form, 'restore', card.id).error}
						{#if error}<Message kind="danger">{error}</Message>{/if}
					{/snippet}
				</CampaignCard>
			{/each}
		</div>
	{:else}
		<EmptyState text={c.deletedEmpty} />
	{/if}
{:else}
	<div class="head">
		<h1>{c.title}</h1>
		<div class="tools">
			{#if runner && showDeleted}
				<Button href="/campaigns?view=deleted" icon={Trash}>{c.deleted(data.deleted.length)}</Button
				>
			{/if}
			{#if runner}<Button kind="primary" href="/campaigns/new" icon={Plus}>{c.newCampaign}</Button
				>{/if}
		</div>
	</div>

	{#if !data.mine.length && !data.listed.length}
		<EmptyState text={runner ? c.emptyRunner : c.emptyPlayer}>
			{#if runner}<Button kind="primary" href="/campaigns/new" icon={Plus}>{c.newCampaign}</Button
				>{/if}
			<a href="/help/docs">{c.howTo}</a>
		</EmptyState>
	{/if}

	{#if data.mine.length}
		<section>
			<h2>{c.yours} <span class="count data">{data.mine.length}</span></h2>
			<div class="cards">
				{#each data.mine as card (card.id)}
					<CampaignCard {card} href="/campaigns/{card.id}" />
				{/each}
			</div>
		</section>
	{/if}

	{#if data.listed.length}
		<section>
			<h2>{c.listed} <span class="count">{c.listedHint}</span></h2>
			<div class="cards">
				{#each data.listed as card (card.id)}
					<CampaignCard {card} href="/campaigns/{card.id}">
						{#snippet actions()}
							{#if sent(card)}
								<Button disabled>{c.requestSent}</Button>
								<form method="POST" action="?/withdraw" use:enhance>
									<input type="hidden" name="op" value="withdraw" />
									<input type="hidden" name="id" value={card.id} />
									<Button type="submit">{c.withdraw}</Button>
								</form>
								<span class="dim small">{c.requestWaiting}</span>
							{:else if card.stage === 'mustering'}
								{#if asking === card.id}
									<form
										class="ask"
										method="POST"
										action="?/ask"
										use:enhance={() =>
											({ update }) =>
												update({ reset: false })}
									>
										<input type="hidden" name="op" value="ask" />
										<input type="hidden" name="id" value={card.id} />
										<Field
											label={c.askNote}
											name="note"
											maxlength={300}
											error={resultOf(form, 'ask', card.id).fields.note}
										/>
										<p class="dim small">{c.askNoteHint}</p>
										<div class="row">
											<Button kind="primary" type="submit">{c.askSend}</Button>
											<Button onclick={() => (asking = null)}>{c.askCancel}</Button>
										</div>
									</form>
								{:else}
									<Button onclick={() => (asking = card.id)}>{c.ask}</Button>
								{/if}
							{/if}
							{@const error =
								resultOf(form, 'ask', card.id).error ?? resultOf(form, 'withdraw', card.id).error}
							{#if error}<Message kind="danger">{error}</Message>{/if}
						{/snippet}
					</CampaignCard>
				{/each}
			</div>
		</section>
	{/if}
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.tools,
	.row {
		display: flex;
		gap: var(--space-2);
	}
	section {
		display: grid;
		gap: var(--space-4);
	}
	.count {
		font-family: var(--font-body);
		font-size: var(--size-label);
		color: var(--bone-dim);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: var(--space-4);
	}
	.ask {
		display: grid;
		gap: var(--space-2);
		width: 100%;
	}
	.small {
		font-size: var(--size-label);
	}
</style>

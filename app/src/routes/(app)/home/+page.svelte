<!--
  /home: your campaigns as cards (from the (app) layout's data, the same list as the side panel), then the link to
  your account.
-->
<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/messages';
	import { canRunCampaigns } from '#lib/campaign-rights';
	import { PANEL_CAMPAIGNS } from '#lib/ui/shell/nav';
	import CampaignCard from '#lib/ui/CampaignCard.svelte';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const runner = $derived(canRunCampaigns(data.me.role));
	const shown = $derived(data.campaigns.slice(0, PANEL_CAMPAIGNS));
</script>

<svelte:head><title>{m.home.title} · {m.app.name}</title></svelte:head>

<h1>{m.home.title}</h1>
<section>
	<h2>{m.home.heading}</h2>
	{#if shown.length}
		<div class="cards">
			{#each shown as card (card.id)}
				<CampaignCard {card} href="/campaigns/{card.id}" />
			{/each}
		</div>
		<p><a href="/campaigns">{m.campaigns.allCampaigns}</a></p>
	{:else}
		<EmptyState text={runner ? m.campaigns.emptyRunner : m.campaigns.emptyPlayer}>
			{#if runner}
				<Button kind="primary" href="/campaigns/new" icon={Plus}>{m.campaigns.newCampaign}</Button>
			{/if}
			<a href="/campaigns">{m.campaigns.allCampaigns}</a>
		</EmptyState>
	{/if}
</section>
<section>
	<p class="dim">
		{m.home.signedInAs(data.me.displayName)} <a href="/account">{m.home.account}</a>
	</p>
	<p class="dim">{m.home.later}</p>
</section>

<style>
	section {
		display: grid;
		gap: var(--space-4);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: var(--space-4);
	}
</style>

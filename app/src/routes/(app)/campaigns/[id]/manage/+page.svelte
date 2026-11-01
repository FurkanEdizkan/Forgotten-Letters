<!--
  /campaigns/[id]/manage: the CM's console. The title row carries the stage moves (Start, Back to mustering, End,
  confirm in place); the tabs hold Seats, Requests, Co-CMs, Settings and, for the CM only, Danger. Co-CMs see the
  same page without the co-CM actions and Danger. Every form posts to its own action with an op, so its message
  lands next to it. The tab comes from ?tab= (searches return to their tab) and stays across form posts.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Eye from '@lucide/svelte/icons/eye';
	import { m } from '#lib/messages';
	import { canInCampaign, type CampaignAction } from '#lib/campaign-rights';
	import { resultOf } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import CampaignRoleBadge from '#lib/ui/CampaignRoleBadge.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Message from '#lib/ui/Message.svelte';
	import StageBadge from '#lib/ui/StageBadge.svelte';
	import Tabs from '#lib/ui/Tabs.svelte';
	import SeatsTab from './SeatsTab.svelte';
	import RequestsTab from './RequestsTab.svelte';
	import CoCmsTab from './CoCmsTab.svelte';
	import SettingsTab from './SettingsTab.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const mg = m.campaigns.manage;

	const camp = $derived(data.campaign);
	const can = (a: CampaignAction) => canInCampaign(camp.myRole, data.me.role, a);
	const tabs = $derived([
		{ id: 'seats', label: mg.seats.tab, count: data.seats.length },
		{ id: 'requests', label: mg.requests.tab, count: data.requests.length },
		{
			id: 'cocms',
			label: mg.cocms.tab,
			count: camp.members.filter((x) => x.role === 'co_cm').length
		},
		{ id: 'settings', label: mg.settings.tab },
		...(can('delete') ? [{ id: 'danger', label: mg.danger.tab }] : [])
	]);
	// The first tab comes from the address; afterwards it is the person's choice.
	const startTab = () => data.tab;
	let tab = $state(startTab());
	$effect(() => {
		if (!tabs.some((t) => t.id === tab)) tab = 'seats';
	});
	const stage = $derived(resultOf(form, 'stage'));
	const removed = $derived(resultOf(form, 'remove'));
</script>

<svelte:head><title>{camp.name} · {m.app.name}</title></svelte:head>

<div class="head">
	<div class="title">
		<h1>{camp.name}</h1>
		<StageBadge stage={camp.stage} />
		{#if camp.myRole}<CampaignRoleBadge role={camp.myRole} />{/if}
	</div>
	<div class="moves">
		<Button href="/campaigns/{camp.id}" icon={Eye}>{mg.view}</Button>
		{#if can('stage')}
			{#if camp.stage === 'mustering'}
				<span class="dim small">{mg.endLater}</span>
				<Button disabled>{mg.end}</Button>
				<form method="POST" action="?/stage" use:enhance>
					<input type="hidden" name="op" value="stage" />
					<Button kind="primary" type="submit" name="to" value="active">{mg.start}</Button>
				</form>
			{:else if camp.stage === 'active'}
				<form method="POST" action="?/stage" use:enhance>
					<input type="hidden" name="op" value="stage" />
					<Button type="submit" name="to" value="mustering">{mg.backToMustering}</Button>
					<ConfirmButton label={mg.end} confirm={mg.endConfirm} name="to" value="ended" />
				</form>
			{/if}
		{/if}
	</div>
</div>
{#if camp.stage === 'ended'}<p class="dim">{mg.endedNote}</p>{/if}
{#if stage.error}<Message kind="danger">{stage.error}</Message>{/if}

<Tabs label={mg.tabs} {tabs} bind:value={tab}>
	{#snippet panel(id)}
		{#if id === 'seats'}
			<SeatsTab
				seats={data.seats}
				stage={camp.stage}
				created={data.created}
				find={data.find}
				candidates={data.candidates}
				{form}
			/>
		{:else if id === 'requests'}
			<RequestsTab requests={data.requests} seats={data.seats} {form} />
		{:else if id === 'cocms'}
			<CoCmsTab
				members={camp.members}
				canManage={can('co_cms')}
				canTransfer={can('transfer')}
				readOnly={camp.stage === 'ended'}
				cmFind={data.cmFind}
				candidates={data.coCmCandidates}
				{form}
			/>
		{:else if id === 'settings'}
			<SettingsTab campaign={camp} {form} />
		{:else if id === 'danger'}
			<section class="danger">
				<h3>{mg.danger.heading}</h3>
				<p class="dim">{mg.danger.text}</p>
				{#if removed.error}<Message kind="danger">{removed.error}</Message>{/if}
				<form method="POST" action="?/remove" use:enhance>
					<input type="hidden" name="op" value="remove" />
					<ConfirmButton label={mg.danger.delete} confirm={mg.danger.confirm} />
				</form>
			</section>
		{/if}
	{/snippet}
</Tabs>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.title,
	.moves,
	.moves form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.danger {
		display: grid;
		gap: var(--space-3);
		justify-items: start;
		max-width: 44rem;
	}
	.small {
		font-size: var(--size-label);
	}
</style>

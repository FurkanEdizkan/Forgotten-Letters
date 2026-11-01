<!--
  /warbands/[id]: the builder, in two columns like Trench Companion's (our look). Left: the name and the summary
  cards (Warband, Arsenal, Campaign), then the fighter lists (Elites, Troops, Mercenaries, Special, each with +, then
  Dead and departed). Right: the panel for what is selected (?sel=<fighter>|arsenal|campaign, else the Warband
  panel). Add fighter, the equip picker, buying into the Arsenal and Export open dialogs from the query. The campaign
  master of the campaign it sits in sees it read-only (and may change the Patron once it has played).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Download from '@lucide/svelte/icons/download';
	import { m } from '#lib/messages';
	import { setRulesView } from '#lib/ui/rules/context';
	import Button from '#lib/ui/Button.svelte';
	import CardDialog from '#lib/ui/cards/CardDialog.svelte';
	import Message from '#lib/ui/Message.svelte';
	import { isActive } from '#lib/warbands/types';
	import CampaignPanel from '#lib/ui/warbands/CampaignPanel.svelte';
	import Dialog from '#lib/ui/warbands/Dialog.svelte';
	import EquipDialog from '#lib/ui/warbands/EquipDialog.svelte';
	import FighterCard from '#lib/ui/warbands/FighterCard.svelte';
	import LineList from '#lib/ui/warbands/LineList.svelte';
	import RecruitDialog from '#lib/ui/warbands/RecruitDialog.svelte';
	import RosterList from '#lib/ui/warbands/RosterList.svelte';
	import StashPanel from '#lib/ui/warbands/StashPanel.svelte';
	import WarbandPanel from '#lib/ui/warbands/WarbandPanel.svelte';
	import WarbandSummary from '#lib/ui/warbands/WarbandSummary.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const w = m.warbands;
	const b = w.builder;

	setRulesView({
		get set() {
			return data.set;
		},
		get names() {
			return data.names;
		},
		get keywords() {
			return data.keywords;
		}
	});

	const wb = $derived(data.warband);
	const beyond = $derived(wb.seat ? wb.seat.allowBeyondLimits : wb.ignoreLimits);
	const chosen = $derived(wb.fighters.find((x) => x.id === data.sel) ?? null);
	// The card dialog is drawn in the browser from the warband already loaded, so it needs nothing from the server.
	const carded = $derived(
		wb.fighters.find((x) => x.id === page.url.searchParams.get('card')) ?? null
	);
	const holders = $derived([
		{ id: 'arsenal', label: b.arsenal },
		...wb.fighters
			.filter((x) => isActive(x))
			.map((x) => ({ id: x.id, label: x.name ?? x.unitName }))
	]);
	const api = $derived(`/api/v1/warbands/${wb.id}/export`);
	/** Close a dialog: keep only the selection in the address, staying where the page is. */
	const close = () =>
		goto(`${page.url.pathname}?sel=${encodeURIComponent(data.sel)}`, {
			replace: true,
			reset: false
		});
</script>

<svelte:head><title>{wb.name} · {w.title} · {m.app.name}</title></svelte:head>

<header class="head">
	<h1>{wb.name}</h1>
	<p class="dim">
		{[wb.variantName ?? wb.dedicationName, wb.factionName].filter(Boolean).join(' · ')} · {w.rulesOf(
			wb.rulesSet,
			wb.rulesExpansions
		)}
	</p>
</header>

{#if !wb.canEdit}<Message kind="warn">{b.readOnly(wb.ownerName)}</Message>{/if}
{#if beyond}<Message kind="warn">{wb.seat ? b.beyond : b.ignoringLimits}</Message>{/if}

<div class="cols">
	<div class="left">
		<WarbandSummary warband={wb} sel={data.sel} />
		<RosterList warband={wb} sel={data.sel} />
	</div>
	<div class="right">
		{#if chosen}
			<FighterCard
				fighter={chosen}
				unit={data.units[chosen.unitId]}
				upgrades={data.upgrades ?? []}
				{holders}
				tables={data.tables}
				marks={wb.advancementMarks}
				canEdit={wb.canEdit}
				canRefund={wb.canRefund}
				{beyond}
				{form}
			/>
		{:else if data.sel === 'arsenal'}
			<StashPanel warband={wb} {holders} {form} />
		{:else if data.sel === 'campaign'}
			<CampaignPanel warband={wb} patrons={data.patrons} seats={data.seats} {form} />
		{:else}
			<WarbandPanel warband={wb} {beyond} {form} />
		{/if}
	</div>
</div>

{#if carded}
	<CardDialog warband={wb} fighter={carded} onclose={close} />
{/if}
{#if data.recruits}
	<RecruitDialog units={data.recruits} group={data.addGroup} {beyond} {form} onclose={close} />
{/if}
{#if data.equip}
	<EquipDialog
		fighter={data.equip.fighter}
		armoury={data.equip.armoury}
		category={data.equipCategory}
		items={data.items}
		{beyond}
		{form}
		onclose={close}
	/>
{/if}
{#if data.stashLines}
	<Dialog title={b.stashTitle} onclose={close}>
		<div class="scroll">
			<LineList
				lines={data.stashCategory
					? data.stashLines.filter((l) => l.category === data.stashCategory)
					: data.stashLines}
				items={data.items}
				op="stashBuy"
				{beyond}
				{form}
			/>
		</div>
	</Dialog>
{/if}
{#if data.exportText !== null}
	<Dialog title={b.exportTitle} onclose={close}>
		<p class="dim">{b.exportHint}</p>
		<pre class="export" data-export>{data.exportText}</pre>
		<div class="row">
			<Button href="{api}?format=text" download icon={Download}>{b.downloadText}</Button>
			<Button href="{api}?format=json" download icon={Download}>{b.downloadJson}</Button>
		</div>
	</Dialog>
{/if}

<style>
	.head {
		display: grid;
		gap: var(--space-1);
	}
	.head h1,
	.head p {
		margin: 0;
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		gap: var(--space-5);
		align-items: start;
	}
	.left {
		display: grid;
		gap: var(--space-2);
		align-content: start;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.scroll {
		max-height: 60vh;
		overflow-y: auto;
	}
	.export {
		margin: 0;
		max-height: 50vh;
		overflow: auto;
		padding: var(--space-3);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule);
		font-family: var(--font-mono);
		font-size: var(--size-mono);
		white-space: pre-wrap;
	}
</style>

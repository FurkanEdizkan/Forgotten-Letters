<!--
  /warbands/[id]: the builder. The header gives the name, faction and rules, the rating against the ducat limit,
  the Patron and the banks, with Export and the campaign seat. The live problem list follows (green "No problems"
  when legal), then the fighters in their groups (Elites, Troops, Mercenaries, Special, Dead), and beside them the
  stash, fireteams and locations. Add fighter, Equip, Buy into stash and Export open dialogs from the query. The
  campaign master of the campaign it sits in sees it read-only.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { enhance } from '#lib/ui/enhance';
	import Download from '@lucide/svelte/icons/download';
	import Plus from '@lucide/svelte/icons/plus';
	import { m } from '#lib/messages';
	import { GROUPS } from '#lib/warbands/types';
	import { resultOf } from '#lib/ui/form-result';
	import { setRulesView } from '#lib/ui/rules/context';
	import BandHeader from '#lib/ui/BandHeader.svelte';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import Dialog from '#lib/ui/warbands/Dialog.svelte';
	import EquipDialog from '#lib/ui/warbands/EquipDialog.svelte';
	import FighterCard from '#lib/ui/warbands/FighterCard.svelte';
	import FireteamsPanel from '#lib/ui/warbands/FireteamsPanel.svelte';
	import LineList from '#lib/ui/warbands/LineList.svelte';
	import LocationsPanel from '#lib/ui/warbands/LocationsPanel.svelte';
	import ProblemList from '#lib/ui/warbands/ProblemList.svelte';
	import RecruitDialog from '#lib/ui/warbands/RecruitDialog.svelte';
	import StashPanel from '#lib/ui/warbands/StashPanel.svelte';
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
	const beyond = $derived(!!wb.seat?.allowBeyondLimits);
	const groups = $derived(
		GROUPS.map((g) => ({ g, list: wb.fighters.filter((x) => x.group === g) })).filter(
			(x) => x.list.length
		)
	);
	const patch = $derived(resultOf(form, 'patch'));
	const assign = $derived(resultOf(form, 'assign'));
	const unassign = $derived(resultOf(form, 'unassign'));
	const patronOptions = $derived([
		{ value: '', label: b.noPatron },
		...data.patrons.map((p) => ({ value: p.id, label: p.name }))
	]);
	const api = $derived(`/api/v1/warbands/${wb.id}/export`);
	/** Close a dialog: take its query off the address, staying where the page is. */
	const close = () => goto(page.url.pathname, { replace: true, reset: false });
	let details = $state(false);
</script>

<svelte:head><title>{wb.name} · {w.title} · {m.app.name}</title></svelte:head>

<header class="head">
	<div class="title">
		<h1>{wb.name}</h1>
		<p class="dim">
			{wb.variantName ? `${wb.variantName} · ${wb.factionName}` : wb.factionName} · {w.rulesOf(
				wb.rulesSet,
				wb.rulesExpansions
			)}
		</p>
		<p class="rating data">
			<strong>{w.rating(wb.rating.ducats, wb.rating.glory)}</strong>
			<span class="dim">{w.ofLimit(wb.ducatLimit)}</span>
		</p>
		<p class="dim data">
			{b.patron}: {wb.patronName ?? b.noPatron} · {b.stashDucats}: {wb.stashDucats} · {b.unspentGlory}:
			{wb.unspentGlory}
		</p>
	</div>
	<div class="tools">
		<Button href="?export">{b.exportText}</Button>
		{#if wb.canEdit}
			<Button onclick={() => (details = !details)}>{b.details}</Button>
		{/if}
	</div>
</header>

{#if !wb.canEdit}<Message kind="warn">{b.readOnly(wb.ownerName)}</Message>{/if}

{#if wb.canEdit && details}
	<form
		class="details"
		method="POST"
		action="?/patch"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
	>
		<input type="hidden" name="op" value="patch" />
		<input type="hidden" name="version" value={wb.version} />
		<div class="grid3">
			<Field
				label={b.name}
				name="name"
				maxlength={80}
				value={wb.name}
				required
				error={patch.fields.name}
			/>
			<Select label={b.patron} name="patronId" options={patronOptions} value={wb.patronId ?? ''} />
			<Field
				label={b.limit}
				name="ducatLimit"
				type="number"
				min={0}
				max={100000}
				value={String(wb.ducatLimit)}
				error={patch.fields.ducatLimit}
			/>
			<Field
				label={b.stashDucats}
				name="stashDucats"
				type="number"
				value={String(wb.stashDucats)}
				error={patch.fields.stashDucats}
			/>
			<Field
				label={b.unspentGlory}
				name="unspentGlory"
				type="number"
				value={String(wb.unspentGlory)}
				error={patch.fields.unspentGlory}
			/>
		</div>
		<TextArea label={b.notes} name="notes" rows={3} maxlength={4000} value={wb.notes} />
		{#if patch.error && !Object.keys(patch.fields).length}<Message kind="danger"
				>{patch.error}</Message
			>{/if}
		{#if patch.done}<Message>{b.saved}</Message>{/if}
		<div class="row">
			<Button kind="primary" type="submit">{b.save}</Button>
		</div>
	</form>
	<form class="row" method="POST" action="?/remove" use:enhance>
		<input type="hidden" name="op" value="remove" />
		<ConfirmButton label={b.remove} confirm={b.removeConfirm} />
	</form>
{/if}

<ProblemList issues={wb.issues} {beyond} />

<div class="cols">
	<div class="roster">
		{#if wb.canEdit}
			<div><Button kind="primary" href="?add" icon={Plus}>{b.addFighter}</Button></div>
		{/if}
		{#each groups as { g, list } (g)}
			<section class="group" data-group={g}>
				<BandHeader title={b.groups[g]!} count={list.length} />
				{#each list as x (x.id)}
					<FighterCard fighter={x} unit={data.units[x.unitId]} canEdit={wb.canEdit} {form} />
				{/each}
			</section>
		{:else}
			<EmptyState text={b.noFighters} />
		{/each}
	</div>

	<aside class="side">
		<section class="seat">
			<h3>{b.seat}</h3>
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
				{#if data.seats.length}
					<form
						class="row end"
						method="POST"
						action="?/assign"
						use:enhance={() =>
							({ update }) =>
								update({ reset: false })}
					>
						<input type="hidden" name="op" value="assign" />
						<Select label={b.pickSeat} name="campaignId" options={data.seats} />
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
				<p class="dim">{w.notSeated}</p>
			{/if}
		</section>
		<StashPanel warband={wb} {form} />
		{#key wb.version}
			<FireteamsPanel warband={wb} {form} />
			<LocationsPanel warband={wb} {form} />
		{/key}
	</aside>
</div>

{#if data.recruits}
	<RecruitDialog units={data.recruits} {beyond} {form} onclose={close} />
{/if}
{#if data.equip}
	<EquipDialog
		fighter={data.equip.fighter}
		armoury={data.equip.armoury}
		upgrades={data.equip.upgrades}
		items={data.items}
		{beyond}
		{form}
		onclose={close}
	/>
{/if}
{#if data.stashLines}
	<Dialog title={b.stashTitle} onclose={close}>
		<div class="scroll">
			<LineList lines={data.stashLines} items={data.items} op="stashBuy" {beyond} {form} />
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
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.title {
		display: grid;
		gap: var(--space-1);
	}
	.title p {
		margin: 0;
	}
	.rating {
		font-size: 1.25rem;
	}
	.tools,
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.end {
		align-items: end;
	}
	.details {
		display: grid;
		gap: var(--space-3);
		max-width: 64rem;
		padding: var(--space-4);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.grid3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3);
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(19rem, 26rem);
		gap: var(--space-6);
		align-items: start;
	}
	.roster,
	.group,
	.side,
	.seat {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}
	.roster {
		gap: var(--space-5);
	}
	.side {
		gap: var(--space-6);
	}
	.seat p {
		margin: 0;
	}
	.small {
		font-size: var(--size-label);
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

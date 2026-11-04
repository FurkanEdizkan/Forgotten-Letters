<!--
  /campaigns/[id]: what every member sees: the facts, who runs it, the house rules and the seats. A player may
  leave their seat while the campaign is mustering (confirm in place). A listed campaign shows the same page to
  people who are not in it, without the seat names, plus "Ask to join". The CM and co-CMs get "Manage" and every
  seat's warband (read-only links); a seated player assigns one of their warbands to their seat, or builds one for
  it.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Settings from '@lucide/svelte/icons/settings';
	import { m } from '#lib/messages';
	import { canInCampaign } from '#lib/campaign-rights';
	import { joinOpen } from '#lib/campaign-stage';
	import { dateRange, roleOn } from '#lib/ui/campaign-facts';
	import { resultOf } from '#lib/ui/form-result';
	import StageBadge from '#lib/ui/StageBadge.svelte';
	import CampaignRoleBadge from '#lib/ui/CampaignRoleBadge.svelte';
	import HouseRules from '#lib/ui/HouseRules.svelte';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Select from '#lib/ui/Select.svelte';
	import WarbandCard from '#lib/ui/warbands/WarbandCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const c = m.campaigns;
	const p = c.page;

	const camp = $derived(data.campaign);
	const role = $derived(roleOn(camp));
	const member = $derived(!!camp.myRole || camp.mySeat);
	const facts = $derived(
		[
			camp.gamesPerPlayer ? c.gamesEach(camp.gamesPerPlayer) : null,
			dateRange(camp.startsOn, camp.endsOn),
			c.visibility[camp.visibility]
		].filter(Boolean)
	);
	const runners = $derived(
		[...camp.members]
			.sort((a, b) => (a.role === b.role ? 0 : a.role === 'cm' ? -1 : 1))
			.map((x) => (x.role === 'cm' ? c.cmIs(x.displayName) : c.coCmIs(x.displayName)))
	);
	const left = $derived(resultOf(form, 'leave'));
	const ask = $derived(resultOf(form, 'ask'));
	const withdraw = $derived(resultOf(form, 'withdraw'));
	const requested = $derived(!withdraw.done && (camp.myOpenRequest || !!ask.done));
	const handOver = $derived(resultOf(form, 'transfer'));
	// Owners hand the CM role over on any campaign (decision 7): to a co-CM, or to themselves.
	const handOverTo = $derived(
		data.me.role === 'owner'
			? [
					...(camp.myRole === 'cm'
						? []
						: [{ value: data.me.id, label: p.takeIt(data.me.displayName) }]),
					...camp.members
						.filter((x) => x.role === 'co_cm' && x.userId !== data.me.id)
						.map((x) => ({ value: x.userId, label: x.displayName }))
				]
			: []
	);
	let asking = $state(false);
	const wc = m.warbands.campaign;
	const assigned = $derived(resultOf(form, 'assignWarband'));
	const cleared = $derived(resultOf(form, 'clearWarband'));
	const warbandOptions = $derived(
		data.myWarbands
			.filter((x) => x.id !== data.myWarband?.id)
			.map((x) => ({
				value: x.id,
				label: x.otherRules ? `${x.name} (${wc.otherRules(x.rules.text)})` : x.name
			}))
	);
</script>

<svelte:head><title>{camp.name} · {m.app.name}</title></svelte:head>

<div class="head">
	<div class="title">
		<h1>{camp.name}</h1>
		<div class="tags">
			<span class="chip">{c.kinds[camp.kind]}</span>
			<StageBadge stage={camp.stage} />
			{#if role}<CampaignRoleBadge {role} />{/if}
		</div>
	</div>
	{#if canInCampaign(camp.myRole, data.me.role, 'manage')}
		<Button href="/campaigns/{camp.id}/manage" icon={Settings}>{p.manage}</Button>
	{/if}
</div>

<div class="about">
	<p class="dim data">{facts.join(' · ')}</p>
	<p class="dim">{runners.join(' · ')}</p>
	{#if camp.description}<p>{camp.description}</p>{/if}
</div>

{#if !member && camp.stage === 'mustering'}
	<section class="join">
		{#if ask.error ?? withdraw.error}<Message kind="danger">{ask.error ?? withdraw.error}</Message
			>{/if}
		{#if withdraw.done}<Message>{c.withdrawn}</Message>{/if}
		{#if requested}
			<div class="row">
				<Button disabled>{c.requestSent}</Button>
				<form method="POST" action="?/withdraw" use:enhance>
					<input type="hidden" name="op" value="withdraw" />
					<Button type="submit">{c.withdraw}</Button>
				</form>
				<span class="dim">{p.requestSentNote}</span>
			</div>
		{:else if asking}
			<form
				method="POST"
				action="?/ask"
				use:enhance={() =>
					({ update }) =>
						update({ reset: false })}
			>
				<input type="hidden" name="op" value="ask" />
				<Field label={c.askNote} name="note" maxlength={300} error={ask.fields.note} />
				<p class="dim small">{c.askNoteHint}</p>
				<div class="row">
					<Button kind="primary" type="submit">{c.askSend}</Button>
					<Button onclick={() => (asking = false)}>{c.askCancel}</Button>
				</div>
			</form>
		{:else}
			<div><Button kind="primary" onclick={() => (asking = true)}>{c.ask}</Button></div>
		{/if}
	</section>
{/if}

{#if handOverTo.length || handOver.done}
	<section class="handover">
		<h3>{p.handOver}</h3>
		<p class="dim">{p.handOverHint}</p>
		{#if handOver.error}<Message kind="danger">{handOver.error}</Message>{/if}
		{#if handOver.done}<Message>{p.handedOver}</Message>{/if}
		{#if handOverTo.length}
			<form class="row" method="POST" action="?/transfer" use:enhance>
				<input type="hidden" name="op" value="transfer" />
				<Select label={p.newCm} name="userId" options={handOverTo} />
				<ConfirmButton label={p.handOverButton} confirm={p.handOverConfirm} />
			</form>
		{/if}
	</section>
{/if}

<div class="cols">
	<section>
		<h3>{p.houseRules} <span class="count data">{camp.houseRules.length}</span></h3>
		<HouseRules rules={camp.houseRules} />
	</section>

	<section>
		<h3>
			{p.seats} <span class="count data">{p.seatsTaken(camp.seatsTaken, camp.seatsTotal)}</span>
		</h3>
		{#if member}
			<ol class="seats">
				{#each data.seats as seat (seat.id)}
					<li class:open={!seat.player}>
						<span class="num data">{seat.number}</span>
						{#if seat.player}
							<span
								>{seat.player.displayName}
								{#if seat.player.id === data.me.id}<span class="dim">{p.you}</span>{/if}</span
							>
						{:else}
							<span class="dim">{seat.name} · {p.open}</span>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}
		{#if camp.mySeat}
			<section class="mine" aria-label={wc.mine}>
				<h3>{wc.mine}</h3>
				{#if data.myWarband}
					<WarbandCard card={data.myWarband} href="/warbands/{data.myWarband.id}" />
					{#if camp.stage !== 'ended'}
						<form class="row" method="POST" action="?/clearWarband" use:enhance>
							<input type="hidden" name="op" value="clearWarband" />
							<Button type="submit">{wc.clear}</Button>
						</form>
					{/if}
				{:else}
					<p class="dim">{wc.none}</p>
				{/if}
				{#if camp.stage !== 'ended'}
					{#if warbandOptions.length}
						<form
							class="row end"
							method="POST"
							action="?/assignWarband"
							use:enhance={() =>
								({ update }) =>
									update({ reset: false })}
						>
							<input type="hidden" name="op" value="assignWarband" />
							<Select label={wc.pick} name="warbandId" options={warbandOptions} />
							<Button type="submit">{wc.assignButton}</Button>
							{#if assigned.fields.recheck}
								<Button type="submit" name="recheck" value="true">{wc.recheck}</Button>
							{/if}
						</form>
					{/if}
					{#if assigned.error}<Message kind="danger">{assigned.error}</Message>{/if}
					{#if cleared.error}<Message kind="danger">{cleared.error}</Message>{/if}
					<div class="row">
						<Button href="/warbands/new?campaign={camp.id}">{wc.newHere}</Button>
					</div>
				{/if}
				<p class="dim small">
					{wc.rules(camp.rules.text)}
				</p>
			</section>
		{/if}
		{#if left.error}<Message kind="danger">{left.error}</Message>{/if}
		{#if camp.mySeat && joinOpen(camp.stage, 'leave')}
			<form class="row" method="POST" action="?/leave" use:enhance>
				<input type="hidden" name="op" value="leave" />
				<ConfirmButton label={p.leave} confirm={p.leaveConfirm} />
				<span class="dim small">{p.leaveHint}</span>
			</form>
		{/if}
	</section>
</div>

{#if data.seatedWarbands}
	<section class="warbands">
		<h3>{wc.seats} <span class="count data">{data.seatedWarbands.length}</span></h3>
		{#if data.seatedWarbands.length}
			<div class="wcards">
				{#each data.seatedWarbands as s (s.seatId)}
					<div class="seated">
						<span class="dim small">{wc.seat}: {s.seatName}</span>
						<WarbandCard card={s.warband} href="/warbands/{s.warband.id}" />
					</div>
				{/each}
			</div>
		{:else}
			<p class="dim">{wc.seatsNone}</p>
		{/if}
	</section>
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.title,
	.about,
	section,
	form {
		display: grid;
		gap: var(--space-3);
	}
	.about {
		gap: var(--space-1);
	}
	.tags,
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.chip {
		padding: 0 var(--space-2);
		background: var(--panel-raised);
		border: var(--border-hairline) solid var(--rule);
		font-size: var(--size-label);
		line-height: 1.6;
	}
	.join,
	.handover {
		max-width: 36rem;
	}
	.handover .row {
		align-items: end;
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(16rem, 2fr);
		gap: var(--space-7);
		align-items: start;
	}
	.count {
		margin-left: var(--space-2);
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		color: var(--bone-dim);
	}
	.seats {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.seats li {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr);
		gap: var(--space-2);
		padding: var(--space-2) 0;
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	.num {
		color: var(--bone-dim);
		text-align: right;
	}
	.small {
		font-size: var(--size-label);
	}
	.mine {
		margin-top: var(--space-4);
	}
	.end {
		align-items: end;
	}
	.wcards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--space-4);
	}
	.seated {
		display: grid;
		gap: var(--space-1);
	}
</style>

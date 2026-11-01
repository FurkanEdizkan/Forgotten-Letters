<!--
  The Campaign panel: games played (the next game's Threshold and field strength follow it, Papal States 200
  lower; while it is 0, kit and fighters can still be refunded in full), victory points, failed promotion dice, the
  Patron (the owner until the first game, then only the CM: R8), the dedication (the Court's Sin: R2), "ignore
  limits" outside a campaign (R9), notes, and the campaign seat.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import type { ApiWarband } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import SeatBox from './SeatBox.svelte';

	type Props = {
		warband: ApiWarband;
		patrons: { id: string; name: string }[];
		seats: { value: string; label: string }[];
		form: FormResult;
	};
	let { warband: wb, patrons, seats, form }: Props = $props();
	const b = m.warbands.builder;
	const patch = $derived(resultOf(form, 'patch'));
	const patronOptions = $derived([
		{ value: '', label: b.noPatron },
		...patrons.map((p) => ({ value: p.id, label: p.name }))
	]);
	const dedicationOptions = $derived([
		{ value: '', label: b.noDedication },
		...wb.dedications.map((d) => ({ value: d.key, label: d.name }))
	]);
	const keep =
		() =>
		({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<article class="panel" data-panel="campaign">
	<header class="pnh">
		<a class="back" href="?sel=warband" aria-label={b.backToWarband}>‹</a>
		<h2>{b.campaignCard}</h2>
	</header>
	<div class="pnb">
		{#if wb.nextGame}
			<dl class="facts">
				<dt>{b.nextGame}</dt>
				<dd class="data">{wb.nextGame.game}</dd>
				<dt>{b.threshold}</dt>
				<dd class="data">{m.warbands.price(wb.nextGame.threshold, 'ducats')}</dd>
				<dt>{b.fieldStrength}</dt>
				<dd class="data">{wb.nextGame.fieldStrength}</dd>
				<dt>{b.elites}</dt>
				<dd class="data">{wb.elites} / 6</dd>
			</dl>
		{/if}
		<p class="note">{wb.canRefund ? b.refundOpen : b.refundShut}</p>

		{#if wb.canEdit}
			<form class="grid" method="POST" action="?/patch" use:enhance={keep}>
				<input type="hidden" name="op" value="patch" />
				<input type="hidden" name="version" value={wb.version} />
				<Field
					label={b.gamesPlayed}
					name="gamesPlayed"
					type="number"
					min={0}
					max={100}
					value={String(wb.gamesPlayed)}
					error={patch.fields.gamesPlayed}
				/>
				<Field
					label={b.victoryPoints}
					name="victoryPoints"
					type="number"
					value={String(wb.victoryPoints)}
					error={patch.fields.victoryPoints}
				/>
				<Field
					label={b.failedPromotions}
					name="failedPromotions"
					type="number"
					min={0}
					max={100}
					value={String(wb.failedPromotions)}
					error={patch.fields.failedPromotions}
				/>
				{#if wb.canChangePatron}
					<Select
						label={b.patron}
						name="patronId"
						options={patronOptions}
						value={wb.patronId ?? ''}
					/>
				{:else}
					<p class="ro">
						<span>{b.patron}</span>{wb.patronName ?? b.noPatron}<small>{b.patronLocked}</small>
					</p>
				{/if}
				{#if wb.dedications.length}
					<Select
						label={b.dedication}
						name="dedication"
						options={dedicationOptions}
						value={wb.dedication ?? ''}
					/>
				{/if}
				{#if !wb.seat}
					<label class="check wide"
						><input type="hidden" name="ignoreLimits" value="off" /><input
							type="checkbox"
							name="ignoreLimits"
							checked={wb.ignoreLimits}
						/>
						{b.ignoreLimits}</label
					>
				{/if}
				<div class="wide">
					<TextArea label={b.notes} name="notes" rows={3} maxlength={4000} value={wb.notes} />
				</div>
				{#if patch.error && !Object.keys(patch.fields).length}<div class="wide">
						<Message kind="danger">{patch.error}</Message>
					</div>{/if}
				{#if patch.done}<p class="wide note">{b.saved}</p>{/if}
				<div class="wide"><Button kind="primary" type="submit">{b.save}</Button></div>
			</form>
		{:else if wb.canChangePatron}
			<form class="grid" method="POST" action="?/patch" use:enhance={keep}>
				<input type="hidden" name="op" value="patch" />
				<input type="hidden" name="version" value={wb.version} />
				<Select
					label={b.patron}
					name="patronId"
					options={patronOptions}
					value={wb.patronId ?? ''}
				/>
				<div class="wide"><Button kind="primary" type="submit">{b.save}</Button></div>
				{#if patch.error}<div class="wide"><Message kind="danger">{patch.error}</Message></div>{/if}
			</form>
		{:else}
			<dl class="facts">
				<dt>{b.gamesPlayed}</dt>
				<dd class="data">{wb.gamesPlayed}</dd>
				<dt>{b.victoryPoints}</dt>
				<dd class="data">{wb.victoryPoints}</dd>
				<dt>{b.patron}</dt>
				<dd>{wb.patronName ?? b.noPatron}</dd>
			</dl>
		{/if}
		<SeatBox warband={wb} {seats} {form} />
	</div>
</article>

<style>
	.panel {
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.pnh {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		padding: var(--space-2) var(--space-4);
		background: var(--blood);
	}
	.pnh h2 {
		margin: 0;
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-title);
		font-weight: 600;
		letter-spacing: normal;
		text-transform: none;
	}
	.back {
		color: var(--bone);
		text-decoration: none;
		font-size: 1.4em;
		line-height: 1;
	}
	.pnb {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4) var(--space-4);
	}
	.facts {
		display: grid;
		grid-template-columns: 9rem 1fr 9rem 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.facts dt {
		color: var(--bone-faint);
	}
	.facts dd {
		margin: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-3);
		align-items: end;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.check {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		padding-bottom: var(--space-2);
	}
	.check input {
		accent-color: var(--blood-bright);
	}
	.ro {
		display: grid;
		margin: 0;
	}
	.ro span {
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	.ro small,
	.note {
		margin: 0;
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
</style>

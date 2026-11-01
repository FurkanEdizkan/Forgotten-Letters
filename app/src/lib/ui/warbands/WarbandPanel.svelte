<!--
  The Warband panel (the default on the right): name and ducat limit (with Save), faction, variant or Sin, rules
  version, the faction's special rules text, the totals, the problem list, fireteams and locations; and the
  warband's own actions: play mode, print, export, copy, delete.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import { elementHref } from '#lib/rules/text';
	import type { ApiWarband } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import { rulesView } from '#lib/ui/rules/context';
	import FireteamsPanel from './FireteamsPanel.svelte';
	import LocationsPanel from './LocationsPanel.svelte';
	import ProblemList from './ProblemList.svelte';

	type Props = { warband: ApiWarband; beyond: boolean; form: FormResult };
	let { warband: wb, beyond, form }: Props = $props();
	const b = m.warbands.builder;
	const view = rulesView();
	const patch = $derived(resultOf(form, 'patch'));
	const copied = $derived(resultOf(form, 'copy'));
</script>

<article class="panel" data-panel="warband">
	<header class="pnh">
		<h2>{b.warbandCard}</h2>
	</header>
	<div class="pnb">
		<dl class="facts">
			<dt>{b.faction}</dt>
			<dd><a href={elementHref(view.set, wb.factionId)}>{wb.factionName}</a></dd>
			{#if wb.variantName}<dt>{b.variant}</dt>
				<dd>{wb.variantName}</dd>{/if}
			{#if wb.dedicationName}<dt>{b.dedication}</dt>
				<dd>{wb.dedicationName}</dd>{/if}
			<dt>{b.rules}</dt>
			<dd class="data">{m.warbands.rulesOf(wb.rulesSet, wb.rulesExpansions)}</dd>
			<dt>{b.patron}</dt>
			<dd>{wb.patronName ?? b.noPatron}</dd>
			<dt>{b.rating}</dt>
			<dd class="data">
				{m.warbands.money(wb.rating.ducats, wb.rating.glory)}
				{m.warbands.ofLimit(wb.ducatLimit)}
			</dd>
		</dl>

		{#if wb.canEdit}
			<form
				class="row end"
				method="POST"
				action="?/patch"
				use:enhance={() =>
					({ update }) =>
						update({ reset: false })}
			>
				<input type="hidden" name="op" value="patch" />
				<input type="hidden" name="version" value={wb.version} />
				<Field
					label={b.name}
					name="name"
					maxlength={80}
					value={wb.name}
					required
					error={patch.fields.name}
				/>
				<Field
					label={b.limit}
					name="ducatLimit"
					type="number"
					min={0}
					max={100000}
					value={String(wb.ducatLimit)}
					error={patch.fields.ducatLimit}
				/>
				<Button kind="primary" type="submit">{b.save}</Button>
			</form>
			{#if patch.error && !Object.keys(patch.fields).length}<Message kind="danger"
					>{patch.error}</Message
				>{/if}
		{/if}

		<ProblemList issues={wb.issues} {beyond} />

		{#key wb.version}
			<FireteamsPanel warband={wb} {form} />
			<LocationsPanel warband={wb} {form} />
		{/key}

		<div class="row actions">
			<Button href="/warbands/{wb.id}/play">{b.playMode}</Button>
			<Button href="?export">{b.exportText}</Button>
			{#if wb.canEdit}
				<form method="POST" action="?/copy" use:enhance>
					<input type="hidden" name="op" value="copy" />
					<Button type="submit">{b.copyWarband}</Button>
				</form>
				<form method="POST" action="?/remove" use:enhance>
					<input type="hidden" name="op" value="remove" />
					<ConfirmButton label={b.remove} confirm={b.removeConfirm} />
				</form>
			{/if}
		</div>
		{#if copied.error}<Message kind="danger">{copied.error}</Message>{/if}
	</div>
</article>

<style>
	.panel {
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.pnh {
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
	.pnb {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4) var(--space-4);
	}
	.facts {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.facts dt {
		color: var(--bone-faint);
	}
	.facts dd {
		margin: 0;
	}
	.facts a {
		color: var(--bone);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.end {
		align-items: end;
	}
	.actions {
		padding-top: var(--space-3);
		border-top: var(--border-hairline) solid var(--rule);
	}
</style>

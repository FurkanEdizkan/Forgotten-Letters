<!--
  One fighter on the builder (DESIGN.md §7, Card): its picture slot (empty until a picture is added), name and
  unit, cost in Ducats and Glory, stats and keywords, Battlekit (fixed kit marked; bought kit can be sold),
  upgrades, skills, injuries and Experience. Its owner can equip it (the Equip dialog), edit it in place (name,
  group with Dead, Experience, skills and injuries) and remove it.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/messages';
	import { elementHref } from '#lib/rules/text';
	import type { Unit } from '#lib/rules/pack';
	import type { ApiFighter } from '#lib/schemas/warbands';
	import { GROUPS } from '#lib/warbands/types';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Select from '#lib/ui/Select.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import KeywordChip from '#lib/ui/rules/KeywordChip.svelte';
	import { rulesView } from '#lib/ui/rules/context';

	type Props = { fighter: ApiFighter; unit?: Unit; canEdit: boolean; form: FormResult };
	let { fighter: x, unit, canEdit, form }: Props = $props();
	const b = m.warbands.builder;
	const view = rulesView();
	const STATS = ['movement', 'ranged', 'melee', 'armour'] as const;
	let editing = $state(false);
	let file: HTMLInputElement | undefined = $state();

	const edit = $derived(resultOf(form, 'editFighter', x.id));
	const image = $derived(resultOf(form, 'image', x.id));
	const sold = $derived(resultOf(form, 'sell', x.id));
	const title = $derived(x.name ?? x.unitName);
	const groups = GROUPS.map((g) => ({ value: g, label: b.groups[g]! }));
	$effect(() => {
		if (edit.done) editing = false;
	});
</script>

<article class="card" data-fighter={x.id}>
	<div class="pic">
		{#if x.image}
			<img src={x.image} alt={b.image(title)} />
		{:else}
			<div class="slot" aria-hidden="true"><ImagePlus size={28} strokeWidth={1.25} /></div>
		{/if}
		{#if canEdit}
			<form
				method="POST"
				action="?/image"
				enctype="multipart/form-data"
				use:enhance={() =>
					({ update }) =>
						update({ reset: true })}
			>
				<input type="hidden" name="op" value="image" />
				<input type="hidden" name="id" value={x.id} />
				<input type="hidden" name="fid" value={x.id} />
				<label class="up">
					<input
						bind:this={file}
						class="visually-hidden"
						type="file"
						name="image"
						accept="image/png,image/jpeg,image/webp"
						onchange={() => file?.form?.requestSubmit()}
					/>
					{x.image ? b.replace : b.upload}
				</label>
			</form>
			{#if x.image}
				<form method="POST" action="?/clearImage" use:enhance>
					<input type="hidden" name="op" value="clearImage" />
					<input type="hidden" name="id" value={x.id} />
					<input type="hidden" name="fid" value={x.id} />
					<button class="link" type="submit">{b.clearImage}</button>
				</form>
			{/if}
		{/if}
	</div>

	<div class="body">
		<div class="top">
			<div>
				<h3>{x.name ?? x.unitName}</h3>
				<a class="unit" href={elementHref(view.set, x.unitId)}>{x.unitName}</a>
			</div>
			<span class="data cost">{m.warbands.rating(x.cost.ducats, x.cost.glory)}</span>
		</div>
		{#if image.error}<p class="err" role="alert">{image.error}</p>{/if}
		{#if unit}
			<p class="stats data">
				{#each STATS as s (s)}{#if unit.stats[s]}<span
							><span class="dim">{m.rules.stats[s]}</span> {unit.stats[s]}</span
						>{/if}{/each}
			</p>
			{#if unit.keywords.length}
				<p class="chips">
					{#each unit.keywords as k, i (`${i}:${k.kw}`)}<KeywordChip
							id={k.kw}
							value={k.value}
						/>{/each}
				</p>
			{/if}
		{/if}
		<dl>
			<dt>{b.battlekit}</dt>
			<dd>
				{#each x.kit as k, i (i)}
					<span class="kit"
						><a href={elementHref(view.set, k.itemId)}>{k.name}</a>{#if k.fixed}<span class="dim">
								({b.fixed})</span
							>{:else if canEdit && k.lineId}<form
								class="inline"
								method="POST"
								action="?/sell"
								use:enhance
							>
								<input type="hidden" name="op" value="sell" />
								<input type="hidden" name="id" value={x.id} />
								<input type="hidden" name="fid" value={x.id} />
								<input type="hidden" name="lineId" value={k.lineId} />
								<button
									class="sell"
									type="submit"
									aria-label={b.sell(k.name)}
									title={b.sell(k.name)}><X size={14} aria-hidden={true} /></button
								>
							</form>{/if}</span
					>
				{:else}<span class="dim">—</span>{/each}
			</dd>
			{#if x.upgrades.length}
				<dt>{b.upgrades}</dt>
				<dd>{x.upgrades.map((u) => u.name).join(', ')}</dd>
			{/if}
			{#if x.skills.length}
				<dt>{b.skills}</dt>
				<dd>{x.skills.map((s) => s.name).join(', ')}</dd>
			{/if}
			{#if x.injuries.length}
				<dt>{b.injuries}</dt>
				<dd>{x.injuries.map((s) => s.name).join(', ')}</dd>
			{/if}
			{#if x.xp}
				<dt>{b.xp}</dt>
				<dd class="data">{x.xp}</dd>
			{/if}
		</dl>
		{#if sold.error}<p class="err" role="alert">{sold.error}</p>{/if}

		{#if canEdit}
			{#if editing}
				<form
					class="edit"
					method="POST"
					action="?/editFighter"
					use:enhance={() =>
						({ update }) =>
							update({ reset: false })}
				>
					<input type="hidden" name="op" value="editFighter" />
					<input type="hidden" name="id" value={x.id} />
					<input type="hidden" name="fid" value={x.id} />
					<input type="hidden" name="version" value={x.version} />
					<div class="two">
						<Field label={b.fighterName} name="name" maxlength={120} value={x.name ?? ''} />
						<Select label={b.group} name="group" options={groups} value={x.group} />
					</div>
					<Field
						label={b.xp}
						name="xp"
						type="number"
						min={0}
						max={1000}
						value={String(x.xp)}
						error={edit.fields.xp}
					/>
					<TextArea
						label={b.skills}
						name="skills"
						rows={2}
						value={x.skills.map((s) => s.name).join('\n')}
					/>
					<TextArea
						label={b.injuries}
						name="injuries"
						rows={2}
						value={x.injuries.map((s) => s.name).join('\n')}
					/>
					<p class="dim small">{b.skillsHint}</p>
					{#if edit.error}<p class="err" role="alert">{edit.error}</p>{/if}
					<div class="row">
						<Button kind="primary" type="submit">{b.save}</Button>
						<Button onclick={() => (editing = false)}>{m.warbands.wizard.cancel}</Button>
					</div>
				</form>
			{:else}
				<div class="row">
					<Button href="?equip={x.id}">{b.equip}</Button>
					<Button onclick={() => (editing = true)}>{b.edit}</Button>
					<form method="POST" action="?/removeFighter" use:enhance>
						<input type="hidden" name="op" value="removeFighter" />
						<input type="hidden" name="fid" value={x.id} />
						<ConfirmButton label={b.removeFighter} confirm={b.removeFighterConfirm} />
					</form>
				</div>
			{/if}
		{/if}
	</div>
</article>

<style>
	.card {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		border-top: var(--border-card-top) solid var(--blood);
	}
	.pic {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		justify-items: center;
	}
	.pic img,
	.slot {
		width: 7rem;
		height: 7rem;
		object-fit: cover;
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule);
	}
	.slot {
		display: grid;
		place-items: center;
		color: var(--bone-faint);
	}
	.up,
	.link {
		background: none;
		border: 0;
		padding: 0;
		color: var(--blood-pale);
		font: inherit;
		font-size: var(--size-label);
		text-decoration: underline;
		cursor: pointer;
	}
	.up:has(input:focus-visible) {
		outline: var(--border-focus) solid var(--blood-bright);
	}
	.body {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-width: 0;
	}
	.top {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		align-items: baseline;
	}
	h3 {
		padding: 0;
		border: 0;
	}
	.unit {
		font-size: var(--size-label);
		color: var(--blood-pale);
	}
	.cost {
		white-space: nowrap;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
	}
	dl {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	dt {
		color: var(--bone-dim);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	dd {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
	}
	.kit {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.kit a {
		color: var(--bone);
	}
	.inline {
		display: inline;
	}
	.sell {
		display: inline-grid;
		place-items: center;
		width: 20px;
		height: 20px;
		padding: 0;
		background: none;
		border: var(--border-hairline) solid var(--rule-strong);
		color: var(--bone-dim);
		cursor: pointer;
	}
	.sell:hover {
		border-color: var(--danger);
		color: var(--bone);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.edit {
		display: grid;
		gap: var(--space-3);
	}
	.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
	}
	.err {
		margin: 0;
		color: var(--bone);
		border-left: var(--border-status-edge) solid var(--danger);
		padding-left: var(--space-2);
	}
	.small {
		font-size: var(--size-label);
	}
</style>

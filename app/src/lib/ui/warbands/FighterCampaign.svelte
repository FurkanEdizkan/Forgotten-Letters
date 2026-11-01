<!--
  A fighter's campaign data, entered by hand until step 6 rolls it (Rulebook, Campaign Phase): the Experience track
  with its advancement marks (circles) and −/+, Battle Scars (the third makes it unfit for duty, which puts its
  bought kit in the Arsenal), status, rank (Promote a Troop, Demote it back), advancements picked from the skill
  tables and injuries from the trauma table, each removable.
-->
<script module lang="ts">
	export type PickTable = {
		id: string;
		name: string;
		kind: string;
		rows: { roll: string; name: string }[];
	};
</script>

<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/messages';
	import type { ApiFighter } from '#lib/schemas/warbands';
	import { STATUSES } from '#lib/warbands/types';
	import { resultOf, type FormResult } from '#lib/ui/form-result';

	type Props = {
		fighter: ApiFighter;
		tables: PickTable[];
		marks: number[];
		canEdit: boolean;
		form: FormResult;
	};
	let { fighter: x, tables, marks, canEdit, form }: Props = $props();
	const b = m.warbands.builder;
	const edit = $derived(resultOf(form, 'editFighter', x.id));
	const boxes = $derived(Math.max(x.xpMax ?? 0, 12, x.xp + 2, ...marks.map((n) => n + 1)));
	const skillTables = $derived(tables.filter((t) => t.kind === 'skill'));
	const trauma = $derived(tables.filter((t) => t.kind === 'trauma'));
	let skill = $state('');
	let injury = $state('');
	let status = $state('');
	const elite = $derived(x.group === 'elite');
	const keep =
		() =>
		({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
	const refs = (xs: { ref: string }[]) => xs.map((s) => s.ref);
</script>

{#snippet hidden()}
	<input type="hidden" name="op" value="editFighter" />
	<input type="hidden" name="id" value={x.id} />
	<input type="hidden" name="fid" value={x.id} />
	<input type="hidden" name="version" value={x.version} />
{/snippet}

<section class="camp" data-campaign={x.id}>
	<h3 class="sub">{b.campaignBlock}</h3>
	<div class="kv">
		<span>{b.xp}</span>
		<div class="xp" aria-label={b.xpTrack(x.xp)}>
			{#each Array.from({ length: boxes }, (_v, i) => i) as i (i)}<i
					class:on={i < x.xp}
					class:mk={marks.includes(i + 1)}
					class:cap={x.xpMax != null && i >= x.xpMax}
				></i>{/each}
		</div>
		{#if canEdit}
			<div class="pm">
				{#each [{ d: -1, icon: Minus, label: b.lessXp }, { d: 1, icon: Plus, label: b.moreXp }] as s (s.d)}
					<form method="POST" action="?/editFighter" use:enhance={keep}>
						{@render hidden()}
						<input type="hidden" name="xp" value={Math.max(0, x.xp + s.d)} />
						<button
							type="submit"
							aria-label={s.label}
							disabled={(s.d < 0 && x.xp === 0) || (s.d > 0 && x.xpMax != null && x.xp >= x.xpMax)}
							><s.icon size={14} aria-hidden={true} /></button
						>
					</form>
				{/each}
				<span class="data">{x.xp}</span>
			</div>
		{/if}
	</div>
	<p class="note">
		{b.marks(marks)}
		{x.xpMax != null ? b.limitedPotential(x.xpMax) : ''}
		{x.advancementsDue ? b.due(x.advancementsDue) : b.noneDue}
	</p>

	<div class="kv">
		<span>{b.scars}</span>
		<span class="data">{b.scarsOf(x.scars)}</span>
		{#if canEdit}
			<div class="pm">
				{#each [-1, 1] as d (d)}
					<form method="POST" action="?/editFighter" use:enhance={keep}>
						{@render hidden()}
						<input type="hidden" name="scars" value={Math.max(0, x.scars + d)} />
						{#if d > 0 && x.scars + 1 >= 3}<input type="hidden" name="status" value="unfit" />{/if}
						<button
							type="submit"
							aria-label={d < 0 ? b.lessScars : b.moreScars}
							disabled={(d < 0 && x.scars === 0) || (d > 0 && x.scars >= 10)}
							>{#if d < 0}<Minus size={14} aria-hidden={true} />{:else}<Plus
									size={14}
									aria-hidden={true}
								/>{/if}</button
						>
					</form>
				{/each}
			</div>
		{/if}
	</div>
	{#if x.scars >= 2 && x.status === 'active'}<p class="note">{b.mayRetire}</p>{/if}

	<div class="kv">
		<span>{b.status}</span>
		{#if canEdit}
			<form class="inl" method="POST" action="?/editFighter" use:enhance={keep}>
				{@render hidden()}
				<select
					name="status"
					aria-label={b.status}
					value={x.status}
					onchange={(e) => (status = e.currentTarget.value)}
				>
					{#each STATUSES as s (s)}<option value={s}>{b.statuses[s]}</option>{/each}
				</select>
				<button type="submit" disabled={!status || status === x.status}>{b.change}</button>
			</form>
		{:else}
			<span>{b.statuses[x.status]}</span>
		{/if}
	</div>

	<div class="kv">
		<span>{b.rank}</span>
		<span>{elite ? b.groups.elite : b.groups[x.group]}</span>
		{#if canEdit && (x.category === 'troop' || x.category === 'mercenary')}
			<form class="inl" method="POST" action="?/editFighter" use:enhance={keep}>
				{@render hidden()}
				<input type="hidden" name="group" value={elite ? 'troop' : 'elite'} />
				<button
					type="submit"
					disabled={!elite && !!x.promotion}
					title={!elite && x.promotion ? x.promotion : undefined}
					>{elite ? b.demote : b.promote}</button
				>
			</form>
		{/if}
	</div>
	{#if !elite && x.promotion && x.category === 'troop'}<p class="note">{x.promotion}</p>{/if}

	{#each [{ key: 'skills' as const, title: b.advancements, list: x.skills, tbls: skillTables, pick: () => skill, set: (v: string) => (skill = v) }, { key: 'injuries' as const, title: b.injuries, list: x.injuries, tbls: trauma, pick: () => injury, set: (v: string) => (injury = v) }] as g (g.key)}
		<h4 class="cat">{g.title}</h4>
		{#each g.list as s, i (`${i}:${s.ref}`)}
			<div class="it">
				<span>{s.name}</span>
				{#if canEdit}
					<form method="POST" action="?/editFighter" use:enhance={keep}>
						{@render hidden()}
						<input
							type="hidden"
							name={g.key}
							value={refs(g.list)
								.filter((_, j) => j !== i)
								.join('\n') || ' '}
						/>
						<button type="submit" class="x" aria-label={b.removeEntry(s.name)}
							><X size={14} aria-hidden={true} /></button
						>
					</form>
				{/if}
			</div>
		{:else}
			<p class="note">{b.noneYet}</p>
		{/each}
		{#if canEdit && g.tbls.length}
			<form class="inl add" method="POST" action="?/editFighter" use:enhance={keep}>
				{@render hidden()}
				<input
					type="hidden"
					name={g.key}
					value={[...refs(g.list), g.pick()].filter(Boolean).join('\n')}
				/>
				<select
					aria-label={b.pickFrom(g.title)}
					value={g.pick()}
					onchange={(e) => g.set(e.currentTarget.value)}
				>
					<option value="">{b.pickFrom(g.title)}</option>
					{#each g.tbls as t (t.id)}
						<optgroup label={t.name}>
							{#each t.rows as r (r.roll)}<option value="{t.id}#{r.roll}"
									>{r.roll} · {r.name}</option
								>{/each}
						</optgroup>
					{/each}
				</select>
				<button type="submit" disabled={!g.pick()}>{b.add}</button>
			</form>
		{/if}
	{/each}
	{#if edit.error}<p class="err" role="alert">{edit.error}</p>{/if}
</section>

<style>
	.camp {
		display: grid;
		gap: var(--space-2);
	}
	.sub {
		margin: var(--space-3) 0 0;
		padding-bottom: 2px;
		border-bottom: var(--border-hairline) solid var(--blood);
		color: var(--bone-dim);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.kv {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr) auto;
		gap: var(--space-2);
		align-items: center;
	}
	.kv > span:first-child {
		color: var(--bone-faint);
	}
	.xp {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}
	.xp i {
		width: 12px;
		height: 12px;
		border: var(--border-hairline) solid var(--rule-strong);
	}
	.xp i.on {
		background: var(--bone);
		border-color: var(--bone);
	}
	.xp i.mk {
		border-radius: 50%;
		border-color: var(--blood-bright);
	}
	.xp i.mk.on {
		background: var(--blood-bright);
	}
	.xp i.cap {
		opacity: 0.25;
	}
	.pm,
	.inl {
		display: flex;
		gap: var(--space-1);
		align-items: center;
	}
	.pm button,
	.inl button,
	.x {
		display: grid;
		place-items: center;
		min-width: 26px;
		height: 26px;
		padding: 0 var(--space-2);
		background: var(--panel-raised);
		color: var(--bone);
		border: var(--border-hairline) solid var(--rule-strong);
		font: inherit;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	select {
		height: 28px;
		max-width: 100%;
		background: var(--inset);
		color: var(--bone);
		border: var(--border-hairline) solid var(--rule-strong);
		font: inherit;
	}
	.add select {
		flex: 1;
	}
	.note {
		margin: 0;
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
	.cat {
		margin: var(--space-2) 0 0;
		padding: 2px var(--space-2);
		background: var(--inset);
		color: var(--bone-dim);
		font-size: var(--size-label);
		font-weight: 400;
	}
	.it {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		align-items: center;
		padding: 0 var(--space-2);
	}
	.x {
		background: none;
		border: 0;
		color: var(--bone-dim);
	}
	.err {
		margin: 0;
		color: var(--danger);
	}
</style>

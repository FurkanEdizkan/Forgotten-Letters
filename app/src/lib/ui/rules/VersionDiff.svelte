<!--
  What changed between two rules versions: a form to pick both (a plain GET, so it works without script), then the
  added, removed and changed elements, each change with its fields before and after.
-->
<script lang="ts">
	import type { DiffOut } from '#lib/schemas/rules';
	import { elementHref } from '#lib/rules/text';
	import { m } from '#lib/messages';
	import Button from '#lib/ui/Button.svelte';
	import Select from '#lib/ui/Select.svelte';

	type Props = {
		changes: DiffOut | null;
		versions: { value: string; label: string }[];
	};
	let { changes, versions }: Props = $props();
	const show = (v: unknown) => (v === undefined ? m.rules.none : String(v));
</script>

<section class="diff" aria-labelledby="diff-h">
	<h2 id="diff-h">{m.rules.changes}</h2>
	{#if versions.length < 2}
		<p class="dim">{m.rules.needTwo}</p>
	{:else}
		<form method="GET" class="pick">
			<Select label={m.rules.from} name="from" options={versions} value={changes?.from} />
			<Select label={m.rules.to} name="to" options={versions} value={changes?.to} />
			<Button type="submit">{m.rules.compare}</Button>
		</form>
	{/if}
	{#if changes}
		{#if !changes.added.length && !changes.removed.length && !changes.changed.length}
			<p class="dim">{m.rules.noChanges}</p>
		{/if}
		{#each [['added', changes.added, changes.to], ['removed', changes.removed, changes.from]] as const as [kind, list, set] (kind)}
			{#if list.length}
				<h3>{kind === 'added' ? m.rules.added : m.rules.removed} ({list.length})</h3>
				<ul class={kind}>
					{#each list as e (e.id)}
						<li>
							<a href={elementHref(set, e.id)}>{e.name}</a>
							<span class="dim">{m.rules.types[e.type]}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/each}
		{#if changes.changed.length}
			<h3>{m.rules.changed} ({changes.changed.length})</h3>
			{#each changes.changed as c (c.id)}
				<table class="table" data-changed={c.id}>
					<caption
						><a href={elementHref(changes.to, c.id)}>{c.name}</a>
						<span class="dim">{m.rules.types[c.type]}</span></caption
					>
					<thead>
						<tr>
							<th scope="col">{m.rules.field}</th>
							<th scope="col">{m.rules.before}</th>
							<th scope="col">{m.rules.after}</th>
						</tr>
					</thead>
					<tbody>
						{#each c.fields as f (f.path)}
							<tr>
								<td class="mono">{f.path}</td>
								<td>{show(f.from)}</td>
								<td>{show(f.to)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/each}
		{/if}
	{/if}
</section>

<style>
	.diff {
		display: grid;
		gap: var(--space-3);
	}
	.pick {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: end;
	}
	h3 {
		margin: 0;
	}
	ul {
		margin: 0;
		padding-left: var(--space-4);
		columns: 2;
	}
	caption {
		text-align: left;
		padding: var(--space-2) 0;
		font-weight: 700;
	}
	td {
		overflow-wrap: anywhere;
	}
	a {
		color: var(--blood-pale);
	}
</style>

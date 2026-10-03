<script lang="ts" generics="T">
	/**
	 * Rows to put in order: drag a row by its handle, or ↑ / ↓ (keyboard and touch); × removes one where allowed.
	 * `onmove` hears every new order (the entry list saves it as `sort`).
	 */
	import type { Snippet } from 'svelte';
	import { drag, endDrag, startDrag } from './drag.svelte';

	let {
		items = $bindable(),
		row,
		label,
		removable = false,
		onmove,
		keyOf = (it: T) => it as unknown
	}: { items: T[]; row: Snippet<[T, number]>; label: string; removable?: boolean; onmove?: (items: T[]) => void; keyOf?: (it: T, i: number) => unknown } = $props();

	const me = Symbol();
	let overAt = $state(-1);

	function move(from: number, to: number) {
		if (to < 0 || to >= items.length || from === to) return;
		const next = [...items];
		const [it] = next.splice(from, 1);
		next.splice(to, 0, it);
		items = next;
		onmove?.(next);
	}
	function remove(i: number) {
		items = items.filter((_, k) => k !== i);
		onmove?.(items);
	}
</script>

<ol class="sortable" aria-label={label}>
	{#each items as it, i (keyOf(it, i))}
		<li
			class:over={overAt === i}
			ondragover={(e) => {
				if (drag.from !== me) return;
				e.preventDefault();
				overAt = i;
			}}
			ondragleave={() => (overAt = -1)}
			ondrop={(e) => {
				if (drag.from !== me) return;
				e.preventDefault();
				move(drag.index, i);
				overAt = -1;
				endDrag();
			}}
		>
			<span class="handle" draggable="true" role="presentation" title="Drag to reorder" ondragstart={(e) => startDrag(e, 'row', null, me, i)} ondragend={endDrag}>⠿</span>
			<div class="body">{@render row(it, i)}</div>
			<span class="tools">
				<button type="button" class="ghost mini" aria-label="Move up" disabled={i === 0} onclick={() => move(i, i - 1)}>↑</button>
				<button type="button" class="ghost mini" aria-label="Move down" disabled={i === items.length - 1} onclick={() => move(i, i + 1)}>↓</button>
				{#if removable}<button type="button" class="ghost mini" aria-label="Remove" onclick={() => remove(i)}>×</button>{/if}
			</span>
		</li>
	{/each}
</ol>

<style>
	.sortable {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 6px;
		align-items: start;
		padding: 6px 0;
		border-bottom: 1px solid var(--rule);
	}
	li.over {
		box-shadow: inset 0 2px 0 var(--blood);
	}
	.handle {
		padding: 4px 2px;
		color: var(--muted);
		cursor: grab;
		user-select: none;
	}
	.handle:hover {
		color: var(--blood);
	}
	.body {
		min-width: 0;
	}
	.tools {
		display: flex;
		gap: 2px;
	}
	.mini {
		padding: 1px 7px;
		letter-spacing: 0;
	}
</style>

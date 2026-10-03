<script lang="ts">
	/**
	 * A list of names as chips: type to add (with suggestions, a comma or Enter between), drop one from the library
	 * or another list, drag a chip to reorder (or Alt+←/→), × or Delete to remove. Focusing it makes it where a
	 * click in the library adds. With `name` it posts one field per name, and `_sent` says it was sent even empty.
	 */
	import { accepts, drag, endDrag, startDrag, target, type Kind } from './drag.svelte';

	let {
		values = $bindable([]),
		kinds,
		label,
		name,
		list,
		placeholder = 'Add…',
		upper = false,
		titleOf
	}: {
		values?: string[];
		kinds: Kind[];
		label: string;
		name?: string;
		list?: string;
		placeholder?: string;
		upper?: boolean;
		titleOf?: (v: string) => string | undefined;
	} = $props();

	const me = Symbol();
	let over = $state(false);
	let text = $state('');
	let box: HTMLDivElement;

	/** A library card carries its name (and what it is); a chip list takes the name. */
	const nameOf = (v: unknown) => (typeof v === 'string' ? v : v && typeof v === 'object' && 'name' in v ? String(v.name) : null);
	const tidy = (v: string) => (upper ? v.trim().toUpperCase() : v.trim());
	function add(v: string, at = values.length) {
		const t = tidy(v);
		if (!t || values.some((x) => x.toLowerCase() === t.toLowerCase())) return;
		values = [...values.slice(0, at), t, ...values.slice(at)];
	}
	function commit() {
		for (const v of text.split(',')) add(v);
		text = '';
	}
	function remove(i: number) {
		values = values.filter((_, k) => k !== i);
		// Keep the keyboard where it was.
		queueMicrotask(() => (box?.querySelectorAll<HTMLElement>('.chip')[Math.min(i, values.length - 1)] ?? box?.querySelector('input'))?.focus());
	}
	function move(from: number, to: number) {
		if (to < 0 || to >= values.length || from === to) return;
		const next = [...values];
		const [v] = next.splice(from, 1);
		next.splice(to, 0, v);
		values = next;
	}
	function drop(e: DragEvent, at = values.length) {
		// What this list can't take goes on to the list or rule around it.
		if (drag.from !== me && !(accepts(kinds) && nameOf(drag.value))) return;
		e.preventDefault();
		e.stopPropagation();
		over = false;
		if (drag.from === me) move(drag.index, Math.min(at, values.length - 1));
		else if (nameOf(drag.value)) add(nameOf(drag.value)!, at);
		endDrag();
	}
	function dragover(e: DragEvent) {
		if (!accepts(kinds) && drag.from !== me) return;
		e.preventDefault();
		over = true;
	}
	function key(e: KeyboardEvent, i: number) {
		if (e.key === 'Delete' || e.key === 'Backspace') (e.preventDefault(), remove(i));
		else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
			e.preventDefault();
			const to = i + (e.key === 'ArrowLeft' ? -1 : 1);
			move(i, to);
			queueMicrotask(() => box?.querySelectorAll<HTMLElement>('.chip')[to]?.focus());
		}
	}
	const claim = () => Object.assign(target, { kind: kinds[0], label, add: (v: unknown) => nameOf(v) && add(nameOf(v)!) });
</script>

<div class="chips" class:over bind:this={box} role="group" aria-label={label} ondragover={dragover} ondragleave={() => (over = false)} ondrop={(e) => drop(e)}>
	{#each values as v, i (v)}
		<span
			class="chip"
			role="button"
			tabindex="0"
			draggable="true"
			title={titleOf?.(v)}
			aria-label="{v}: Alt and arrows move it, Delete removes it"
			ondragstart={(e) => startDrag(e, kinds[0], v, me, i)}
			ondragend={endDrag}
			ondragover={dragover}
			ondrop={(e) => drop(e, i)}
			onkeydown={(e) => key(e, i)}
			>{v}<button type="button" class="x" tabindex="-1" aria-label="Remove {v}" onclick={() => remove(i)}>×</button></span
		>
	{/each}
	<input
		bind:value={text}
		{list}
		{placeholder}
		aria-label="Add to {label}"
		class:claimed={target.label === label}
		onfocus={claim}
		onchange={commit}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ',') (e.preventDefault(), commit());
			else if (e.key === 'Backspace' && !text && values.length) remove(values.length - 1);
		}}
	/>
</div>
{#if name}
	{#each values as v (v)}<input type="hidden" {name} value={v} />{/each}
	<input type="hidden" name="_sent" value={name} />
{/if}

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		min-height: 2.2rem;
		padding: 3px;
		border: 1px solid var(--rule);
		background: #fff;
	}
	.chips:focus-within {
		border-color: var(--blood);
		box-shadow: 0 0 0 1px var(--blood);
	}
	.chips.over {
		outline: 2px dashed var(--blood);
		outline-offset: 2px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 1px 2px 1px 7px;
		border: 1px solid var(--rule);
		background: var(--parchment);
		font-size: 0.85rem;
		line-height: 1.5;
		cursor: grab;
		user-select: none;
	}
	.chip:focus-visible {
		outline: 2px solid var(--blood);
		outline-offset: 0;
	}
	.x {
		padding: 0 5px;
		border: 0;
		background: transparent;
		color: var(--muted);
		font-size: 1rem;
		line-height: 1;
		letter-spacing: 0;
	}
	.x:hover {
		background: transparent;
		color: var(--blood);
	}
	input {
		flex: 1 1 7rem;
		min-width: 6rem;
		border: 0;
		padding: 3px 4px;
		box-shadow: none !important;
	}
	input.claimed::placeholder {
		color: var(--blood);
	}
</style>

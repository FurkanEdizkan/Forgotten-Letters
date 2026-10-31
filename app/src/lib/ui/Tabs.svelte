<!--
  Square tabs for work surfaces inside the shell (the campaign manage page): labels in the label style, a count
  after each, the active tab marked by a blood-bright bar under a bone label. Keyboard as WAI-ARIA tabs: arrow keys
  move and select, Home and End jump. Segmented.svelte stays the rounded control of the first-run pages.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tab = { id: string; label: string; count?: number };
	type Props = {
		label: string;
		tabs: Tab[];
		value: string;
		panel: Snippet<[string]>;
	};
	let { label, tabs, value = $bindable(), panel }: Props = $props();

	const uid = $props.id();
	let buttons: HTMLButtonElement[] = $state([]);

	function onkeydown(e: KeyboardEvent, i: number) {
		const n = tabs.length;
		const to: Record<string, number> = {
			ArrowRight: (i + 1) % n,
			ArrowLeft: (i - 1 + n) % n,
			Home: 0,
			End: n - 1
		};
		const target = to[e.key];
		const t = target === undefined ? undefined : tabs[target];
		if (!t) return;
		e.preventDefault();
		value = t.id;
		buttons[target!]?.focus();
	}
</script>

<div class="tabs" role="tablist" aria-label={label}>
	{#each tabs as t, i (t.id)}
		<button
			bind:this={buttons[i]}
			type="button"
			role="tab"
			id="tab-{t.id}-{uid}"
			aria-selected={t.id === value}
			aria-controls="panel-{uid}"
			tabindex={t.id === value ? 0 : -1}
			onclick={() => (value = t.id)}
			onkeydown={(e) => onkeydown(e, i)}
			>{t.label}{#if t.count !== undefined}<span class="n data">{t.count}</span>{/if}</button
		>
	{/each}
</div>
<div class="panel" role="tabpanel" id="panel-{uid}" aria-labelledby="tab-{value}-{uid}">
	{@render panel(value)}
</div>

<style>
	.tabs {
		display: flex;
		gap: var(--space-1);
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	button {
		padding: var(--space-2) var(--space-4);
		border: 0;
		border-bottom: var(--border-card-top) solid transparent;
		margin-bottom: -1px;
		background: transparent;
		color: var(--bone-dim);
		font-family: var(--font-body);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		cursor: pointer;
		transition:
			color var(--duration-fast) var(--easing),
			border-color var(--duration-fast) var(--easing);
	}
	button:hover {
		color: var(--bone);
	}
	button[aria-selected='true'] {
		color: var(--bone);
		border-bottom-color: var(--blood-bright);
	}
	.n {
		margin-left: var(--space-2);
		font-weight: 400;
		color: var(--bone-dim);
	}
	.panel {
		display: grid;
		gap: var(--space-5);
		padding-top: var(--space-5);
	}
</style>

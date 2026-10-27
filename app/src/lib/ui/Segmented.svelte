<!--
  Segmented tabs: a tablist that switches between panels in place. Pass the tabs and a `panel` snippet that renders
  the panel of the selected tab. Keyboard as WAI-ARIA tabs: arrow keys move and select, Home and End jump.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tab = { id: string; label: string; disabled?: boolean };
	type Props = {
		label: string;
		tabs: Tab[];
		value: string;
		onchange?: (id: string) => void;
		panel?: Snippet<[string]>;
	};
	let { label, tabs, value = $bindable(), onchange, panel }: Props = $props();

	const uid = $props.id();
	let buttons: HTMLButtonElement[] = $state([]);

	function select(i: number, focus = false) {
		const t = tabs[i];
		if (!t || t.disabled) return;
		value = t.id;
		onchange?.(t.id);
		if (focus) buttons[i]?.focus();
	}

	function onkeydown(e: KeyboardEvent, i: number) {
		const n = tabs.length;
		const to: Record<string, number> = {
			ArrowRight: (i + 1) % n,
			ArrowLeft: (i - 1 + n) % n,
			Home: 0,
			End: n - 1
		};
		const target = to[e.key];
		if (target !== undefined) {
			e.preventDefault();
			select(target, true);
		}
	}
</script>

<div class="seg" role="tablist" aria-label={label}>
	{#each tabs as t, i (t.id)}
		<button
			bind:this={buttons[i]}
			type="button"
			role="tab"
			id="tab-{t.id}-{uid}"
			aria-selected={t.id === value}
			aria-controls={panel ? `panel-${uid}` : undefined}
			tabindex={t.id === value ? 0 : -1}
			disabled={t.disabled}
			onclick={() => select(i)}
			onkeydown={(e) => onkeydown(e, i)}>{t.label}</button
		>
	{/each}
</div>
{#if panel}
	<div class="panel" role="tabpanel" id="panel-{uid}" aria-labelledby="tab-{value}-{uid}">
		{@render panel(value)}
	</div>
{/if}

<style>
	.seg {
		display: inline-grid;
		grid-auto-flow: column;
		justify-self: start;
		gap: 0.2em;
		padding: 0.2em;
		border-radius: 0.55em;
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule);
	}
	button {
		padding: 0.35em 0.9em;
		border: 0;
		border-radius: 0.4em;
		background: transparent;
		color: var(--bone-dim);
		font-family: var(--font-body);
		font-size: var(--size-label);
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--easing),
			color var(--duration-fast) var(--easing);
	}
	button:hover {
		color: var(--bone);
	}
	button:active {
		background: var(--panel-hover);
	}
	button[aria-selected='true'] {
		background: var(--panel-raised);
		color: var(--bone);
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.5),
			inset 0 1px 0 rgb(255 255 255 / 0.06);
	}
	button:focus-visible {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: 1px;
	}
	button:disabled {
		color: var(--bone-faint);
		cursor: not-allowed;
	}
	.panel {
		display: grid;
		gap: var(--space-4);
	}
</style>

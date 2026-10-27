<!--
  A liquid-glass button (glass.css), or a link styled as one when `href` is given. Variants: default, primary (accent
  tinted, one per area), ghost (Back and second actions), icon and round-icon (icon only: pass `label`, which becomes
  the accessible name and the tooltip).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import './glass.css';

	type Props = HTMLButtonAttributes & {
		variant?: 'default' | 'primary' | 'ghost' | 'icon' | 'round-icon';
		href?: string;
		/** Accessible name and tooltip; required for the icon variants. */
		label?: string;
		/** Shows the error state (for a button whose action failed). */
		invalid?: boolean;
		/** A link that leaves the app opens in a new tab. */
		external?: boolean;
		el?: HTMLElement | null;
		children: Snippet;
	};

	let {
		variant = 'default',
		href,
		label,
		invalid = false,
		external = false,
		el = $bindable(null),
		children,
		type = 'button',
		class: cls = '',
		disabled,
		...rest
	}: Props = $props();

	const iconOnly = $derived(variant === 'icon' || variant === 'round-icon');
	const classes = $derived(['glass', variant, invalid && 'invalid', cls].filter(Boolean).join(' '));

	// The highlight follows the pointer: cheap, no layout, and only while hovering.
	function track(e: PointerEvent) {
		const t = e.currentTarget as HTMLElement;
		const r = t.getBoundingClientRect();
		t.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
		t.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
	}
</script>

{#if href && !disabled}
	<a
		bind:this={el}
		class={classes}
		{href}
		aria-label={iconOnly ? label : undefined}
		title={iconOnly ? label : undefined}
		target={external ? '_blank' : undefined}
		rel={external ? 'noopener noreferrer' : undefined}
		onpointermove={track}
		onclick={rest.onclick as ((e: MouseEvent) => void) | undefined}
	>
		{@render children()}
	</a>
{:else}
	<button
		bind:this={el}
		class={classes}
		{type}
		{disabled}
		aria-label={iconOnly ? label : undefined}
		title={iconOnly ? label : undefined}
		onpointermove={track}
		{...rest}
	>
		{@render children()}
	</button>
{/if}

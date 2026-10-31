<!--
  The first-run split for the visitor link pages (/join and /invite, decision 48): the emblem in the dark well on
  the left, the page in a column on the right, entering as the sign-in page does. Pages put glass buttons and
  wizard fields inside.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import SplitStage, { SPLIT } from './SplitStage.svelte';
	import { emblemIn, entrance } from './motion';

	let { children }: { children: Snippet } = $props();
	let emblem: HTMLElement | null = $state(null);
	let col: HTMLElement | null = $state(null);

	onMount(() => {
		emblemIn(emblem);
		if (col) entrance(Array.from(col.children), { delay: 150, gap: 50 });
	});
</script>

<SplitStage split={SPLIT.welcome} bind:emblem>
	<main class="field">
		<div class="col" bind:this={col}>{@render children()}</div>
	</main>
</SplitStage>

<style>
	.field {
		display: grid;
		align-items: center;
		min-height: 100vh;
		min-height: 100dvh;
		padding: var(--space-6) 9% var(--space-6) 8%;
	}
	.col {
		display: grid;
		gap: var(--space-5);
		width: 100%;
		max-width: 30rem;
	}
</style>

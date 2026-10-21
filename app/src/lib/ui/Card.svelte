<!-- A card: panel with a 3px blood top edge and a title. Without `edge` it is a plain panel. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { title?: string; edge?: boolean; children: Snippet };
	let { title, edge = true, children }: Props = $props();
</script>

<section class="card" class:edge>
	{#if title}<h3>{title}</h3>{/if}
	{@render children()}
</section>

<style>
	.card {
		display: grid;
		gap: var(--space-4);
		align-content: start;
		padding: var(--space-4);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
	}
	.edge {
		border-top: var(--border-card-top) solid var(--blood);
	}
	h3 {
		border-bottom: 0;
		padding: 0;
	}
</style>

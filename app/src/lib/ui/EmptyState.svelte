<!-- What will appear here and how to add the first one; an optional action below. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { text: string; children?: Snippet };
	let { text, children }: Props = $props();
</script>

<div class="empty">
	<p>{text}</p>
	{#if children}{@render children()}{/if}
</div>

<style>
	.empty {
		display: grid;
		gap: var(--space-3);
		justify-items: start;
		padding: var(--space-5) var(--space-4);
		border-bottom: var(--border-hairline) solid var(--rule);
		color: var(--bone-dim);
		font-style: italic;
	}
</style>

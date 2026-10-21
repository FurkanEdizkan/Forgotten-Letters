<!-- A full-width blood band: section name left, a count and actions right. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { title: string; count?: number; actions?: Snippet };
	let { title, count, actions }: Props = $props();
</script>

<div class="band">
	<span class="title">{title}</span>
	{#if count !== undefined}<span class="count data">{count}</span>{/if}
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.band {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		background: var(--blood);
		color: var(--bone);
	}
	.title {
		font-weight: 700;
		letter-spacing: var(--track-title);
		text-transform: uppercase;
		flex: 1;
	}
	.count {
		font-weight: 700;
	}
	.actions {
		display: flex;
		gap: var(--space-2);
	}
</style>

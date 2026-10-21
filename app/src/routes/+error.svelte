<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/messages';
	import Button from '#lib/ui/Button.svelte';

	const message = $derived(
		page.error?.message &&
			page.error.message !== 'Internal Error' &&
			page.error.message !== 'Not Found'
			? page.error.message
			: (m.errors.byStatus[page.status] ?? m.errors.byStatus[500])
	);
</script>

<svelte:head><title>{page.status} · {m.app.name}</title></svelte:head>

<main>
	<p class="status data">{page.status}</p>
	<h2>{m.errors.title}</h2>
	<p>{message}</p>
	{#if page.error?.requestId}
		<p class="dim">
			{m.errors.requestId}: <code>{page.error.requestId}</code>. {m.errors.quote}
		</p>
	{/if}
	<div><Button href="/">{m.errors.back}</Button></div>
</main>

<style>
	main {
		min-height: calc(100vh - 64px);
		display: grid;
		align-content: center;
		justify-items: start;
		gap: var(--space-4);
		max-width: var(--column);
		margin: 0 auto;
		padding: var(--space-7) var(--gutter);
	}
	.status {
		font-family: var(--font-display);
		font-size: var(--size-display);
		letter-spacing: var(--track-display);
		color: var(--bone-dim);
		line-height: 1;
	}
</style>

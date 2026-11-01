<script lang="ts">
	import { m } from '#lib/messages';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{m.rules.title} · {m.app.name}</title></svelte:head>

<h1>{m.rules.title}</h1>
<EmptyState text={m.rules.noSets}>
	{#if data.owner}<Button href="/owner/rules" kind="primary">{m.rules.ownerLink}</Button>{/if}
</EmptyState>

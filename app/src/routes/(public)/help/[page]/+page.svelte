<script lang="ts">
	import { m } from '#lib/messages';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{data.title} · {m.app.name}</title></svelte:head>

<h1>{data.title}</h1>
<section class="help">
	<EmptyState text={m.help.coming}>
		{#if data.note}<p class="note">{data.note}</p>{/if}
	</EmptyState>
</section>

<style>
	.help {
		max-width: var(--measure);
	}
	.note {
		color: var(--bone);
		font-style: normal;
	}
</style>

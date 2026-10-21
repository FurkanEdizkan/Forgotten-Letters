<!-- A date and time, shown in the viewer's time zone once the page runs in the browser. -->
<script lang="ts">
	import { onMount } from 'svelte';

	let { at, fallback = '' }: { at: Date | string | null; fallback?: string } = $props();

	const date = $derived(at ? new Date(at) : null);
	let local = $state(false);
	onMount(() => (local = true));

	const fmt = (d: Date) =>
		local
			? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
			: d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
</script>

{#if date}<time datetime={date.toISOString()}>{fmt(date)}</time>{:else}{fallback}{/if}

<script lang="ts">
	import { m } from '#lib/messages';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{m.home.title} · {m.app.name}</title></svelte:head>

<h1>{m.home.title}</h1>
<section>
	<h2>{m.home.heading}</h2>
	<p>{m.home.signedInAs(data.me.displayName)}</p>
	<p class="dim">{m.home.later}</p>
	<p class="dim"><a href="/account">{m.home.account}</a></p>
</section>

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
</style>

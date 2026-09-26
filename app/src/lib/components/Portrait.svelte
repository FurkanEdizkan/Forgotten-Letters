<script lang="ts">
	let {
		name,
		portrait = null,
		symbol = null,
		size = 56
	}: { name: string; portrait?: string | null; symbol?: string | null; size?: number } = $props();

	const initials = $derived(
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join('')
	);
</script>

<span class="portrait" style:--size="{size}px" title={name}>
	{#if portrait}
		<img src={portrait} alt="" />
	{:else}
		<span class="initials">{initials}</span>
	{/if}
	{#if symbol}
		<img class="symbol" src={symbol} alt="" />
	{/if}
</span>

<style>
	.portrait {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		flex: none;
		border-radius: 50%;
		border: 2px solid var(--ink);
		background: var(--parchment);
		box-shadow: 0 0 0 2px var(--rule);
	}
	.portrait > img:first-child {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}
	.initials {
		font-family: var(--font-display);
		font-size: calc(var(--size) * 0.42);
		color: var(--blood);
	}
	.symbol {
		position: absolute;
		right: -6%;
		bottom: -6%;
		width: 42%;
		height: 42%;
		border-radius: 50%;
		border: 1.5px solid var(--ink);
		background: var(--paper);
		object-fit: cover;
	}
</style>

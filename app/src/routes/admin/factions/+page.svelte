<script lang="ts">
	import ModelStudio from '$lib/components/ModelStudio.svelte';
	import { outpostFrame } from '$lib/models';

	let { data } = $props();

	// Stock outpost frames: a 4-column sheet of 128 px cells, shown at half size.
	const frameStyle = (faction: string) => {
		const i = Number(outpostFrame(faction).slice(-2));
		return `background-position: -${(i % 4) * 64}px -${Math.floor(i / 4) * 64}px`;
	};
</script>

<h1>Factions</h1>
<p class="lede">
	Default map models per faction. A warband's own upload (on its page) wins over these; without either, outposts use
	the stock redoubt shown here and warbands show their portrait.
</p>

{#each data.factions as f (f.id)}
	<section>
		<div class="title">
			<span class="stock" style={frameStyle(f.id)} title="Stock outpost"></span>
			<h2>{f.name}</h2>
		</div>
		<ModelStudio kind="outpost" ownerType="faction" ownerId={f.id} title="Outpost" current={f.outpost} fallback="the stock redoubt" />
		<ModelStudio kind="figure" ownerType="faction" ownerId={f.id} title="Figure" current={f.figure} fallback="each warband's portrait" />
	</section>
{/each}

<style>
	.lede {
		color: var(--muted);
		max-width: 44rem;
	}
	section {
		margin-top: 18px;
		padding: 12px 18px;
		border: 1px solid var(--rule);
		background: var(--parchment);
	}
	.title {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	h2 {
		margin: 0;
	}
	.stock {
		width: 64px;
		height: 64px;
		background-image: url('/fx/outposts.webp');
		background-size: 256px 128px;
		flex: none;
	}
</style>

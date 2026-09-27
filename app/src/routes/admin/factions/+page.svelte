<script lang="ts">
	import Seal from '$lib/components/Seal.svelte';
	import ModelStudio from '$lib/components/ModelStudio.svelte';
	import { outpostFrame } from '$lib/models';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const submit = (e: Event) => (e.currentTarget as HTMLInputElement).form?.requestSubmit();

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
			<Seal faction={f.id} size={72} label="{f.name} seal" />
			<span class="stock" style={frameStyle(f.id)} title="Stock outpost"></span>
			<h2>{f.name}</h2>
		</div>
		<ModelStudio kind="outpost" ownerType="faction" ownerId={f.id} title="Outpost" current={f.outpost} fallback="the stock redoubt" />
		<ModelStudio kind="figure" ownerType="faction" ownerId={f.id} title="Figure" current={f.figure} fallback="each warband's portrait" />

		<h3>Unit pictures</h3>
		<p class="note">The default picture for every model of a type, on unit cards. A player can still give one model its own.</p>
		<div class="units">
			{#each f.units as u (u.key)}
				<div class="unit">
					<div class="pic">
						{#if u.image}<img src={u.image} alt={u.type} />{:else}<span>No picture</span>{/if}
					</div>
					<strong>{u.type}</strong>
					<div class="tools">
						<form method="POST" action="?/art" enctype="multipart/form-data" use:enhance>
							<input type="hidden" name="faction" value={f.id} />
							<input type="hidden" name="type" value={u.type} />
							<label class="file">{u.image ? 'Replace' : 'Add'}<input type="file" name="image" accept="image/png,image/jpeg,image/webp" onchange={submit} /></label>
						</form>
						{#if u.image}
							<form method="POST" action="?/artRemove" use:enhance>
								<input type="hidden" name="faction" value={f.id} />
								<input type="hidden" name="key" value={u.key} />
								<button class="ghost small">Remove</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
			<form class="unit add" method="POST" action="?/art" enctype="multipart/form-data" use:enhance>
				<input type="hidden" name="faction" value={f.id} />
				<label>Another unit type <input name="type" placeholder="e.g. Trench Pilgrim" /></label>
				<label class="file">Choose picture<input type="file" name="image" accept="image/png,image/jpeg,image/webp" onchange={submit} /></label>
			</form>
		</div>
		{#if form?.faction === f.id && form?.artMessage}<p class="error">{form.artMessage}</p>{/if}
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
	.note {
		margin: 0 0 8px;
		color: var(--muted);
	}
	.units {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 12px;
	}
	.unit {
		display: grid;
		gap: 6px;
		align-content: start;
		font-size: 0.9rem;
	}
	.pic {
		aspect-ratio: 4 / 3;
		display: grid;
		place-items: center;
		background: radial-gradient(circle at 50% 40%, #2a261d, var(--night) 75%);
		border: 1px solid var(--ink);
		overflow: hidden;
		color: var(--bone-dim);
		font-size: 0.8rem;
	}
	.pic img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 25%;
	}
	.tools {
		display: flex;
		gap: 6px;
	}
	.file {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: 3px 10px;
		border: 1px solid var(--ink);
		background: var(--ink);
		color: var(--paper);
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		cursor: pointer;
	}
	.file:hover {
		background: var(--blood);
		border-color: var(--blood);
	}
	.file input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.small {
		padding: 3px 10px;
		font-size: 0.75rem;
	}
	.add {
		padding: 8px;
		border: 1px solid var(--rule);
	}
	.add label:not(.file) {
		display: grid;
		gap: 2px;
	}
	.add input:not([type='file']) {
		width: 100%;
	}
	.error {
		color: var(--blood);
	}
	.stock {
		width: 64px;
		height: 64px;
		background-image: url('/fx/outposts.webp');
		background-size: 256px 128px;
		flex: none;
	}
</style>

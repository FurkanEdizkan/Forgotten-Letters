<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { renderMarkdown } from '$lib/markdown';

	let { data, form } = $props();

	// svelte-ignore state_referenced_locally
	let text = $state(data.lore.lore);
	$effect(() => {
		text = data.lore.lore;
	});
	const preview = $derived(renderMarkdown(text));
	const selectedZone = $derived(data.zones.find((z) => z.id === data.selected));
</script>

<h1>Lore</h1>
<p class="muted">
	Every zone's lore page shows this text. House zones start with the Player's Guide text; book zones can be imported from
	your own copy of the book (<code>python3 app/scripts/import-lore.py</code>) or written here. Supports **bold**, *italic*,
	# headings, - lists and &gt; quotes.
</p>

<div class="layout">
	<nav>
		{#each data.zones as z (z.id)}
			<button type="button" class:active={z.id === data.selected} onclick={() => goto(`?zone=${z.id}`, { keepFocus: true, noScroll: true })}>
				<span>{z.name}</span>
				<small class="st-{z.status}">{z.status === 'written' ? 'written' : z.status === 'guide' ? 'guide' : '—'}</small>
			</button>
		{/each}
	</nav>

	<section>
		<h2>{selectedZone?.name}</h2>
		<form method="POST" action="?/save" enctype="multipart/form-data" use:enhance={() => ({ update }) => update({ reset: false })}>
			<input type="hidden" name="zone" value={data.selected} />
			<textarea name="lore" rows="14" bind:value={text} placeholder="Write the lore of this place…"></textarea>
			<div class="row">
				<label>Illustration <input type="file" name="image" accept="image/*" /></label>
				{#if data.lore.image}<label class="check"><input type="checkbox" name="clearImage" /> Remove current image</label>{/if}
			</div>
			<div class="row">
				<button>Save lore</button>
				<a href="/zones/{data.selected}" target="_blank" rel="noopener">View page <Mark name="external" size="0.8em" /></a>
				{#if form && 'saved' in form}<span class="ok">Recorded.</span>{/if}
				{#if form && 'message' in form}<span class="error">{form.message}</span>{/if}
			</div>
		</form>
		<h3>Preview</h3>
		<div class="preview">
			{#if data.lore.image}<img src={data.lore.image} alt="" />{/if}
			{@html preview}
		</div>
	</section>
</div>

<section class="import">
	<h2>Import lore</h2>
	<p class="muted">A JSON file of <code>{'{ "zone-id": "lore text", … }'}</code>, e.g. from <code>import-lore.py</code>. Existing lore for those zones is replaced.</p>
	<form method="POST" action="?/import" enctype="multipart/form-data" use:enhance>
		<input type="file" name="file" accept="application/json,.json" required />
		<button>Import</button>
		{#if form && 'imported' in form}<span class="ok">Imported lore for {form.imported} zone{form.imported === 1 ? '' : 's'}.</span>{/if}
	</form>
</section>

<style>
	.layout {
		display: grid;
		grid-template-columns: 16rem minmax(0, 1fr);
		gap: 18px;
	}
	@media (max-width: 44rem) {
		.layout {
			grid-template-columns: 1fr;
		}
		nav {
			max-height: 14rem;
		}
	}
	nav {
		display: grid;
		gap: 2px;
		align-content: start;
		max-height: 70vh;
		overflow-y: auto;
		border: 1px solid var(--rule);
		background: var(--parchment);
	}
	nav button {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 5px 10px;
		background: transparent;
		color: var(--ink);
		border: none;
		text-align: left;
		font-variant-caps: normal;
		letter-spacing: 0;
	}
	nav button.active,
	nav button:hover {
		background: var(--paper);
		color: var(--blood);
	}
	.st-written {
		color: var(--supplies);
	}
	.st-guide {
		color: var(--territories);
	}
	.st-empty {
		color: var(--muted);
	}
	section h2 {
		margin-top: 0;
	}
	form {
		display: grid;
		gap: 10px;
	}
	textarea {
		width: 100%;
		font-size: 1rem;
		line-height: 1.5;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
	}
	label {
		display: grid;
		gap: 4px;
	}
	.check {
		display: flex;
		gap: 6px;
	}
	.preview {
		padding: 10px 14px;
		border: 1px solid var(--rule);
		background: var(--paper);
	}
	.preview img {
		max-width: 100%;
	}
	.import {
		margin-top: 28px;
		padding: 14px 18px;
		border: 1px solid var(--rule);
		background: var(--parchment);
	}
	.import form {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.muted {
		color: var(--muted);
	}
	.ok {
		color: var(--supplies);
	}
	.error {
		color: var(--blood);
	}
</style>

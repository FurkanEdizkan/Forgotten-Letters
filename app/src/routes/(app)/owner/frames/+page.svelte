<!--
  Owner → Card frames (step 4 revision 3): every faction with its variants and Sins under it, the frame each has
  (its own, its faction's, or the built-in one), Upload/Replace and Remove per row, and the template to draw over.
-->
<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Time from '#lib/ui/Time.svelte';
	import { drawTemplate, save, toPng } from '#lib/ui/cards/draw';
	import { CARD_HEIGHT, CARD_WIDTH } from '#lib/ui/cards/layout';
	import { resultOf } from '#lib/ui/form-result';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = m.owner.frames;
	const nameOf = $derived(new Map(data.targets.map((x) => [x.id, x.name])));

	async function template() {
		const c = document.createElement('canvas');
		c.width = CARD_WIDTH;
		c.height = CARD_HEIGHT;
		const ctx = c.getContext('2d');
		if (!ctx) return;
		drawTemplate(ctx, { band: t.templateBand, photo: t.templatePhoto, text: t.templateText });
		save(await toPng(c), 'frame-template.png');
	}
</script>

<svelte:head><title>{t.heading} · {m.app.name}</title></svelte:head>

<section>
	<div class="top">
		<div>
			<h2>{t.heading}</h2>
			<p class="dim intro">{t.intro}</p>
		</div>
		<Button icon={Download} onclick={template}>{t.template}</Button>
	</div>
	{#if form?.op === 'upload'}<Message>{t.saved}</Message>{/if}
	{#if form?.op === 'remove'}<Message>{t.removed}</Message>{/if}
	{#if data.targets.length}
		<table class="table">
			<thead>
				<tr>
					<th scope="col">{t.target}</th>
					<th scope="col">{t.frame}</th>
					<th scope="col"><span class="visually-hidden">{t.upload}</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.targets as x (x.id)}
					{@const up = resultOf(form, 'upload', x.id)}
					{@const rm = resultOf(form, 'remove', x.id)}
					<tr data-target={x.id} class:sub={x.kind !== 'faction'}>
						<td>
							{x.kind !== 'faction' ? '↳ ' : ''}{x.name}
							{#if t.kinds[x.kind]}<span class="dim">({t.kinds[x.kind]})</span>{/if}
						</td>
						<td>
							{#if x.frame}
								<img class="thumb" src={x.frame.url} alt="" />
								{t.uploaded}
								<Time at={x.frame.updatedAt} />
							{:else if x.faction && nameOf.get(x.faction)}
								<span class="dim">{t.usesFaction(nameOf.get(x.faction) ?? '')}</span>
							{:else}
								<span class="dim">{t.builtIn}</span>
							{/if}
							{#if up.error || rm.error}<p class="err" role="alert">{up.error ?? rm.error}</p>{/if}
						</td>
						<td>
							<div class="acts">
								<form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance>
									<input type="hidden" name="op" value="upload" />
									<input type="hidden" name="id" value={x.id} />
									<input type="hidden" name="target" value={x.id} />
									<label class="up">
										<input
											class="visually-hidden"
											type="file"
											name="image"
											accept="image/png"
											aria-label={t.pick(x.name)}
											onchange={(e) => e.currentTarget.form?.requestSubmit()}
										/>
										{x.frame ? t.replace : t.upload}
									</label>
								</form>
								{#if x.frame}
									<form method="POST" action="?/remove" use:enhance>
										<input type="hidden" name="op" value="remove" />
										<input type="hidden" name="id" value={x.id} />
										<input type="hidden" name="target" value={x.id} />
										<button class="link" type="submit">{t.remove}</button>
									</form>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<EmptyState text={t.empty} />
	{/if}
</section>

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: var(--space-4);
	}
	.intro {
		max-width: 60ch;
	}
	tr.sub td:first-child {
		padding-left: var(--space-5);
	}
	.thumb {
		width: 1.6rem;
		aspect-ratio: 4 / 5;
		vertical-align: middle;
		margin-right: var(--space-2);
		border: var(--border-hairline) solid var(--rule-strong);
	}
	.acts {
		display: flex;
		gap: var(--space-3);
		justify-content: end;
		white-space: nowrap;
	}
	label.up,
	.link {
		color: var(--blood-pale);
		cursor: pointer;
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		text-decoration: underline;
	}
	label.up:focus-within {
		outline: var(--border-focus, 2px) solid var(--blood-bright);
	}
	.err {
		margin: var(--space-1) 0 0;
		color: var(--danger);
	}
</style>

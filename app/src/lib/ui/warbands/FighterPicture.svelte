<!--
  A fighter's picture slot (empty until a picture is added): PNG, JPEG or WebP up to 2 MB, uploaded as soon as it is
  picked, with Change and Remove for its owner, and the refusal under it. Card opens the fighter's card for anyone
  who can see the warband (?card=<fighter>).
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import IdCard from '@lucide/svelte/icons/id-card';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import { m } from '#lib/messages';
	import type { ApiFighter } from '#lib/schemas/warbands';
	import { resultOf, type FormResult } from '#lib/ui/form-result';

	type Props = { fighter: ApiFighter; canEdit: boolean; form: FormResult };
	let { fighter: x, canEdit, form }: Props = $props();
	const b = m.warbands.builder;
	const title = $derived(x.name ?? x.unitName);
	const image = $derived(resultOf(form, 'image', x.id));
	let file: HTMLInputElement | undefined = $state();
</script>

<div class="pic">
	{#if x.image}
		<img src={x.image} alt={b.image(title)} />
	{:else}
		<div class="slot" aria-hidden="true"><ImagePlus size={26} strokeWidth={1.25} /></div>
	{/if}
	<a class="card" href="?sel={x.id}&card={x.id}" data-sveltekit-noscroll
		><IdCard size={16} aria-hidden={true} />{m.warbands.cards.open}</a
	>
	{#if canEdit}
		<form
			method="POST"
			action="?/image"
			enctype="multipart/form-data"
			use:enhance={() =>
				({ update }) =>
					update({ reset: true })}
		>
			<input type="hidden" name="op" value="image" />
			<input type="hidden" name="id" value={x.id} />
			<input type="hidden" name="fid" value={x.id} />
			<label class="up">
				<input
					bind:this={file}
					class="visually-hidden"
					type="file"
					name="image"
					accept="image/png,image/jpeg,image/webp"
					onchange={() => file?.form?.requestSubmit()}
				/>
				{x.image ? b.replace : b.upload}
			</label>
		</form>
		{#if x.image}
			<form method="POST" action="?/clearImage" use:enhance>
				<input type="hidden" name="op" value="clearImage" />
				<input type="hidden" name="id" value={x.id} />
				<input type="hidden" name="fid" value={x.id} />
				<button class="link" type="submit">{b.clearImage}</button>
			</form>
		{/if}
	{/if}
</div>
{#if image.error}<p class="err" role="alert">{image.error}</p>{/if}

<style>
	.pic {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		justify-items: center;
		font-size: var(--size-label);
	}
	.pic img,
	.slot {
		width: 7rem;
		aspect-ratio: 3 / 4;
		object-fit: cover;
		border: var(--border-hairline) solid var(--rule-strong);
	}
	.slot {
		display: grid;
		place-items: center;
		border-style: dashed;
		background: var(--inset);
		color: var(--bone-faint);
	}
	.card {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--bone);
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
	.err {
		margin: 0;
		color: var(--danger);
	}
</style>

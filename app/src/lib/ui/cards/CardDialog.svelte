<!--
  A fighter's card in a dialog, from the fighter panel's Card link (?card=<fighter>): the card as it will be saved,
  and Download PNG. Whoever can see the warband can open and save its cards.
-->
<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import { m } from '#lib/messages';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/warbands/Dialog.svelte';
	import type { ApiFighter, ApiWarband } from '#lib/schemas/warbands';
	import { save, toPng } from './draw';
	import FighterCardCanvas from './FighterCardCanvas.svelte';
	import { CARD_HEIGHT, CARD_WIDTH, cardData } from './layout';

	type Props = { warband: ApiWarband; fighter: ApiFighter; onclose: () => void };
	let { warband, fighter, onclose }: Props = $props();
	const t = m.warbands.cards;
	const card = $derived(cardData(warband, fighter, t.labels));
	let canvas: HTMLCanvasElement | undefined = $state();
	let ready = $state(false);
	let problem = $state('');

	const fileName = (s: string) =>
		`${
			s
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '') || 'fighter'
		}-card.png`;

	async function download() {
		problem = '';
		try {
			if (canvas) save(await toPng(canvas), fileName(card.name));
		} catch {
			problem = t.failed;
		}
	}
</script>

<Dialog title={card.name} {onclose} wide>
	<div class="body">
		<div class="card">
			<FighterCardCanvas
				{card}
				photo={fighter.image}
				frame={warband.frame}
				bind:canvas
				bind:ready
			/>
		</div>
		<div class="side">
			<p>{warband.frame ? t.groupFrame : t.builtInFrame}</p>
			<p class="dim">{t.size(CARD_WIDTH, CARD_HEIGHT)}</p>
			{#if !fighter.image}<p class="dim">{t.noPhoto}</p>{/if}
			<Button kind="primary" icon={Download} disabled={!ready} onclick={download}
				>{t.download}</Button
			>
			{#if problem}<p class="err" role="alert">{problem}</p>{/if}
		</div>
	</div>
</Dialog>

<style>
	.body {
		display: grid;
		grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
		gap: var(--space-4);
		padding: var(--space-4);
		align-items: start;
	}
	.side {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}
	.side p {
		margin: 0;
	}
	.err {
		color: var(--danger);
	}
</style>

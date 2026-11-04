<!--
  A fighter's card on a canvas (step 4 revision 3): drawn once the fonts, the photo and the frame are ready, and
  again when any of them changes. The canvas is the card that is saved; its text is also given to screen readers.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import { drawCard, fontsReady, loadImage } from './draw';
	import { CARD_HEIGHT, CARD_WIDTH, type CardData } from './layout';

	type Props = {
		card: CardData;
		photo: string | null;
		frame: string | null;
		canvas?: HTMLCanvasElement;
		ready?: boolean;
	};
	let { card, photo, frame, canvas = $bindable(), ready = $bindable(false) }: Props = $props();

	$effect(() => {
		const el = canvas;
		const [d, p, f] = [card, photo, frame];
		if (!el) return;
		let stale = false;
		ready = false;
		(async () => {
			const [, ph, fr] = await Promise.all([fontsReady(), loadImage(p), loadImage(f)]);
			if (stale) return;
			const ctx = el.getContext('2d');
			if (!ctx) return;
			drawCard(ctx, d, { photo: ph, frame: fr });
			ready = true;
		})();
		return () => {
			stale = true;
		};
	});
</script>

<canvas
	bind:this={canvas}
	width={CARD_WIDTH}
	height={CARD_HEIGHT}
	data-ready={ready ? '' : undefined}
	aria-hidden="true"
></canvas>
<div class="sr">
	<p>{card.name}</p>
	<p>{card.subtitle}</p>
	<p>
		{card.stats
			.map((s) => `${s.label} ${s.value}${s.was ? ` (${m.warbands.statChange.was(s.was)})` : ''}`)
			.join(', ')}
	</p>
	{#each card.rows as r (r.label)}<p>{r.label}: {r.value}</p>{/each}
</div>

<style>
	canvas {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 4 / 5;
		box-shadow: var(--shadow-overlay);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>

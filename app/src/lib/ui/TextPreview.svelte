<!--
  A preview card for the look settings: a heading, a meta line, a paragraph, a chip and a button, drawn in the
  current accent and scaled by `scale` (a text size in per cent), so the choice is visible before it is saved.
  Decorative: the controls carry the values, so the card is hidden from screen readers except for its label.
-->
<script lang="ts">
	type Props = {
		/** Text size in per cent, for example 110. */
		scale: number;
		label: string;
		title: string;
		meta: string;
		body: string;
		chip: string;
		button: string;
	};
	let { scale, label, title, meta, body, chip, button }: Props = $props();
</script>

<figure class="pv" style:--ts={scale / 100} aria-label={label}>
	<figcaption class="top"><span class="dot" aria-hidden="true"></span>{label}</figcaption>
	<div class="body" aria-hidden="true">
		<p class="title">{title}</p>
		<p class="meta">{meta}</p>
		<p class="text">{body}</p>
		<div class="row">
			<span class="chip">{chip}</span>
			<span class="btn">{button}</span>
		</div>
	</div>
</figure>

<style>
	.pv {
		--ts: 1;
		margin: 0;
		border-radius: 0.6em;
		border: var(--border-hairline) solid var(--rule);
		background: var(--panel);
		box-shadow:
			0 1px 0 rgb(255 255 255 / 0.04) inset,
			0 0.8em 2em -1em rgb(0 0 0 / 0.8);
		overflow: hidden;
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--border-hairline) solid var(--rule);
		background: var(--inset);
		color: var(--bone-dim);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
	.dot {
		width: 0.55em;
		height: 0.55em;
		border-radius: var(--radius-disc);
		background: var(--blood-bright);
	}
	/* Fixed height, faded at the foot: the card keeps its size while the text inside grows. */
	.body {
		height: 15rem;
		padding: var(--space-4);
		overflow: hidden;
		-webkit-mask-image: linear-gradient(#000 82%, transparent);
		mask-image: linear-gradient(#000 82%, transparent);
	}
	.body > * {
		transition: font-size var(--duration-fast) var(--easing);
	}
	.title {
		font-family: var(--font-heading);
		font-size: calc(1.6rem * var(--ts));
		line-height: 1.15;
		color: var(--blood-bright);
		text-wrap: balance;
	}
	.meta {
		margin-top: var(--space-1);
		font-size: calc(0.8rem * var(--ts));
		color: var(--bone-dim);
		font-variant-numeric: lining-nums;
	}
	.text {
		margin-top: var(--space-2);
		font-size: calc(1rem * var(--ts));
		line-height: 1.5;
		color: var(--bone);
		text-wrap: pretty;
	}
	.row {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin-top: var(--space-3);
		font-size: calc(0.85rem * var(--ts));
		transition: font-size var(--duration-fast) var(--easing);
	}
	.chip {
		padding: 0.15em 0.65em;
		border-radius: 1em;
		border: var(--border-hairline) solid color-mix(in srgb, var(--blood-bright) 50%, transparent);
		background: color-mix(in srgb, var(--blood) 18%, transparent);
		color: var(--bone);
	}
	.btn {
		padding: 0.35em 0.85em;
		border-radius: 0.4em;
		background: var(--blood);
		color: var(--bone);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
</style>

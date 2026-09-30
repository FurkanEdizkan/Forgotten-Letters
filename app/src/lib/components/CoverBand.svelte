<script lang="ts">
	import type { Snippet } from 'svelte';
	import Lockup from './Lockup.svelte';

	/**
	 * The door into the campaign (sign-in, invites): a full-screen backdrop — the slot for pictures from the
	 * campaign's history and heroes; the night for now — crossed by a half-transparent band that carries the lockup
	 * and whatever the page asks, with a way back to the map below it.
	 */
	let { title = 'Carcass Front', children }: { title?: string; children: Snippet } = $props();
</script>

<main class="cover">
	<div class="backdrop" aria-hidden="true"></div>
	<section class="band">
		<div class="inner">
			<Lockup name={title} />
			{@render children()}
		</div>
	</section>
	<a class="back" href="/">Back to the map</a>
</main>

<style>
	.cover {
		position: relative;
		display: grid;
		grid-template-rows: 1fr auto 1fr;
		min-height: 100vh;
		background: var(--night);
		color: var(--bone);
	}
	.backdrop {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 30%, var(--night-2), var(--night) 70%);
		background-size: cover;
		background-position: center;
	}
	.band {
		position: relative;
		grid-row: 2;
		padding: 28px 16px 30px;
		background: rgba(10, 9, 7, 0.6);
		border-block: 1px solid var(--blood);
	}
	.inner {
		display: grid;
		justify-items: center;
		gap: 18px;
		width: min(24rem, 100%);
		margin: 0 auto;
	}
	.inner :global(.lockup) {
		justify-items: center;
	}
	.inner :global(.lockup .name) {
		font-size: 2.6rem;
	}
	/* What the pages put on the band. */
	.inner :global(form) {
		display: grid;
		gap: 14px;
		width: 100%;
	}
	.inner :global(label) {
		display: grid;
		gap: 4px;
		font-weight: 600;
	}
	.inner :global(label.remember) {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 400;
	}
	/* The house button is night on night here: the map's blood fill makes it read on the band. */
	.inner :global(form button) {
		background: #8f1f18;
		color: var(--bone);
		border: 1px solid #b3261e;
	}
	.inner :global(form button:hover:not(:disabled)) {
		background: #a3170f;
	}
	.inner :global(.error) {
		margin: 0;
		color: var(--ember);
	}
	.inner :global(.hint) {
		margin: 0;
		font-size: 0.88rem;
		color: var(--bone-dim);
	}
	.inner :global(.sent) {
		margin: 0;
		text-align: center;
	}
	.back {
		position: relative;
		grid-row: 3;
		justify-self: center;
		align-self: start;
		margin-top: 18px;
		color: var(--bone-dim);
	}
	.back:hover {
		color: var(--bone);
	}
</style>

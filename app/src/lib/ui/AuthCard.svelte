<!--
  The sign-in card: centred on night with the blood glow behind it; panel with a 3px blood top edge. Frames the
  sign-in, setup and invite pages.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/messages';

	type Props = { subtitle: string; wide?: boolean; children: Snippet };
	let { subtitle, wide = false, children }: Props = $props();
</script>

<main class="stage">
	<div class="card" class:wide>
		<header>
			<h1>{m.app.name}</h1>
			<p class="sub">{subtitle}</p>
		</header>
		{@render children()}
	</div>
</main>

<style>
	.stage {
		min-height: calc(100vh - 64px);
		display: grid;
		place-items: center;
		padding: var(--space-7) var(--gutter);
		background: var(--glow-sign-in), var(--night);
	}
	.card {
		width: 100%;
		max-width: var(--auth-card);
		display: grid;
		gap: var(--space-4);
		padding: var(--space-5);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		border-top: var(--border-card-top) solid var(--blood);
	}
	.wide {
		max-width: 26rem;
	}
	header {
		display: grid;
		gap: var(--space-1);
	}
	h1 {
		font-size: 2.2rem;
	}
	.sub {
		color: var(--bone-dim);
	}
</style>

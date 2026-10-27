<!--
  The shape of a page while it loads: a title bar, a row of three cards and three lines of text, in the real
  sizes of the shell's pages, so the content replaces it in place. Announced once to screen readers.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import Skeleton from '../Skeleton.svelte';
</script>

<div class="page" role="status" aria-busy="true">
	<span class="visually-hidden">{m.shell.loading}</span>
	<Skeleton kind="title" />
	<div class="cards">
		<Skeleton kind="block" />
		<Skeleton kind="block" />
		<Skeleton kind="block" />
	</div>
	<div class="lines">
		<Skeleton width="70%" />
		<Skeleton width="55%" />
		<Skeleton width="62%" />
	</div>
</div>

<style>
	.page {
		display: grid;
		gap: var(--space-6);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--space-4);
	}
	.lines {
		display: grid;
		gap: var(--space-3);
		max-width: var(--measure);
	}
</style>

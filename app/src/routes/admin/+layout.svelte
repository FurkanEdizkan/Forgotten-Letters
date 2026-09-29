<script lang="ts">
	import NavPanel from '$lib/components/NavPanel.svelte';

	let { data, children } = $props();

	// svelte-ignore state_referenced_locally
	let navOpen = $state(data.navOpen);
</script>

{#if data.campaign !== undefined}
	<a class="skip" href="#main">Skip to content</a>
	<NavPanel bind:open={navOpen} title={data.campaign?.name ?? 'Campaign Master'} />
	<div class="shell" class:beside={navOpen}>
		<main id="main" tabindex="-1">
			{@render children()}
		</main>
	</div>
{/if}

<style>
	.skip {
		position: absolute;
		left: -9999px;
		z-index: 7;
		padding: 8px 14px;
		background: var(--night);
		color: var(--bone);
	}
	.skip:focus {
		left: 8px;
		top: 8px;
	}
	main:focus {
		outline: none;
	}
	/* Snaps rather than animates: see the note in the public layout. */
	/* With the panel shut the handle floats over the page: keep its corner clear. */
	.shell:not(.beside) {
		padding-top: 46px;
	}
	.shell.beside {
		padding-left: 17rem;
	}
	@media (max-width: 60rem) {
		.shell.beside {
			padding-left: 0;
		}
	}
	main {
		min-width: 0;
		max-width: 64rem;
		margin: 0 auto;
		padding: 28px clamp(16px, 4vw, 40px) 64px;
	}
</style>

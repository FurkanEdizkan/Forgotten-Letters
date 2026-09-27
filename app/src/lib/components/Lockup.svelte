<script lang="ts">
	import Mark from './Mark.svelte';

	/** The cover lockup: TRENCH ✠ CRUSADE over the campaign's name. */
	let { name, href = '/', compact = false }: { name: string; href?: string; compact?: boolean } = $props();
</script>

<a class="lockup" class:compact {href}>
	<span class="series">Trench <Mark name="cross" size="0.8em" /> Crusade</span>
	<span class="name">{name}</span>
</a>

<style>
	.lockup {
		display: inline-grid;
		justify-items: start;
		gap: 1px;
		color: var(--bone);
		text-decoration: none;
		line-height: 1;
	}
	.lockup:hover {
		color: #fff;
	}
	.series {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		font-family: var(--font-title);
		font-size: 0.78rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--bone-dim);
	}
	.series :global(.mark) {
		color: var(--blood-bright);
	}
	.name {
		font-family: var(--font-title);
		font-size: 1.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.compact .name {
		font-size: 1.25rem;
	}
	.compact .series {
		font-size: 0.66rem;
	}
</style>

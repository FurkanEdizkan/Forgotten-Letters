<!--
  A placeholder block in `panel-raised` that stands where content will be, in its real size, with a slow 1.6 s
  shimmer (DESIGN.md §7, Skeletons). Decorative: the surrounding region announces the loading once.
  Kinds: title (a heading bar), line (a line of text), block (a card). Width and height override the kind's size.
-->
<script lang="ts">
	type Props = { kind?: 'title' | 'line' | 'block'; width?: string; height?: string };
	let { kind = 'line', width, height }: Props = $props();
</script>

<span class="skeleton {kind}" style:width style:height aria-hidden="true"></span>

<style>
	.skeleton {
		display: block;
		background: linear-gradient(
			90deg,
			var(--panel-raised) 0%,
			var(--panel-hover) 50%,
			var(--panel-raised) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.6s ease-in-out infinite;
	}
	.title {
		width: 40%;
		height: 2.6rem;
	}
	.line {
		width: 100%;
		height: 0.9rem;
	}
	.block {
		width: 100%;
		height: 7rem;
	}
	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}
	/* Reduced motion: the blocks stand still. */
	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
			background: var(--panel-raised);
		}
	}
</style>

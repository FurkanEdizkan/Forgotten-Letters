<!-- A campaign's stage: a small dot and the word, outlined like the role badges (DESIGN.md §7, Stage badges). -->
<script lang="ts">
	import { m } from '#lib/messages';
	import type { Stage } from '#lib/campaign-stage';

	let { stage }: { stage: Stage } = $props();
</script>

<span class="badge {stage}">{m.campaigns.stages[stage]}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-2);
		border: var(--border-hairline) solid currentColor;
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		line-height: 1.6;
		white-space: nowrap;
	}
	.badge::before {
		content: '';
		width: 0.5em;
		height: 0.5em;
		border-radius: var(--radius-disc);
		background: currentColor;
	}
	.mustering {
		color: var(--warn);
	}
	.active {
		color: var(--ok);
	}
	.ended {
		color: var(--bone-dim);
	}
</style>

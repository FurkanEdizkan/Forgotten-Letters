<!--
  Your role in a campaign: CM, co-CM or Player, outlined and square. The CM's word is blood-pale with a
  blood-bright border, since blood-bright misses 4.5:1 at label size (DESIGN.md §7, Role badges).
-->
<script lang="ts">
	import { m } from '#lib/messages';

	let { role }: { role: 'cm' | 'co_cm' | 'player' } = $props();
</script>

<span class="badge {role}">{m.campaigns.roles[role]}</span>

<style>
	.badge {
		display: inline-block;
		padding: 0 var(--space-2);
		border: var(--border-hairline) solid currentColor;
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		line-height: 1.6;
		white-space: nowrap;
	}
	.cm {
		color: var(--blood-pale);
		border-color: var(--blood-bright);
	}
	.co_cm {
		color: var(--blood-pale);
		border-color: var(--rule-strong);
	}
	.player {
		color: var(--bone-dim);
	}
</style>

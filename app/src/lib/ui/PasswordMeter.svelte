<!--
  Live strength of a new password, under its field: four bars, the level name, and what is wrong while it is still
  too short, too common or too weak. Same rule as the server (`#lib/password-strength`): Strong or better is
  accepted. Silent until something is typed.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import { passwordProblem, passwordStrength, STRENGTH_NEEDED } from '#lib/password-strength';

	// While the field shows its own error, the meter shows only the bars and level, not the same sentence again.
	let { value = '', error = null }: { value?: string; error?: string | null } = $props();

	const level = $derived(passwordStrength(value));
	const problem = $derived(passwordProblem(value));
	const tone = $derived(level === 0 || level === 1 ? 'bad' : level === 2 ? 'fair' : 'good');
</script>

{#if value}
	<div class="meter {tone}" aria-live="polite">
		<div class="bars" aria-hidden="true">
			{#each [1, 2, 3, 4] as n (n)}<span class:on={level >= n}></span>{/each}
		</div>
		<p>
			<span class="level">{m.password.levels[level]}</span>
			{#if problem && !error}
				· {problem}
			{:else if !problem}
				· {m.password.accepted}
			{/if}
		</p>
		<p class="need">{m.password.needed(m.password.levels[STRENGTH_NEEDED])}</p>
	</div>
{/if}

<style>
	.meter {
		display: grid;
		gap: var(--space-1);
		margin-top: calc(var(--space-2) * -1);
		font-size: var(--size-label);
		color: var(--bone-dim);
	}
	.bars {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-1);
	}
	.bars span {
		height: 4px;
		background: var(--rule);
		transition: background-color var(--duration-fast) var(--easing);
	}
	.bad .on {
		background: var(--danger);
	}
	.fair .on {
		background: var(--warn);
	}
	.good .on {
		background: var(--ok);
	}
	p {
		margin: 0;
	}
	.level {
		color: var(--bone);
	}
	.need {
		color: var(--bone-faint);
	}
</style>

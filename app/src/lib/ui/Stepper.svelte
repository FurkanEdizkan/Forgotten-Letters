<!--
  The wizard's progress: one bar per step with a numbered disc and the step's name. Done steps are tinted, the
  current one is in the accent and carries aria-current="step". Not interactive: Back and Next move between steps.
-->
<script lang="ts">
	type Props = {
		steps: string[];
		/** Index of the current step, from 0. */
		current: number;
		/** Accessible name of the list, for example "Setup progress". */
		label: string;
		/** Spoken after a finished step's name, for example "done". */
		doneLabel?: string;
	};
	let { steps, current, label, doneLabel = 'done' }: Props = $props();
</script>

<ol class="stepper" aria-label={label}>
	{#each steps as name, i (name)}
		<li
			class:done={i < current}
			class:cur={i === current}
			aria-current={i === current ? 'step' : undefined}
		>
			<span class="disc" aria-hidden="true">{i + 1}</span>
			<span class="name"
				>{name}{#if i < current}<span class="visually-hidden">, {doneLabel}</span>{/if}</span
			>
		</li>
	{/each}
</ol>

<style>
	.stepper {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--size-label);
		color: var(--bone-faint);
	}
	li {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		transition: color var(--duration) var(--easing);
	}
	/* The bar above each step. */
	li::before {
		content: '';
		grid-column: 1 / -1;
		height: 3px;
		border-radius: 3px;
		background: var(--panel-raised);
		transition: background-color var(--duration) var(--easing);
	}
	.disc {
		display: grid;
		place-items: center;
		width: 1.6em;
		height: 1.6em;
		border-radius: var(--radius-disc);
		border: var(--border-hairline) solid var(--rule-strong);
		font-family: var(--font-mono);
		font-size: 0.9em;
		font-weight: 600;
		font-variant-numeric: lining-nums;
		transition:
			border-color var(--duration) var(--easing),
			background-color var(--duration) var(--easing);
	}
	.done {
		color: var(--bone-dim);
	}
	.done::before {
		background: color-mix(in srgb, var(--blood-bright) 40%, var(--panel-raised));
	}
	.done .disc {
		border-color: transparent;
		background: color-mix(in srgb, var(--blood-bright) 25%, transparent);
		color: var(--bone);
	}
	.cur {
		color: var(--bone);
		font-weight: 600;
	}
	.cur::before {
		background: var(--blood-bright);
	}
	.cur .disc {
		border-color: var(--blood-bright);
		color: var(--bone);
	}
</style>

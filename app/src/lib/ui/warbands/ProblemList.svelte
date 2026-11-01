<!--
  The warband's live problem list: every issue the engine finds in the list as it stands, errors first, or a green
  "No problems" when it is legal. In a campaign that allows going beyond limits every issue is a warning.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import type { ApiWarband } from '#lib/schemas/warbands';
	import Message from '#lib/ui/Message.svelte';

	type Props = { issues: ApiWarband['issues']; beyond: boolean };
	let { issues, beyond }: Props = $props();
	const b = m.warbands.builder;
	const sorted = $derived(
		[...issues].sort((x, y) => (x.severity === y.severity ? 0 : x.severity === 'error' ? -1 : 1))
	);
</script>

<section class="problems" aria-label={b.problems}>
	{#if !issues.length}
		<Message>{m.warbands.noProblems}</Message>
	{:else}
		<Message kind={issues.some((i) => i.severity === 'error') ? 'danger' : 'warn'}>
			<strong>{m.warbands.problems(issues.length)}</strong>
			<ul>
				{#each sorted as i, n (n)}
					<li class={i.severity}>{i.text}</li>
				{/each}
			</ul>
		</Message>
	{/if}
	{#if beyond}<p class="dim small">{b.beyond}</p>{/if}
</section>

<style>
	.problems {
		display: grid;
		gap: var(--space-1);
	}
	ul {
		margin: var(--space-1) 0 0;
		padding-left: var(--space-5);
	}
	.warning {
		color: var(--bone-dim);
	}
	.small {
		font-size: var(--size-label);
	}
</style>

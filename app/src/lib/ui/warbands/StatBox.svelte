<!--
  One stat of a fighter's profile, as the fighter panel and play mode show it. A stat something changes (bought
  armour, a skill, an injury) is green with ▲ when better and red with ▼ when worse, says what it was printed as,
  and names its sources on hover and to screen readers. Armour is better when it goes down.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import type { ApiFighter } from '#lib/schemas/warbands';
	import { statTone } from '#lib/warbands/progression';

	type Props = {
		label: string;
		value: string | null;
		change?: ApiFighter['statChanges'][number];
	};
	let { label, value, change }: Props = $props();
	const t = m.warbands.statChange;
	const tone = $derived(change ? statTone(change.stat, change.delta) : null);
	const sources = $derived(change ? t.sources(change.printed, change.from) : undefined);
</script>

<div class="stat" data-tone={tone ?? undefined} title={sources}>
	<span>{label}</span>
	<b class="data"
		>{#if tone}<span class="arrow" aria-hidden="true">{tone === 'better' ? '▲' : '▼'}</span
			>{/if}{value ?? '—'}</b
	>
	{#if change?.delta}<small>{t.was(change.printed ?? '—')}</small>{/if}
	{#if change}<span class="visually-hidden">{tone ? `${t[tone]}. ` : ''}{sources}</span>{/if}
</div>

<style>
	.stat {
		display: grid;
		gap: 2px;
		align-content: start;
		text-align: center;
	}
	.stat > span {
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
	b {
		min-width: 3.4rem;
		padding: 2px var(--space-2);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule);
		font-weight: 600;
		print-color-adjust: exact;
	}
	[data-tone='better'] b {
		color: var(--ok);
		border-color: var(--ok);
	}
	[data-tone='worse'] b {
		color: var(--danger);
		border-color: var(--danger);
	}
	.arrow {
		margin-right: 0.25em;
		font-size: 0.75em;
	}
	small {
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
</style>

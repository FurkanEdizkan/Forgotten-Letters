<!-- The campaign's house rules as members read them: on or off, the name, In play or Setting, a setting's values, the CM's note. -->
<script lang="ts">
	import { m } from '#lib/messages';
	import type { HouseRule } from '#lib/schemas/campaigns';
	import { describeValues, presetByKey } from '#lib/house-rule-presets';

	let { rules }: { rules: HouseRule[] } = $props();
	const p = m.campaigns.page;
	const r = m.campaigns.wizard.rules;
	const valuesOf = (rule: HouseRule) => {
		const preset = rule.preset ? presetByKey(rule.preset) : undefined;
		return preset?.fields.length ? describeValues(preset, rule.values) : '';
	};
</script>

{#if rules.length}
	<ul class="rules">
		{#each rules as rule, i (i)}
			<li class:off={!rule.on}>
				<span class="state">{rule.on ? p.on : p.off}</span>
				<div>
					<p class="name">
						{rule.name}
						<span class="kind {rule.kind}"
							>{rule.kind === 'passive' ? r.kindPassive : r.kindConfig}</span
						>
					</p>
					{#if valuesOf(rule)}<p class="data">{valuesOf(rule)}</p>{/if}
					{#if rule.text}<p class="dim">{rule.text}</p>{/if}
				</div>
			</li>
		{/each}
	</ul>
{:else}
	<p class="dim">{p.noRules}</p>
{/if}

<style>
	.rules {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: 3.5rem minmax(0, 1fr);
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: var(--border-hairline) solid var(--rule);
	}
	.state {
		align-self: start;
		justify-self: start;
		padding: 0 var(--space-2);
		border: var(--border-hairline) solid currentColor;
		color: var(--ok);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		line-height: 1.6;
	}
	.off .state {
		color: var(--bone-dim);
	}
	.name {
		font-weight: 600;
	}
	.off .name {
		color: var(--bone-dim);
	}
	.kind {
		margin-left: var(--space-1);
		padding: 0 var(--space-2);
		border: var(--border-hairline) solid currentColor;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		vertical-align: middle;
		color: var(--bone-dim);
	}
	.kind.configuration {
		color: var(--blood-pale);
		border-color: var(--blood-bright);
	}
</style>

<!-- The campaign's house rules as members read them: on or off, the name, the CM's explanation. -->
<script lang="ts">
	import { m } from '#lib/messages';
	import type { HouseRule } from '#lib/schemas/campaigns';

	let { rules }: { rules: HouseRule[] } = $props();
	const p = m.campaigns.page;
</script>

{#if rules.length}
	<ul class="rules">
		{#each rules as rule, i (i)}
			<li class:off={!rule.on}>
				<span class="state">{rule.on ? p.on : p.off}</span>
				<div>
					<p class="name">{rule.name}</p>
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
</style>

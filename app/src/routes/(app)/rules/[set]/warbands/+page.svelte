<script lang="ts">
	import { m } from '#lib/messages';
	import { warbandHref } from '#lib/rules/text';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import RuleText from '#lib/ui/rules/RuleText.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head
	><title>{m.rules.sections.warbands} · {m.rules.title} · {m.app.name}</title></svelte:head
>

<h1>{m.rules.sections.warbands}</h1>
{#each data.pages as p (p.id)}<RuleText body={p.body} />{/each}
{#if data.factions.length}
	<ul class="factions">
		{#each data.factions as f (f.id)}
			<li class="card">
				<h2><a href={warbandHref(data.set, f.id)}>{f.name}</a></h2>
				<p class="dim">{f.alignment}</p>
				{#if f.variants.length}
					<p>
						<span class="label">{m.rules.variants}</span>
						{#each f.variants as v, i (v.id)}{i ? ', ' : ' '}<a href={warbandHref(data.set, v.id)}
								>{v.name}</a
							>{/each}
					</p>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<EmptyState text={m.rules.emptySection} />
{/if}

<style>
	.factions {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.card {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-4);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		border-top: var(--border-card-top) solid var(--blood);
	}
	h2 {
		margin: 0;
		font-family: var(--font-body);
		font-size: var(--size-title);
		font-weight: 700;
		letter-spacing: var(--track-title);
		text-transform: uppercase;
	}
	h2 a {
		color: var(--bone);
		text-decoration: none;
	}
	p {
		margin: 0;
	}
	p a {
		color: var(--blood-pale);
	}
</style>

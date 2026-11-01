<script lang="ts">
	import { m } from '#lib/messages';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import RuleText from '#lib/ui/rules/RuleText.svelte';
	import VersionDiff from '#lib/ui/rules/VersionDiff.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const title = $derived(m.rules.sections[data.section] ?? data.section);
	const versions = $derived(
		data.sets.map((s) => ({ value: s.id, label: m.rules.versionOf(s.name, s.version) }))
	);
	const empty = $derived(!data.pages.length && !data.scenarios.length && !data.tables.length);
</script>

<svelte:head><title>{title} · {m.rules.title} · {m.app.name}</title></svelte:head>

<h1>{title}</h1>
{#if empty && data.section !== 'errata'}<EmptyState text={m.rules.emptySection} />{/if}
{#each data.pages as p (p.id)}
	<section class="page" id={p.id}>
		<h2>{p.title}</h2>
		<RuleText body={p.body} />
	</section>
{/each}
{#if data.scenarios.length}
	<h2>{m.rules.scenarios}</h2>
	{#each data.scenarios as s (s.id)}
		<section class="page" id={s.id}>
			<h3>{s.name}</h3>
			<RuleText body={s.text} />
			{#if s.deployment}<RuleText body={s.deployment} />{/if}
			{#if s.victory}<RuleText body={s.victory} />{/if}
		</section>
	{/each}
{/if}
{#if data.tables.length}
	<h2>{m.rules.tables}</h2>
	{#each data.tables as t (t.id)}
		<table class="table" id={t.id}>
			<caption>{t.name}{t.dice ? ` (${t.dice})` : ''}</caption>
			<tbody>
				{#each t.rows as r, i (`${i}:${r.roll}`)}
					<tr>
						<td class="num">{r.roll}</td>
						<td><strong>{r.name}</strong> <RuleText body={r.text} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/each}
{/if}
{#if data.section === 'errata'}
	<VersionDiff changes={data.changes} {versions} />
{/if}

<style>
	.page {
		display: grid;
		gap: var(--space-2);
		scroll-margin-top: calc(var(--bar-height, 56px) + var(--space-4));
	}
	h2,
	h3 {
		margin: 0;
	}
	caption {
		text-align: left;
		padding: var(--space-2) 0;
		font-weight: 700;
	}
</style>

<!--
  The homebrew editor's live Checks panel: the problems the rules checker finds in the set as it is now (each with
  its file and the entry's name), advice that does not stop it loading (a list nobody can equip), and how the saved
  version stands: in the compendium; a draft with problems while players keep the last version that passed (with
  its date); or not in the compendium yet.
-->
<script lang="ts">
	import { m } from '#lib/messages';
	import type { Problem } from '#lib/rules/check';
	import Time from '#lib/ui/Time.svelte';

	type Props = {
		problems: Problem[];
		warnings: string[];
		names: Map<string, string>;
		saved: { ok: boolean; problems: number; published: { checkedAt: string } | null };
		dirty: boolean;
	};
	let { problems, warnings, names, saved, dirty }: Props = $props();
	const c = m.homebrew.checks;
</script>

<aside class="checks" aria-labelledby="checks-title" aria-live="polite">
	<h2 id="checks-title">{c.title}</h2>
	{#if problems.length}
		<ul class="problems">
			{#each problems as p, i (i)}
				<li>
					<span class="where">{p.id ? (names.get(p.id) ?? p.id) : p.file}</span>
					{p.message}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="ok">{c.none}</p>
	{/if}
	{#each warnings as w (w)}<p class="warn">{w}</p>{/each}
	{#if dirty}
		<p class="dim small">{c.unsaved}</p>
	{:else if saved.ok}
		<p class="dim small">{c.savedOk}</p>
	{:else if saved.published}
		<p class="warn small">{c.serving} <Time at={saved.published.checkedAt} />.</p>
	{:else}
		<p class="dim small">{c.savedBad(Math.max(saved.problems, 1))}</p>
	{/if}
</aside>

<style>
	.checks {
		position: sticky;
		top: var(--space-4);
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: var(--panel);
		border: var(--border-hairline) solid var(--rule);
		border-top: var(--border-card-top) solid var(--blood);
		max-height: calc(100vh - 8rem);
		overflow: auto;
	}
	h2 {
		margin: 0;
		padding: 0;
		border: 0;
	}
	.problems {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.problems li {
		padding-left: var(--space-2);
		border-left: var(--border-card-top) solid var(--danger);
		overflow-wrap: anywhere;
	}
	.where {
		display: block;
		font-size: var(--size-label);
		color: var(--bone-dim);
	}
	.ok {
		color: var(--ok);
	}
	.warn {
		color: var(--warn);
	}
	.small {
		font-size: var(--size-label);
	}
</style>

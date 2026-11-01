<!--
  /homebrew/[id]: the homebrew editor. Tabs for the faction (or variant) rules, units, armoury, keywords and
  sharing edit one copy of the set in the page; Save sends it whole with its version. The Checks panel runs the
  same checker as the server on every change. "Preview in rules" opens the set in the compendium once a version
  has passed (a later draft with problems leaves players on that version, and the panel says from when). Someone else's shared set opens read-only.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import { checkHomebrew, SET_KEYS, warningsOf } from '#lib/rules/homebrew';
	import { elementsOf } from '#lib/rules/elements';
	import { warbandHref } from '#lib/rules/text';
	import type { RulesSet } from '#lib/rules/pack';
	import { resultOf } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import Callout from '#lib/ui/Callout.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Tabs from '#lib/ui/Tabs.svelte';
	import ArmouryTab from '#lib/ui/homebrew/ArmouryTab.svelte';
	import ChecksPanel from '#lib/ui/homebrew/ChecksPanel.svelte';
	import FactionTab from '#lib/ui/homebrew/FactionTab.svelte';
	import KeywordsTab from '#lib/ui/homebrew/KeywordsTab.svelte';
	import SharingTab from '#lib/ui/homebrew/SharingTab.svelte';
	import UnitsTab from '#lib/ui/homebrew/UnitsTab.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const h = m.homebrew;
	const e = h.editor;

	/** Every list present, and a variant's rules object, so the tabs can bind to them. */
	function filled(d: Record<string, unknown>): RulesSet {
		const s = structuredClone(d) as Record<string, unknown>;
		for (const k of SET_KEYS) if (k !== 'manifest' && !Array.isArray(s[k])) s[k] = [];
		for (const v of s.variants as { rules?: object }[]) v.rules ??= {};
		return s as unknown as RulesSet;
	}
	/** The set without its manifest, keys sorted: the database (jsonb) hands objects back in its own key order. */
	const strip = (s: RulesSet) =>
		JSON.stringify({ ...s, manifest: null }, (_k, x) =>
			x && typeof x === 'object' && !Array.isArray(x)
				? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
				: x
		);

	const hb = $derived(data.homebrew);
	// The page's own copy, from the set as loaded; a save keeps it (it is what was saved) and the load brings the
	// new version number.
	const loaded = () => ({ set: filled(data.homebrew.data), name: data.homebrew.name });
	let set = $state(loaded().set);
	let name = $state(loaded().name);
	const dirty = $derived(strip(set) !== strip(filled(hb.data)) || name !== hb.name);
	const live = $derived.by(() => {
		const now = $state.snapshot(set) as RulesSet;
		const checked = checkHomebrew(now as never, new Set(data.base.ids));
		let warnings: string[] = [];
		let names = new Map<string, string>();
		try {
			warnings = warningsOf(now);
			names = new Map(elementsOf(now).map((x) => [x.id, x.name]));
		} catch {
			// A draft too broken to list stays with the checker's own problems.
		}
		return { ...checked, warnings, names };
	});
	const head = $derived(set.factions[0] ?? set.variants[0]);
	const saveName = $derived((head?.name || name || hb.name).trim().slice(0, 80));
	// A faction's or variant's own page; a set of items opens on the battlekit.
	const preview = $derived(
		!hb.published
			? null
			: head
				? warbandHref(hb.setId, head.id)
				: `/rules/${encodeURIComponent(hb.setId)}/battlekit`
	);
	const saved = $derived(resultOf(form, 'save'));

	const firstTab = () => (data.homebrew.kind === 'items' ? 'armoury' : 'faction');
	let tab = $state(firstTab());
	const tabs = $derived([
		{ id: 'faction', label: e.tabs[hb.kind === 'faction' ? 'faction' : hb.kind] },
		...(hb.kind === 'items' ? [] : [{ id: 'units', label: e.tabs.units, count: set.units.length }]),
		{ id: 'armoury', label: e.tabs.armoury, count: set.armouryLines.length },
		{ id: 'keywords', label: e.tabs.keywords, count: set.keywords.length },
		{ id: 'sharing', label: e.tabs.sharing }
	]);
</script>

<svelte:head><title>{hb.name} · {h.title} · {m.app.name}</title></svelte:head>

<p><a href="/homebrew">{e.back}</a></p>
<div class="head">
	<div>
		<h1>{hb.name}</h1>
		<p class="dim">
			{h.kinds[hb.kind]} · {h.onBase(hb.baseName)} ·
			{hb.visibility === 'shared' ? h.sharedBadge : h.private}{hb.mine
				? ''
				: ` · ${h.by(hb.ownerName)}`}
		</p>
	</div>
	<div class="actions">
		{#if dirty && hb.mine}<span class="unsaved">{e.unsaved}</span>{/if}
		{#if preview}
			<Button href={preview}>{e.preview}</Button>
		{:else}
			<span class="dim small">{e.previewHint}</span>
		{/if}
		{#if hb.mine}
			<form
				method="POST"
				action="?/save"
				use:enhance={() =>
					({ update }) =>
						update({ reset: false })}
			>
				<input type="hidden" name="op" value="save" />
				<input type="hidden" name="version" value={hb.version} />
				<input type="hidden" name="name" value={saveName} />
				<input type="hidden" name="data" value={JSON.stringify(set)} />
				<Button kind="primary" type="submit">{e.save}</Button>
			</form>
		{/if}
	</div>
</div>
{#if saved.error}<Message kind="danger">{saved.error}</Message>{/if}
{#if saved.done && !dirty}<Message>{e.saved}</Message>{/if}
{#if !hb.mine}<Callout>{e.readOnly(hb.ownerName)}</Callout>{/if}

<div class="work">
	<div class="main">
		<Tabs label={e.tabsLabel} {tabs} bind:value={tab}>
			{#snippet panel(id)}
				<fieldset disabled={!hb.mine && id !== 'sharing'}>
					{#if id === 'faction'}
						<FactionTab bind:set base={data.base} bind:name />
					{:else if id === 'units'}
						<UnitsTab bind:set base={data.base} />
					{:else if id === 'armoury'}
						<ArmouryTab bind:set base={data.base} />
					{:else if id === 'keywords'}
						<KeywordsTab bind:set />
					{:else}
						<SharingTab homebrew={hb} copiedFrom={data.base.copiedFrom} {form} />
					{/if}
				</fieldset>
			{/snippet}
		</Tabs>
	</div>
	<ChecksPanel
		problems={live.problems}
		warnings={live.warnings}
		names={live.names}
		saved={{ ok: hb.ok, problems: hb.problems, published: hb.published }}
		{dirty}
	/>
</div>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.unsaved {
		color: var(--warn);
		font-size: var(--size-label);
	}
	.work {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 20rem;
		gap: var(--space-5);
		align-items: start;
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	.small {
		font-size: var(--size-label);
	}
</style>

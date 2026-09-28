<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { beforeNavigate } from '$app/navigation';
	import Mark from '$lib/components/Mark.svelte';
	import { RESOURCES, RESOURCE_NAMES, type Resource, type Zone } from '$lib/rules/types';
	import { ARCHETYPES, ZONE_TYPES } from '$lib/map-template';
	import { ARCHETYPE_NAMES } from '$lib/rules/scenario';
	import { slug } from '$lib/faction-template';

	let { data, form } = $props();

	/** The editor's working copy; Save sends it all. */
	// svelte-ignore state_referenced_locally
	let zones = $state<Zone[]>(structuredClone(data.zones));
	// svelte-ignore state_referenced_locally
	let savedIds = $state(new Set(data.zones.map((z) => z.id)));
	let selected = $state<string | null>(null);
	let mode = $state<'move' | 'link' | 'add'>('move');
	let svg = $state<SVGSVGElement>();
	let saveForm = $state<HTMLFormElement>();
	let panel = $state<HTMLElement>();
	let canvasWidth = $state(1);
	let announce = $state('');
	let justSaved = $state(false);

	const w = $derived(data.map.width);
	const h = $derived(data.map.height);
	/** Screen pixels per map pixel. */
	const scale = $derived(canvasWidth / w);
	const r = $derived(w * 0.014);
	/** Touch targets stay at least 44 px across whatever the map's size on screen. */
	const hit = $derived(Math.max(r, 22 / scale));
	const labelPx = $derived(r * 1.1 * scale);
	const zone = $derived(zones.find((z) => z.id === selected) ?? null);
	const byId = $derived(new Map(zones.map((z) => [z.id, z])));
	const at = (z: Zone) => ({ x: (z.pos?.x ?? 0.5) * w, y: (z.pos?.y ?? 0.5) * h });
	/** Each link once. */
	const links = $derived(zones.flatMap((z) => z.links.filter((l) => byId.has(l) && (z.id < l || !byId.get(l)!.links.includes(z.id))).map((l) => [z, byId.get(l)!] as const)));
	/** Zones added, removed or changed since the last save. */
	const changes = $derived.by(() => {
		const saved = new Map(data.zones.map((z) => [z.id, JSON.stringify(z)]));
		let n = [...saved.keys()].filter((id) => !byId.has(id)).length;
		for (const z of zones) if (saved.get(z.id) !== JSON.stringify(z)) n++;
		return n;
	});
	const dirty = $derived(changes > 0);
	const neighbours = (z: Zone) => zones.filter((o) => o.links.includes(z.id) || z.links.includes(o.id));
	const colour = (z: Zone) => (z.type === 'entry' ? '#231a12' : z.type === 'special' ? '#b3261e' : '#f1e6cb');
	const round = (n: number) => Math.round(n * 10000) / 10000;

	function point(e: PointerEvent) {
		const m = svg!.getScreenCTM()!.inverse();
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
		return { x: Math.min(1, Math.max(0, p.x / w)), y: Math.min(1, Math.max(0, p.y / h)) };
	}

	async function select(id: string | null, from: 'map' | 'list' | 'key' = 'map') {
		selected = id;
		justSaved = false;
		announce = id ? `${byId.get(id)?.name} selected` : 'Back to all zones';
		if (from === 'map') return;
		await tick();
		// From the list (or the keyboard) the panel is where the work continues: take focus there.
		panel?.querySelector<HTMLElement>(id ? '.zone-head h2' : '.list-head h2')?.focus();
		if (id && window.matchMedia('(max-width: 60rem)').matches) panel?.scrollIntoView({ block: 'start', behavior: 'smooth' });
	}

	let dragging: string | null = null;
	function down(e: PointerEvent, z: Zone) {
		e.stopPropagation();
		if (mode === 'link') {
			if (!selected || selected === z.id) select(selected === z.id ? null : z.id);
			else toggleLink(selected, z.id);
			return;
		}
		select(z.id);
		if (mode === 'move') {
			dragging = z.id;
			(e.currentTarget as Element).setPointerCapture(e.pointerId);
		}
	}
	function move(e: PointerEvent) {
		if (!dragging) return;
		const z = byId.get(dragging);
		if (!z) return;
		const p = point(e);
		z.pos = { x: round(p.x), y: round(p.y) };
	}
	function up() {
		dragging = null;
	}
	async function ground(e: PointerEvent) {
		if (mode !== 'add') {
			select(null);
			return;
		}
		const p = point(e);
		let n = zones.length + 1;
		while (byId.has(`zone-${n}`)) n++;
		zones.push({ id: `zone-${n}`, name: `New zone ${n}`, type: 'basic', resources: [], links: [], pos: { x: round(p.x), y: round(p.y) } });
		mode = 'move';
		await select(`zone-${n}`, 'key');
		const name = panel?.querySelector<HTMLInputElement>('input[name=zone-name]');
		name?.focus();
		name?.select();
	}
	function toggleLink(a: string, b: string) {
		const za = byId.get(a)!;
		const zb = byId.get(b)!;
		const linked = za.links.includes(b) || zb.links.includes(a);
		za.links = linked ? za.links.filter((l) => l !== b) : [...za.links, b];
		zb.links = zb.links.filter((l) => l !== a);
		announce = `${za.name} ${linked ? 'no longer linked to' : 'linked to'} ${zb.name}`;
	}
	function nudge(e: KeyboardEvent, z: Zone) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (mode === 'link' && selected && selected !== z.id) toggleLink(selected, z.id);
			else select(z.id, 'key');
			return;
		}
		const step = e.shiftKey ? 0.02 : 0.004;
		const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
		if (!d) return;
		e.preventDefault();
		const p = z.pos ?? { x: 0.5, y: 0.5 };
		z.pos = { x: round(Math.min(1, Math.max(0, p.x + d[0]))), y: round(Math.min(1, Math.max(0, p.y + d[1]))) };
		selected = z.id;
	}
	function remove(id: string) {
		const name = byId.get(id)?.name;
		zones = zones.filter((z) => z.id !== id).map((z) => ({ ...z, links: z.links.filter((l) => l !== id) }));
		select(null, 'key');
		announce = `${name} removed (not saved yet)`;
	}
	function rename(z: Zone, id: string) {
		const next = slug(id) || z.id;
		if (next === z.id || byId.has(next)) return;
		for (const o of zones) o.links = o.links.map((l) => (l === z.id ? next : l));
		if (selected === z.id) selected = next;
		z.id = next;
	}
	function toggleResource(z: Zone, res: Resource, on: boolean) {
		z.resources = on ? [...z.resources, res] : z.resources.filter((x) => x !== res);
	}
	/** Throw away unsaved edits: back to the map as last saved, and to the list. */
	function reset() {
		zones = structuredClone(data.zones);
		savedIds = new Set(data.zones.map((z) => z.id));
		mode = 'move';
		select(null, 'key');
		announce = 'Changes discarded';
	}

	const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
	function keys(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			if (dirty) saveForm?.requestSubmit();
			return;
		}
		if (e.key === 'Escape') {
			if (typing(e.target)) (e.target as HTMLElement).blur();
			if (selected) select(null, 'key');
			else if (mode !== 'move') mode = 'move';
			return;
		}
		if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
		const m = ({ m: 'move', l: 'link', a: 'add' } as const)[e.key.toLowerCase() as 'm' | 'l' | 'a'];
		if (m) mode = m;
	}

	// Unsaved placements are not lost to a stray click on the admin menu.
	beforeNavigate(({ cancel, type }) => {
		if (dirty && type !== 'form' && !confirm(`You have ${changes} unsaved change${changes > 1 ? 's' : ''} on the map. Leave without saving?`)) cancel();
	});
	const unload = (e: BeforeUnloadEvent) => {
		if (dirty) e.preventDefault();
	};

	/** Ask before a file action that replaces the map and saves at once. */
	const ask = (message: string) => confirm(dirty ? `${message}\n\nYour ${changes} unsaved change${changes > 1 ? 's' : ''} will be lost.` : message);
	const guarded =
		(message: () => string, then: typeof afterSave | typeof keep): SubmitFunction =>
		({ cancel }) => {
			if (!ask(message())) return cancel();
			return then();
		};
	const afterSave = () => async ({ result, update }: { result: { type: string }; update: (o?: { reset: boolean }) => Promise<void> }) => {
		await update({ reset: false });
		if (result.type === 'success') {
			zones = structuredClone(data.zones);
			savedIds = new Set(data.zones.map((z) => z.id));
			justSaved = true;
			announce = 'Map saved';
		}
	};
	const keep = () => ({ update }: { update: (o?: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const modeHint = $derived(
		mode === 'move'
			? 'Drag a zone to place it. Arrow keys nudge the selected zone.'
			: mode === 'link'
				? selected
					? `Linking from ${zone?.name}: click its neighbours to link or unlink them. Click ${zone?.name} again to stop.`
					: 'Click a zone to link from, then click its neighbours.'
				: 'Click the map where the new zone goes.'
	);
</script>

<svelte:head><title>Map Studio · Campaign Master</title></svelte:head>
<svelte:window onkeydown={keys} onbeforeunload={unload} />

<h1>Map Studio</h1>
<p class="lede">
	Place the zones on your campaign map and link the ones that border each other. Zones the image doesn't show are drawn by the app.
</p>

{#if !data.hasCampaign}
	<p class="error">Found the campaign first (Campaign).</p>
{:else}
	<details class="files" open={!data.map.src}>
		<summary>Map image and zone files</summary>
		<div class="file-groups">
			<section>
				<h3>Map image</h3>
				<p class="meta">{data.map.src ? `${data.map.width} × ${data.map.height} px.` : 'None yet: the map is plain parchment.'} WebP, PNG or JPEG, up to 30 MB.</p>
				<div class="row">
					<form method="POST" action="?/image" enctype="multipart/form-data" use:enhance={keep}>
						<label class="button file">
							{data.map.src ? 'Replace the image' : 'Upload the map image'}
							<input type="file" name="image" accept="image/*" onchange={(e) => e.currentTarget.form?.requestSubmit()} />
						</label>
					</form>
					{#if data.map.src}
						<form method="POST" action="?/clearImage" use:enhance={guarded(() => 'Remove the map image? Zones stay where they are; the map shows parchment until you upload another.', keep)}>
							<button class="ghost danger">Remove the image</button>
						</form>
					{/if}
				</div>
			</section>
			<section>
				<h3>Zones</h3>
				<p class="meta">Keep a copy, or bring zones from another campaign. Importing and the preset replace every zone and save at once.</p>
				<div class="row">
					<a class="button ghost" href="/admin/map/zones.yaml" download>Download zones (YAML)</a>
					<form method="POST" action="?/import" enctype="multipart/form-data" use:enhance={afterSave}>
						<label class="button ghost file">
							Import zones…
							<input
								type="file"
								name="file"
								accept=".yaml,.yml"
								onchange={(e) => {
									if (ask(`Replace all ${zones.length} zones with the file's and save now?`)) e.currentTarget.form?.requestSubmit();
									else e.currentTarget.value = '';
								}}
							/>
						</label>
					</form>
					<form method="POST" action="?/preset" use:enhance={guarded(() => `Replace all ${zones.length} zones with the Carcass Front zones and save now?`, afterSave)}>
						<button class="ghost">Use the Carcass Front zones…</button>
					</form>
				</div>
			</section>
		</div>
	</details>
	{#if form && 'message' in form}<p class="error" role="alert">{form.message}</p>{/if}
	{#if form && 'errors' in form && form.errors}
		<ul class="error" role="alert">{#each form.errors as e, i (i)}<li><code>{e.path}</code> {e.message}</li>{/each}</ul>
	{/if}

	<div class="studio">
		<div class="work">
			<div class="toolbar">
				<div class="modes" role="radiogroup" aria-label="Tool">
					{#each [['move', 'Move', 'M'], ['link', 'Link', 'L'], ['add', 'Add', 'A']] as [m, label, key] (m)}
						<label class:on={mode === m}><input type="radio" name="mode" value={m} bind:group={mode} /> {label} <kbd>{key}</kbd></label>
					{/each}
				</div>
				<p class="hint" aria-live="polite">{modeHint}</p>
			</div>
			<p class="small-screen">Placing zones is easiest on a larger screen; here, pick zones from the list to edit them.</p>
			<div class="canvas" style:aspect-ratio="{w} / {h}" style:max-width="calc((100vh - 120px) * {w / h})" bind:clientWidth={canvasWidth}>
				{#if data.map.src}<img src={data.map.src} alt="" />{:else}<div class="parchment">No map image yet: zones are drawn on parchment.</div>{/if}
				<svg bind:this={svg} viewBox="0 0 {w} {h}" onpointermove={move} onpointerup={up} role="application" aria-label="Map editor: {zones.length} zones">
					<!-- Pointer-only: zones themselves are focusable and move with the arrow keys. -->
					<rect width={w} height={h} fill="transparent" onpointerdown={ground} class:add={mode === 'add'} role="presentation" />
					{#each links as [a, b] (`${a.id}|${b.id}`)}
						<line x1={at(a).x} y1={at(a).y} x2={at(b).x} y2={at(b).y} class:hot={selected === a.id || selected === b.id} stroke-width={Math.max(r * 0.3, 1.5 / scale)} />
					{/each}
					{#each zones as z (z.id)}
						{@const p = at(z)}
						{@const near = !!zone && zone.id !== z.id && neighbours(zone).includes(z)}
						<g
							class="zone"
							class:sel={selected === z.id}
							class:near
							class:link={mode === 'link'}
							transform="translate({p.x} {p.y})"
							onpointerdown={(e) => down(e, z)}
							onkeydown={(e) => nudge(e, z)}
							tabindex="0"
							role="button"
							aria-label="{z.name}, {z.type} zone{near ? ', linked' : ''}"
							aria-pressed={selected === z.id}
						>
							<circle class="hit" r={hit} />
							<circle class="focus" r={r * 1.7} stroke-width={2 / scale} />
							<circle class="disc" r={r} fill={colour(z)} stroke-width={r * 0.25} />
							<title>{z.name}</title>
							<!-- The map image prints its own names: label only what it doesn't show, and the zones in play. -->
							{#if selected === z.id || near || ((!data.map.src || z.house) && labelPx >= 9)}
								<text y={r * 2.3} font-size={Math.max(r * 1.1, 11 / scale)} stroke-width={4 / scale}>{z.name}</text>
							{/if}
						</g>
					{/each}
				</svg>
			</div>
		</div>

		<aside class="panel" bind:this={panel} aria-label="Zone details">
			{#if zone}
				{@const z = zone}
				<div class="zone-head">
					<button type="button" class="back" onclick={() => select(null, 'key')}><Mark name="chevron" size="0.9em" /> All zones</button>
					<h2 tabindex="-1">{z.name}</h2>
					<p class="meta">{z.type[0].toUpperCase() + z.type.slice(1)} zone · linked to {neighbours(z).map((n) => n.name).join(', ') || 'nothing yet (use Link)'}</p>
				</div>
				<div class="grid">
					<label class="wide">Name <input name="zone-name" value={z.name} oninput={(e) => (z.name = e.currentTarget.value)} /></label>
					<label>Id
						{#if savedIds.has(z.id)}<input value={z.id} disabled />
						{:else}<input value={z.id} onchange={(e) => rename(z, e.currentTarget.value)} />{/if}
					</label>
					<label>Type
						<select value={z.type} onchange={(e) => (z.type = e.currentTarget.value as Zone['type'])}>{#each ZONE_TYPES as t (t)}<option value={t}>{t}</option>{/each}</select>
					</label>
					{#if savedIds.has(z.id)}<p class="note wide">The id stays as saved: games and warbands refer to it.</p>{/if}
					<fieldset class="wide">
						<legend>Resources</legend>
						{#each RESOURCES as res (res)}
							<label class="check"><input type="checkbox" checked={z.resources.includes(res)} onchange={(e) => toggleResource(z, res, e.currentTarget.checked)} /> {RESOURCE_NAMES[res]}</label>
						{/each}
					</fieldset>
					{#if z.type !== 'entry'}
						<label class="wide">Scenario <small>a named scenario played here, or leave empty and pick a kind below</small>
							<input value={z.scenario ?? ''} oninput={(e) => (z.scenario = e.currentTarget.value || undefined)} />
						</label>
						<label class="wide">Random scenario of kind
							<select value={z.archetype ?? ''} onchange={(e) => (z.archetype = (e.currentTarget.value || undefined) as Zone['archetype'])}>
								<option value="">—</option>{#each ARCHETYPES as a (a)}<option value={a}>{ARCHETYPE_NAMES[a]}</option>{/each}
							</select>
						</label>
						<label class="wide">Outpost bonus <textarea rows="3" value={z.bonus ?? ''} oninput={(e) => (z.bonus = e.currentTarget.value || undefined)}></textarea></label>
						<label>Omen of Leviathan
							<select value={z.omen ?? ''} onchange={(e) => (z.omen = (e.currentTarget.value || undefined) as Zone['omen'])}>
								<option value="">None</option><option value="first">First outpost here</option><option value="each">Every outpost here</option>
							</select>
						</label>
						<label>Largest Enclave <small>counts as zones</small>
							<input type="number" min="1" max="5" value={z.enclaveWeight ?? 1} onchange={(e) => (z.enclaveWeight = Number(e.currentTarget.value) > 1 ? Number(e.currentTarget.value) : undefined)} />
						</label>
					{/if}
					<label class="check wide"><input type="checkbox" checked={!!z.house} onchange={(e) => (z.house = e.currentTarget.checked || undefined)} /> Drawn by the app: not on the map image (a house zone)</label>
				</div>
				{#if data.inUse.includes(z.id)}
					<p class="note">Warbands start or games were fought here, so this zone can't be removed.</p>
				{:else}
					<button type="button" class="ghost danger" onclick={() => remove(z.id)}>Remove {z.name}</button>
				{/if}
			{:else}
				<div class="list-head">
					<h2 tabindex="-1">{zones.length} zones</h2>
					<p class="meta">Pick one on the map or here.</p>
				</div>
				<ul class="zlist">
					{#each zones as z (z.id)}
						<li>
							<button type="button" onclick={() => select(z.id, 'list')}>
								<span class="dot" style:background={colour(z)}></span>
								<span class="name">{z.name}</span>
								<small>{z.type}</small>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</div>

	<form method="POST" action="?/save" use:enhance={afterSave} bind:this={saveForm} class="savebar" class:show={dirty || justSaved} aria-live="polite">
		<input type="hidden" name="zones" value={JSON.stringify(zones)} />
		{#if dirty}
			<span class="status"><strong>{changes}</strong> unsaved change{changes > 1 ? 's' : ''}</span>
			<button type="button" class="ghost" onclick={reset}>Discard changes</button>
			<button>Save the map <kbd>Ctrl S</kbd></button>
		{:else}
			<span class="status ok">Saved. Every map shows it now.</span>
		{/if}
	</form>
	<p class="sr" aria-live="polite">{announce}</p>
{/if}

<style>
	.lede {
		max-width: 64ch;
		color: var(--ink-soft);
	}
	/* File actions happen once per campaign; they sit apart from the placing tools. */
	.files {
		margin: 14px 0 18px;
		border-top: 2px solid var(--ink);
		border-bottom: 1px solid var(--rule);
	}
	.files summary {
		padding: 8px 0;
		cursor: pointer;
		font-weight: 600;
	}
	.file-groups {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
		gap: 8px 32px;
		padding-bottom: 14px;
	}
	.file-groups h3 {
		margin: 4px 0 2px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 10px;
		align-items: center;
		margin-top: 8px;
	}
	.file {
		position: relative;
		cursor: pointer;
	}
	.file input {
		position: absolute;
		inset: 0;
		opacity: 0;
		width: 100%;
		cursor: pointer;
	}
	.file:focus-within {
		outline: 2px solid var(--blood);
		outline-offset: 2px;
	}
	.button.ghost {
		background: transparent;
		color: var(--ink);
		border-color: var(--rule);
	}
	.button.ghost:hover {
		color: var(--blood);
		border-color: var(--blood);
	}
	.danger {
		color: var(--blood) !important;
		border-color: color-mix(in srgb, var(--blood) 45%, var(--rule)) !important;
	}

	/* The editor takes the width of the screen, not the reading column. */
	.studio {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 22rem;
		gap: 20px;
		align-items: start;
		width: min(calc(100vw - 32px), 1560px);
		margin-left: calc(50% - min(calc(50vw - 16px), 780px));
		margin-bottom: 80px;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 14px;
		margin-bottom: 8px;
	}
	.modes {
		display: flex;
	}
	.modes label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		padding: 0 14px;
		border: 1px solid var(--ink);
		margin-left: -1px;
		cursor: pointer;
		font-weight: 600;
	}
	.modes label.on {
		background: var(--ink);
		color: var(--paper);
	}
	.modes input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.modes label:has(input:focus-visible) {
		outline: 2px solid var(--blood);
		outline-offset: 2px;
		z-index: 1;
	}
	kbd {
		font: inherit;
		font-size: 0.72rem;
		padding: 0 4px;
		border: 1px solid currentColor;
		opacity: 0.6;
	}
	.hint {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.95rem;
	}
	.small-screen {
		display: none;
	}
	.canvas {
		position: relative;
		width: 100%;
		background: var(--parchment);
		border: 1px solid var(--rule);
		touch-action: none;
		user-select: none;
	}
	.canvas img,
	.canvas svg,
	.parchment {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.parchment {
		padding: 8px 12px;
		color: var(--muted);
		font-size: 0.85rem;
		font-style: italic;
	}
	rect.add {
		cursor: crosshair;
	}
	line {
		stroke: #8b2a1d;
		stroke-dasharray: 14 10;
		opacity: 0.7;
	}
	line.hot {
		opacity: 1;
		stroke-dasharray: none;
	}
	.zone {
		cursor: grab;
		outline: none;
	}
	.zone.link {
		cursor: pointer;
	}
	.hit {
		fill: transparent;
	}
	.disc {
		stroke: #8b2a1d;
	}
	.focus {
		fill: none;
		stroke: var(--blood);
		stroke-dasharray: 4 3;
		opacity: 0;
	}
	.zone:focus-visible .focus {
		opacity: 1;
	}
	.zone text {
		fill: #f1e6cb;
		stroke: #231a12;
		paint-order: stroke;
		text-anchor: middle;
		font-weight: 700;
		pointer-events: none;
	}
	.zone.sel .disc {
		stroke: #ffd36b;
	}
	.zone.near .disc {
		stroke: #e0a39a;
	}

	.panel {
		position: sticky;
		top: 12px;
		max-height: calc(100vh - 96px);
		overflow: auto;
		display: grid;
		gap: 12px;
		align-content: start;
		padding: 0 4px 12px 0;
		scroll-margin-top: 12px;
	}
	.zone-head,
	.list-head {
		display: grid;
		gap: 2px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--rule);
	}
	.panel h2 {
		margin: 0;
	}
	.panel h2:focus {
		outline: none;
	}
	.back {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px 4px 2px;
		background: transparent;
		border: 0;
		color: var(--blood);
		text-transform: none;
		letter-spacing: 0;
		font-weight: 600;
	}
	.back :global(svg) {
		transform: scaleX(-1);
	}
	.back:hover {
		background: transparent;
		color: var(--ink);
		text-decoration: underline;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px 12px;
	}
	.grid label {
		display: grid;
		gap: 2px;
		font-size: 0.88rem;
	}
	.grid small {
		color: var(--muted);
	}
	.grid .wide,
	.grid fieldset {
		grid-column: 1 / -1;
	}
	fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		border: 1px solid var(--rule);
		padding: 6px 10px 8px;
		margin: 0;
	}
	legend {
		font-size: 0.85rem;
		font-weight: 600;
	}
	.check {
		display: inline-flex !important;
		align-items: center;
		gap: 6px;
	}
	.meta,
	.note {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
	}
	.panel > .ghost {
		justify-self: start;
	}
	.zlist {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.zlist button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 36px;
		padding: 4px 6px;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--rule);
		color: var(--ink);
		font: inherit;
		text-align: left;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
	}
	.zlist button:hover {
		background: var(--parchment);
		color: var(--blood);
	}
	.zlist .name {
		flex: 1;
	}
	.zlist small {
		color: var(--muted);
	}
	.dot {
		flex: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid #8b2a1d;
	}

	/* Unsaved work stays in sight, whatever is scrolled. */
	.savebar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: 8px 12px;
		padding: 10px clamp(16px, 4vw, 40px);
		background: var(--paper);
		border-top: 2px solid var(--blood);
		box-shadow: 0 -6px 18px rgba(21, 18, 16, 0.12);
		transform: translateY(110%);
		transition: transform 0.2s var(--ease-out);
	}
	.savebar.show {
		transform: none;
	}
	.savebar .status {
		margin-right: auto;
	}
	.savebar button kbd {
		margin-left: 6px;
		opacity: 0.7;
	}
	.ok {
		color: var(--supplies);
	}
	.error {
		color: var(--blood);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	@media (max-width: 60rem) {
		.studio {
			grid-template-columns: 1fr;
			width: 100%;
			margin-left: 0;
		}
		.panel {
			position: static;
			max-height: none;
		}
		.small-screen {
			display: block;
			margin: 0 0 8px;
			color: var(--muted);
			font-size: 0.88rem;
		}
		kbd {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.savebar {
			transition: none;
		}
	}
</style>

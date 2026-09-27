<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Check } from '$lib/warband-rules';

	export interface EntryRow {
		id: string;
		name: string;
		cost: number;
		currency: 'ducats' | 'glory';
		active: number;
		max: number | null;
		picture: string | null;
		check: Check;
	}

	/** Trench Companion's "Add Elite / Troop / Mercenary": the entries this warband may recruit, with why not. */
	let { open = $bindable(false), title, rows, onrecruited }: { open: boolean; title: string; rows: EntryRow[]; onrecruited?: (id: string | null) => void } = $props();

	let dialog = $state<HTMLDialogElement>();
	let chosen = $state<string | null>(null);
	let name = $state('');
	let busy = $state(false);
	let failed = $state<string | null>(null);
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			chosen = null;
			name = '';
			failed = null;
			dialog.showModal();
		} else if (!open && dialog.open) dialog.close();
	});
	const initials = (s: string) =>
		s
			.split(/\s+/)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join('');
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} class="picker tc" aria-labelledby="add-title">
	<form
		method="POST"
		action="?/recruit"
		use:enhance={() => {
			busy = true;
			failed = null;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') failed = (result.data?.message as string) ?? 'Could not recruit.';
				else {
					open = false;
					await update({ reset: false });
					onrecruited?.(result.type === 'success' ? ((result.data?.recruited as string) ?? null) : null);
				}
			};
		}}
	>
		<header>
			<h2 id="add-title">{title}</h2>
			<button type="button" class="x" aria-label="Close" onclick={() => (open = false)}>×</button>
		</header>
		<fieldset>
			<legend class="sr">Entries</legend>
			{#each rows as r (r.id)}
				<label class="entry" class:off={!r.check.ok} class:on={chosen === r.id}>
					<input type="radio" name="profile" value={r.id} bind:group={chosen} disabled={!r.check.ok} />
					<span class="pic">{#if r.picture}<img src={r.picture} alt="" />{:else}{initials(r.name)}{/if}</span>
					<span class="what">
						<strong>{r.name}</strong>
						<small>{r.check.ok ? `Active: ${r.active}${r.max != null ? ` / Max: ${r.max}` : ''}` : r.check.reason}</small>
					</span>
					<span class="cost">{r.cost} {r.currency === 'glory' ? 'G' : 'D'}</span>
				</label>
			{:else}
				<p class="empty">No entries are loaded for this list yet (Admin → Rules).</p>
			{/each}
		</fieldset>
		{#if chosen}
			<label class="named">Name <small>(optional)</small><input name="name" bind:value={name} maxlength="80" placeholder="e.g. Brother Anselm" /></label>
		{/if}
		{#if failed}<p class="why" role="alert">{failed}</p>{/if}
		<footer>
			<button type="button" class="cancel" onclick={() => (open = false)}>Cancel</button>
			<button class="add" disabled={!chosen || busy}>+ Add Fighter</button>
		</footer>
	</form>
</dialog>

<style>
	.picker {
		width: min(32rem, calc(100vw - 24px));
		max-height: min(84vh, 48rem);
		padding: 0;
		border: 0;
		background: #26231e;
		color: var(--bone);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
	}
	.picker::backdrop {
		background: rgba(10, 8, 6, 0.6);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: #8f1f18;
		position: sticky;
		top: 0;
		z-index: 1;
	}
	h2 {
		margin: 0;
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1.2rem;
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	.x {
		background: none;
		border: 0;
		color: var(--bone);
		font-size: 1.5rem;
		cursor: pointer;
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.entry {
		display: grid;
		grid-template-columns: 44px 1fr auto;
		align-items: center;
		gap: 12px;
		padding: 8px 14px;
		border-bottom: 1px solid rgba(236, 229, 211, 0.08);
		cursor: pointer;
	}
	.entry input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.entry.on {
		background: #8f1f18;
	}
	.entry:hover:not(.off) {
		background: rgba(236, 229, 211, 0.06);
	}
	.entry:has(input:focus-visible) {
		outline: 2px solid var(--bone);
		outline-offset: -2px;
	}
	.entry.off {
		cursor: not-allowed;
	}
	.entry.off strong,
	.entry.off .pic {
		opacity: 0.45;
	}
	.pic {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		overflow: hidden;
		background: #3a352d;
		font-family: var(--font-title);
	}
	.pic img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.what {
		display: grid;
		line-height: 1.25;
	}
	.what small {
		font-size: 0.78rem;
		opacity: 0.8;
	}
	.entry.off small {
		color: #e0a39a;
		opacity: 1;
	}
	.cost {
		font-weight: 600;
	}
	.named {
		display: grid;
		gap: 4px;
		padding: 10px 14px 0;
	}
	.named input {
		background: #14120e;
		color: var(--bone);
		border: 1px solid rgba(236, 229, 211, 0.25);
		padding: 7px 9px;
		font: inherit;
	}
	.why {
		margin: 8px 14px 0;
		color: #e0a39a;
		font-size: 0.85rem;
	}
	.empty {
		padding: 14px;
		opacity: 0.7;
	}
	footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 14px;
		position: sticky;
		bottom: 0;
		background: #26231e;
	}
	.cancel,
	.add {
		padding: 7px 14px;
		border: 0;
		font: inherit;
		cursor: pointer;
		color: var(--bone);
	}
	.cancel {
		background: #5a5650;
	}
	.add {
		background: #b3261e;
		font-weight: 600;
	}
	.add:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>

<script lang="ts">
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Time from '#lib/ui/Time.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
	const t = m.rules.owner;
	const counts = (c: Record<string, number>) =>
		Object.entries(c)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([type, n]) => `${n} ${m.rules.types[type] ?? type}`)
			.join(' · ');
</script>

<svelte:head><title>{t.heading} · {m.app.name}</title></svelte:head>

<section>
	<div class="top">
		<div>
			<h2>{t.heading}</h2>
			<p class="dim">{t.intro}</p>
		</div>
		<form
			method="POST"
			action="?/reload"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}}
		>
			<Button type="submit" kind="primary" icon={RefreshCw} disabled={busy}
				>{busy ? t.reloading : t.reload}</Button
			>
		</form>
	</div>
	{#if form?.op === 'reload'}<Message>{t.reloaded(form.ok ?? 0, form.failed ?? 0)}</Message>{/if}
	{#if form?.message}<Message kind="danger">{form.message}</Message>{/if}
	{#if data.sets.length}
		<table class="table">
			<thead>
				<tr>
					<th scope="col">{t.folder}</th>
					<th scope="col">{t.kind}</th>
					<th scope="col">{t.base}</th>
					<th scope="col">{t.elements}</th>
					<th scope="col">{t.state}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.sets as s (s.id)}
					<tr data-set={s.id}>
						<td>
							<strong>{m.rules.versionOf(s.name, s.version)}</strong>
							<div class="mono dim">{s.id}</div>
						</td>
						<td>{s.kind ? (t.kinds[s.kind] ?? s.kind) : m.rules.none}</td>
						<td>{s.base ?? m.rules.none}</td>
						<td class="counts">{s.ok ? counts(s.counts) : m.rules.none}</td>
						<td>
							{#if s.ok}
								<span class="state ok">{t.loaded}</span>
								<div class="dim"><Time at={s.loadedAt} /></div>
							{:else}
								<span class="state failed">{t.failed}: {t.problems(s.problems.length)}</span>
								<ul class="problems">
									{#each s.problems as p, i (i)}
										<li>
											<span class="mono">{p.file}</span>{#if p.id}
												· <span class="mono">{p.id}</span>{/if}: {p.message}
										</li>
									{/each}
								</ul>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<EmptyState text={t.empty} />
	{/if}
</section>

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: var(--space-4);
	}
	td:first-child {
		min-width: 12rem;
	}
	.counts {
		max-width: 28rem;
	}
	.state {
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		padding-left: var(--space-2);
		border-left: var(--border-status-edge) solid;
	}
	.state.ok {
		border-color: var(--ok);
	}
	.state.failed {
		border-color: var(--danger);
	}
	.problems {
		margin: var(--space-2) 0 0;
		padding-left: var(--space-4);
		max-width: 40rem;
	}
	.problems li {
		overflow-wrap: anywhere;
	}
</style>

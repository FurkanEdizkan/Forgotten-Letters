<script lang="ts">
	import { m } from '#lib/messages';
	import type { Role } from '#lib/roles';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Time from '#lib/ui/Time.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const roleName = (r: unknown) => m.roles[r as Role] ?? String(r);
	function about(e: (typeof data.entries)[number]) {
		const d = e.detail ?? {};
		if (e.action === 'role.changed')
			return `${data.names[e.targetId ?? ''] ?? ''} · ${m.audit.roleChange(roleName(d.from), roleName(d.to))}`;
		if (e.action.startsWith('backup.')) return String(d.name ?? '');
		if (e.action === 'sign_in.failed') return String(d.username ?? '');
		if (e.targetType === 'invite')
			return d.role ? `${m.audit.invite} · ${roleName(d.role)}` : m.audit.invite;
		if (e.targetType === 'user') return data.names[e.targetId ?? ''] ?? '';
		return '';
	}
</script>

<svelte:head><title>{m.audit.heading} · {m.app.name}</title></svelte:head>

<section>
	<h2>{m.audit.heading}</h2>
	<p class="dim">{m.audit.intro}</p>
	{#if data.entries.length}
		<table class="table">
			<thead>
				<tr>
					<th scope="col">{m.audit.when}</th>
					<th scope="col">{m.audit.who}</th>
					<th scope="col">{m.audit.what}</th>
					<th scope="col">{m.audit.target}</th>
					<th scope="col">{m.audit.address}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.entries as e (e.id)}
					<tr>
						<td><Time at={e.at} /></td>
						<td class:dim={!e.actorName}>{e.actorName ?? m.audit.nobody}</td>
						<td>{m.audit.actions[e.action] ?? e.action}</td>
						<td>{about(e)}</td>
						<td><code class="dim">{e.ip ?? '—'}</code></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<EmptyState text={m.audit.empty} />
	{/if}
	<div class="paging">
		{#if !data.first}<a href="/owner/audit">{m.common.first}</a>{/if}
		{#if data.next}<a href="?before={data.next}">{m.common.next}</a>{/if}
	</div>
</section>

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
	table {
		margin-top: var(--space-2);
	}
	.paging {
		display: flex;
		gap: var(--space-4);
	}
</style>

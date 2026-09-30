<script lang="ts">
	import { page } from '$app/state';

	let { data } = $props();
	const when = (d: Date | string) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
	const name = (id: string | null) => (id ? (data.accounts.find((a) => a.id === id)?.username ?? null) : null);
	const pageHref = (n: number) => {
		const q = new URLSearchParams(page.url.searchParams);
		if (n) q.set('page', String(n));
		else q.delete('page');
		const s = q.toString();
		return `/admin/log${s ? `?${s}` : ''}`;
	};
</script>

<svelte:head><title>Log · Admin</title></svelte:head>

<h1>Log</h1>
<p class="lede">
	Account events (sign-ins and failures, sign-outs, password changes, resets, sign-up requests) and every change made
	in the admin pages, newest first, with the address and browser they came from. Kept for a year.
</p>

<form method="GET" class="filters">
	<label>Kind
		<select name="category" value={data.filters.category ?? ''}>
			<option value="">All</option>
			<option value="auth">Accounts</option>
			<option value="admin">Admin changes</option>
		</select>
	</label>
	<label>Account
		<select name="account" value={data.filters.account ?? ''}>
			<option value="">Anyone</option>
			{#each data.accounts as a (a.id)}<option value={a.id}>{a.username}</option>{/each}
		</select>
	</label>
	<label>Action starts with <input name="action" value={data.filters.action ?? ''} placeholder="e.g. signin" /></label>
	<button class="small">Show</button>
	<a href="/admin/log">Clear</a>
</form>

{#if data.rows.length}
	<div class="scroll">
		<table class="ledger">
			<thead><tr><th>When</th><th>What</th><th>By</th><th>On</th><th>Address</th><th>Device</th></tr></thead>
			<tbody>
				{#each data.rows as r (r.id)}
					<tr class:failed={r.action === 'signin.fail' || r.action === 'signin.limited' || (r.status ?? 0) >= 400}>
						<td class="nowrap">{when(r.at)}</td>
						<td><code>{r.action}</code>{#if r.status && r.status >= 400}<small class="muted"> {r.status}</small>{/if}</td>
						<td>
							{#if r.actorId}<a href="/admin/players/{r.actorId}">{r.actorName ?? name(r.actorId)}</a>
							{:else}{r.actorName ?? 'visitor'}{/if}
						</td>
						<td>
							{#if r.targetType === 'user' && r.targetId}<a href="/admin/players/{r.targetId}">{name(r.targetId) ?? (r.detail as { username?: string } | null)?.username ?? 'account'}</a>
							{:else if (r.detail as { username?: string } | null)?.username}{(r.detail as { username?: string }).username}
							{:else if r.targetId}<small class="muted">{r.targetType} {r.targetId.slice(0, 8)}</small>{/if}
						</td>
						<td class="addr">{r.ip ?? '—'}</td>
						<td>{r.device}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="pager">
		{#if data.page > 0}<a href={pageHref(data.page - 1)}>← Newer</a>{/if}
		{#if data.more}<a href={pageHref(data.page + 1)}>Older →</a>{/if}
	</p>
{:else}
	<p class="muted">Nothing matches.</p>
{/if}

<style>
	.lede {
		max-width: 64ch;
		color: var(--ink-soft);
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 16px;
		align-items: end;
		margin: 18px 0;
	}
	.filters label {
		display: grid;
		gap: 4px;
		font-weight: 600;
	}
	.scroll {
		overflow-x: auto;
	}
	.ledger {
		width: 100%;
		border-collapse: collapse;
		border-top: 2px solid var(--ink);
		border-bottom: 2px solid var(--ink);
		font-size: 0.9rem;
	}
	.ledger th {
		text-align: left;
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-soft);
		padding: 6px 10px 4px 0;
		border-bottom: 1px solid var(--rule);
	}
	.ledger td {
		padding: 5px 10px 5px 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
	}
	tr.failed code {
		color: var(--blood);
	}
	.nowrap,
	.addr {
		white-space: nowrap;
		font-variant-numeric: lining-nums tabular-nums;
	}
	code {
		font-size: 0.85rem;
	}
	.muted {
		color: var(--muted);
	}
	.pager {
		display: flex;
		gap: 18px;
	}
</style>

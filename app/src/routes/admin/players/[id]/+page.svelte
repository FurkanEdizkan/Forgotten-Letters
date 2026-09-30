<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const a = $derived(data.account);
	const when = (d: Date | string | null) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never');
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const totals = $derived(data.activity.reduce((t, r) => ({ requests: t.requests + r.requests, pageViews: t.pageViews + r.pageViews }), { requests: 0, pageViews: 0 }));
</script>

<svelte:head><title>{a.displayName ?? a.username} · Players</title></svelte:head>

<p class="crumbs"><a href="/admin/players">Players</a> / {a.username}</p>
<h1>{a.displayName ?? a.username}</h1>
<p class="lede">
	{a.username} · {a.role === 'cm' ? 'Campaign Master' : 'Player'}{a.disabled ? ' · disabled' : ''}{a.envManaged ? ' · defined in .env' : ''}
</p>

{#if form?.message}<p class="note-line" role="status">{form.message}</p>{/if}

<section>
	<h2>Account</h2>
	<dl class="facts">
		<dt>Created</dt>
		<dd>{when(a.createdAt)}</dd>
		<dt>Last sign-in</dt>
		<dd>{when(a.lastSignInAt)}{a.lastSignInIp ? ` from ${a.lastSignInIp}` : ''}</dd>
		<dt>Last seen</dt>
		<dd>{when(a.lastSeenAt)}</dd>
		<dt>Email</dt>
		<dd>
			<form method="POST" action="?/email" class="inline" use:enhance={keep}>
				<input name="email" type="email" value={a.email ?? ''} placeholder="none" autocomplete="off" aria-label="Email" />
				<button class="small">Save</button>
			</form>
		</dd>
	</dl>
</section>

<section>
	<h2>Devices signed in</h2>
	{#if data.devices.length}
		<div class="scroll">
			<table class="ledger">
				<thead><tr><th>Device</th><th>Signed in</th><th>From</th><th>Last seen</th><th>Last address</th><th></th></tr></thead>
				<tbody>
					{#each data.devices as d (d.id)}
						<tr>
							<td title={d.userAgent ?? ''}>{d.label}{#if d.current} <small class="muted">(this one)</small>{/if}</td>
							<td>{when(d.createdAt)}</td>
							<td class="addr">{d.ip ?? '—'}</td>
							<td>{when(d.lastSeenAt)}</td>
							<td class="addr">{d.lastIp ?? '—'}</td>
							<td>
								{#if !d.current}
									<form method="POST" action="?/endDevice" use:enhance={keep}><input type="hidden" name="session" value={d.id} /><button class="ghost small">Sign out</button></form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="muted">No device is signed in.</p>
	{/if}
</section>

<section>
	<h2>Activity, last 30 days</h2>
	{#if data.activity.length}
		<p class="muted">{totals.pageViews} pages · {totals.requests} requests · on {data.activity.length} day{data.activity.length === 1 ? '' : 's'}</p>
		<div class="scroll">
			<table class="ledger">
				<thead><tr><th>Day</th><th class="num">Pages</th><th class="num">Requests</th><th>First seen</th><th>Last seen</th><th>Last address</th></tr></thead>
				<tbody>
					{#each data.activity as r (r.day)}
						<tr>
							<td>{new Date(r.day).toLocaleDateString(undefined, { dateStyle: 'medium' })}</td>
							<td class="num">{r.pageViews}</td>
							<td class="num">{r.requests}</td>
							<td>{new Date(r.firstSeenAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}</td>
							<td>{new Date(r.lastSeenAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}</td>
							<td class="addr">{r.lastIp ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="muted">No activity recorded yet (counts reach this page within a minute).</p>
	{/if}
</section>

<section>
	<h2>Account history</h2>
	{#if data.history.length}
		<div class="scroll">
			<table class="ledger">
				<thead><tr><th>When</th><th>What</th><th>By</th><th>Address</th><th>Device</th></tr></thead>
				<tbody>
					{#each data.history as h (h.id)}
						<tr>
							<td>{when(h.at)}</td>
							<td><code>{h.action}</code></td>
							<td>{h.actorName ?? 'visitor'}</td>
							<td class="addr">{h.ip ?? '—'}</td>
							<td>{h.device}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p><a href="/admin/log?account={a.id}">Everything this account did →</a></p>
	{:else}
		<p class="muted">Nothing recorded yet.</p>
	{/if}
</section>

<style>
	.crumbs {
		margin: 0;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}
	.lede {
		color: var(--ink-soft);
	}
	section {
		margin-top: 26px;
	}
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 18px;
		margin: 0;
		padding-top: 8px;
		border-top: 2px solid var(--ink);
	}
	.facts dt {
		font-weight: 700;
	}
	.facts dd {
		margin: 0;
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.inline input {
		min-width: min(18rem, 100%);
	}
	.scroll {
		overflow-x: auto;
	}
	.ledger {
		width: 100%;
		border-collapse: collapse;
		border-top: 2px solid var(--ink);
		border-bottom: 2px solid var(--ink);
		font-size: 0.92rem;
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
		padding: 6px 10px 6px 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
	}
	.num,
	.addr {
		font-variant-numeric: lining-nums tabular-nums;
		white-space: nowrap;
	}
	th.num {
		text-align: right;
	}
	td.num {
		text-align: right;
	}
	.muted {
		color: var(--muted);
	}
	code {
		font-size: 0.85rem;
	}
</style>

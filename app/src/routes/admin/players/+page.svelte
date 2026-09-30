<script lang="ts">
	import { enhance } from '$app/forms';
	import Seal from '$lib/components/Seal.svelte';

	let { data, form } = $props();
	const keep = () => ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => update({ reset: false });
	const when = (d: Date | null) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never');
	const seatLabel = (s: { seat: number | null; name: string; warband: string | null }) =>
		`${s.seat ? `P${s.seat} · ` : ''}${s.name}${s.warband ? ` — ${s.warband}` : ''}`;
	let editing = $state<string | null>(null);
</script>

<h1>Players</h1>
<p class="lede">
	Accounts are made here, or requested from the sign-in page and approved below. Give each player a username and a password (or let one be generated), and the
	seat they play: they can then edit that warband's seal, pictures and roster. A new or reset password must be changed at
	first sign-in.
</p>

{#if form?.issued}
	<div class="issued rules-box" role="status">
		<h3>{form.issued.why === 'created' ? 'Account created' : 'Password reset'}</h3>
		<p>Hand these to the player; the password is shown only now.</p>
		<dl>
			<dt>Username</dt>
			<dd><code>{form.issued.username}</code></dd>
			<dt>Password</dt>
			<dd><code>{form.issued.password}</code></dd>
		</dl>
	</div>
{/if}
{#if form?.message}<p class="note-line">{form.message}</p>{/if}

{#if data.requests.length}
	<section>
		<h2>Requests</h2>
		<ul class="accounts">
			{#each data.requests as r (r.id)}
				<li>
					<div class="who">
						<strong>{r.kind === 'signup' ? (r.displayName ?? r.username) : r.username}</strong>
						<small>
							{r.kind === 'signup' ? `${r.username} · asks for an account` : 'forgot their password'} · {when(r.createdAt)}
						</small>
					</div>
					<div class="tools">
						{#if r.kind === 'signup'}
							<form method="POST" action="?/approve" use:enhance={keep}><input type="hidden" name="id" value={r.id} /><button class="small">Approve</button></form>
							<form method="POST" action="?/decline" use:enhance={keep}><input type="hidden" name="id" value={r.id} /><button class="ghost small danger">Decline</button></form>
						{:else}
							<form method="POST" action="?/resolveReset" use:enhance={keep}><input type="hidden" name="id" value={r.id} /><button class="small">Issue temporary password</button></form>
							<form method="POST" action="?/decline" use:enhance={keep}><input type="hidden" name="id" value={r.id} /><button class="ghost small">Dismiss</button></form>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section>
	<h2>New account</h2>
	<form method="POST" action="?/create" class="create" use:enhance>
		<label>Username <input name="username" autocapitalize="none" spellcheck="false" required placeholder="e.g. alric" /></label>
		<label>Display name <input name="displayName" placeholder="optional" /></label>
		<label>Password <input name="password" type="text" autocomplete="off" placeholder="blank = generate one" /></label>
		<label>Role
			<select name="role">
				<option value="player">Player</option>
				<option value="cm">Campaign Master</option>
			</select>
		</label>
		<fieldset>
			<legend>Plays</legend>
			<div class="seats">
				{#each data.seats as s (s.id)}
					<label class="check">
						<input type="checkbox" name="players" value={s.id} />
						{seatLabel(s)}{#if s.userId}<small> (has an account)</small>{/if}
					</label>
				{/each}
			</div>
		</fieldset>
		<button>Create account</button>
		{#if form?.createMessage}<p class="error">{form.createMessage}</p>{/if}
	</form>
</section>

<section>
	<h2>Accounts</h2>
	<ul class="accounts">
		{#each data.users as u (u.id)}
			<li class:disabled={u.disabled}>
				<div class="who">
					<strong>{u.displayName ?? u.username}</strong>
					<small>
						{u.username} · {u.role === 'cm' ? 'Campaign Master' : 'Player'}{u.disabled ? ' · disabled' : ''}{u.mustChangePassword ? ' · temporary password' : ''}
					</small>
					<small>Last sign-in {when(u.lastSignInAt)} · {u.devices} device{u.devices === 1 ? '' : 's'} signed in</small>
				</div>
				<div class="plays">
					{#each u.seats as s (s.id)}
						<span class="seat">{#if s.faction}<Seal faction={s.faction} size={22} />{/if}{seatLabel(s)}</span>
					{:else}
						<small class="muted">{u.role === 'cm' ? 'Runs the campaign' : 'Plays no seat yet'}</small>
					{/each}
				</div>
				<div class="tools">
					<button type="button" class="ghost small" onclick={() => (editing = editing === u.id ? null : u.id)} aria-expanded={editing === u.id}>Seats</button>
					{#if !u.envManaged}<form method="POST" action="?/reset" use:enhance={keep}><input type="hidden" name="id" value={u.id} /><button class="ghost small">Reset password</button></form>{/if}
					<form method="POST" action="?/signOut" use:enhance={keep}><input type="hidden" name="id" value={u.id} /><button class="ghost small">Sign out everywhere</button></form>
					{#if u.envManaged}
						<small class="muted">Defined in .env</small>
					{:else}
						<form method="POST" action="?/toggle" use:enhance={keep}><input type="hidden" name="id" value={u.id} /><button class="ghost small">{u.disabled ? 'Enable' : 'Disable'}</button></form>
						<form method="POST" action="?/remove" use:enhance={keep}><input type="hidden" name="id" value={u.id} /><button class="ghost small danger">Delete</button></form>
					{/if}
				</div>
				{#if editing === u.id}
					<form method="POST" action="?/assign" class="assign" use:enhance={keep}>
						<input type="hidden" name="id" value={u.id} />
						<div class="seats">
							{#each data.seats as s (s.id)}
								<label class="check">
									<input type="checkbox" name="players" value={s.id} checked={s.userId === u.id} />
									{seatLabel(s)}{#if s.userId && s.userId !== u.id}<small> (another account)</small>{/if}
								</label>
							{/each}
						</div>
						<button class="small">Save seats</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.lede {
		max-width: 60ch;
		color: var(--ink-soft);
	}
	section {
		margin-top: 26px;
	}
	.issued dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 14px;
		margin: 8px 0 0;
	}
	.issued dt {
		font-weight: 700;
	}
	.issued dd {
		margin: 0;
	}
	code {
		font-size: 1.05rem;
		padding: 1px 6px;
		background: var(--paper);
		border: 1px solid var(--rule);
		user-select: all;
	}
	.issued p {
		margin: 4px 0 0;
	}
	.create {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 12px 16px;
		align-items: end;
	}
	.create label:not(.check) {
		display: grid;
		gap: 4px;
	}
	.create fieldset,
	.create button,
	.create .error {
		grid-column: 1 / -1;
	}
	.create button {
		justify-self: start;
	}
	fieldset {
		margin: 0;
		padding: 8px 12px 10px;
		border: 1px solid var(--rule);
	}
	legend {
		padding: 0 4px;
		font-weight: 700;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.seats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 2px 16px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.accounts {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 2px solid var(--ink);
	}
	.accounts li {
		display: grid;
		grid-template-columns: minmax(12rem, 1fr) minmax(12rem, 1.3fr);
		gap: 8px 20px;
		padding: 12px 2px;
		border-bottom: 1px solid var(--rule);
	}
	.accounts li.disabled {
		opacity: 0.6;
	}
	.who {
		display: grid;
		line-height: 1.3;
	}
	.who strong {
		font-size: 1.1rem;
	}
	small,
	.muted {
		color: var(--muted);
	}
	.plays {
		display: flex;
		flex-wrap: wrap;
		align-content: start;
		gap: 4px 14px;
	}
	.seat {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.tools,
	.assign {
		grid-column: 1 / -1;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.assign {
		display: grid;
		gap: 8px;
		padding: 10px 12px;
		background: var(--parchment);
		border: 1px solid var(--rule);
	}
	.assign button {
		justify-self: start;
	}
	.small {
		padding: 3px 10px;
		font-size: 0.75rem;
	}
	.danger {
		color: var(--blood);
	}
	.error {
		margin: 0;
		color: var(--blood);
	}
	.note-line {
		color: var(--supplies);
	}
	@media (max-width: 40rem) {
		.accounts li {
			grid-template-columns: 1fr;
		}
	}
</style>

<!--
  Invites for the owner and admin areas: a form to create one (the link shown once), and the pending list with
  revoke and re-send. Posts to the page's `create`, `revoke` and `resend` actions.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { m } from '#lib/messages';
	import Card from './Card.svelte';
	import Field from './Field.svelte';
	import Button from './Button.svelte';
	import ConfirmButton from './ConfirmButton.svelte';
	import Message from './Message.svelte';
	import RoleBadge from './RoleBadge.svelte';
	import SecretBox from './SecretBox.svelte';
	import EmptyState from './EmptyState.svelte';
	import Time from './Time.svelte';

	type Invite = {
		id: string;
		role: 'admin' | 'user';
		note: string | null;
		createdBy: string;
		expiresAt: Date;
		createdAt: Date;
	};
	type Result = {
		op?: string;
		id?: string;
		link?: string;
		message?: string;
		fields?: Record<string, string>;
	} | null;

	type Props = {
		invites: Invite[];
		roles: ('admin' | 'user')[];
		/** Display names by id, to show who made each invite; omit to hide the column. */
		names?: Record<string, string>;
		result: Result;
	};
	let { invites, roles, names, result }: Props = $props();

	/** A relative link gets this page's address so it can be sent as is. */
	const absolute = (link: string) =>
		link.startsWith('/') && typeof location !== 'undefined' ? location.origin + link : link;
	const failed = (op: string, id?: string) =>
		result?.message && result.op === op && (id === undefined || result.id === id)
			? result.message
			: null;
	const keep =
		() =>
		({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<div class="invites">
	<Card title={m.invites.createHeading}>
		<p class="dim">{m.invites.intro}</p>
		<form method="POST" action="?/create" use:enhance>
			<input type="hidden" name="op" value="create" />
			{#if failed('create')}<Message kind="danger">{failed('create')}</Message>{/if}
			<div class="row">
				{#if roles.length > 1}
					<div class="select">
						<label class="label" for="invite-role">{m.invites.role}</label>
						<select id="invite-role" name="role">
							{#each roles as r (r)}<option value={r} selected={r === 'user'}>{m.roles[r]}</option
								>{/each}
						</select>
					</div>
				{:else}
					<input type="hidden" name="role" value={roles[0]} />
				{/if}
				<div class="note">
					<Field
						label={m.invites.note}
						name="note"
						maxlength={200}
						hint={m.invites.noteHint}
						error={result?.op === 'create' ? result.fields?.note : null}
					/>
				</div>
			</div>
			<div><Button kind="primary" type="submit" icon={UserPlus}>{m.invites.create}</Button></div>
		</form>
		{#if result?.link}
			<SecretBox
				label={m.invites.linkReady}
				value={absolute(result.link)}
				help={m.invites.linkHelp}
			/>
		{/if}
	</Card>

	<section>
		<h3>{m.invites.pendingHeading} <span class="data dim">({invites.length})</span></h3>
		{#if failed('revoke') || failed('resend')}<Message kind="danger"
				>{failed('revoke') ?? failed('resend')}</Message
			>{/if}
		{#if invites.length}
			<table class="table">
				<thead>
					<tr>
						<th scope="col">{m.invites.role}</th>
						<th scope="col">{m.invites.note}</th>
						{#if names}<th scope="col">{m.invites.by}</th>{/if}
						<th scope="col">{m.invites.created}</th>
						<th scope="col">{m.invites.expires}</th>
						<th scope="col"><span class="visually-hidden">{m.people.actions}</span></th>
					</tr>
				</thead>
				<tbody>
					{#each invites as i (i.id)}
						<tr>
							<td><RoleBadge role={i.role} /></td>
							<td class="note-cell" class:dim={!i.note}>{i.note ?? m.invites.noNote}</td>
							{#if names}<td>{names[i.createdBy] ?? '—'}</td>{/if}
							<td><Time at={i.createdAt} /></td>
							<td><Time at={i.expiresAt} /></td>
							<td>
								<div class="actions">
									<form method="POST" action="?/resend" use:enhance={keep}>
										<input type="hidden" name="op" value="resend" />
										<input type="hidden" name="id" value={i.id} />
										<Button type="submit" icon={RefreshCw}>{m.invites.resend}</Button>
									</form>
									<form method="POST" action="?/revoke" use:enhance={keep}>
										<input type="hidden" name="op" value="revoke" />
										<input type="hidden" name="id" value={i.id} />
										<ConfirmButton label={m.invites.revoke} confirm={m.invites.revokeConfirm} />
									</form>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<EmptyState text={m.invites.empty} />
		{/if}
	</section>
</div>

<style>
	.invites {
		display: grid;
		gap: var(--space-6);
	}
	section {
		display: grid;
		gap: var(--space-3);
	}
	form {
		display: grid;
		gap: var(--space-4);
	}
	.row {
		display: flex;
		gap: var(--space-4);
		align-items: start;
	}
	.note {
		flex: 1;
		max-width: 32rem;
	}
	.select {
		display: grid;
		gap: var(--space-1);
	}
	select {
		min-height: var(--button-height);
		padding: var(--space-2);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		border-radius: var(--radius);
		color: var(--bone);
		font-family: var(--font-body);
		font-size: var(--size-body);
	}
	select:focus {
		border-color: var(--blood-bright);
	}
	/* Long notes wrap at a readable width instead of one word per line beside the buttons. */
	.note-cell {
		min-width: 18ch;
	}

	.actions {
		display: flex;
		gap: var(--space-2);
		justify-content: flex-end;
	}
	.actions form {
		display: contents;
	}
	h3 .data {
		font-weight: 400;
	}
</style>

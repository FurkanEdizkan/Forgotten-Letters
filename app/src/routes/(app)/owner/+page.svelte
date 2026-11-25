<!--
  Owner → People: every account, with its role, status and actions. The one Owner's row has a lock tag instead of
  the role list, and no Disable or Anonymise (decision 80); other rows offer Admin and User ("Campaign Master" and
  "Player"). Under the table, Transfer ownership hands the copy on: search an active account, type your password,
  then confirm in place with a sentence that names both people.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Lock from '@lucide/svelte/icons/lock';
	import { m } from '#lib/messages';
	import { ASSIGNABLE_ROLES } from '#lib/roles';
	import { resultOf } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Message from '#lib/ui/Message.svelte';
	import RoleBadge from '#lib/ui/RoleBadge.svelte';
	import SecretBox from '#lib/ui/SecretBox.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Time from '#lib/ui/Time.svelte';
	import TransferOwnership from './TransferOwnership.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const done: Record<string, string> = {
		role: m.people.roleChanged,
		disable: m.people.disabledDone,
		enable: m.people.enabledDone,
		anonymise: m.people.anonymisedDone
	};
	/** This row's outcome: a message to show, or the temporary password. */
	function outcome(id: string) {
		if (!form) return null;
		if ('done' in form)
			return form.id === id
				? {
						ok: true,
						text: done[form.op] ?? '',
						temporary: 'temporary' in form ? form.temporary : null
					}
				: null;
		return form.values?.id === id ? { ok: false, text: form.message, temporary: null } : null;
	}
	const keep =
		() =>
		({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
	const status = (p: (typeof data.people.items)[number]) =>
		p.anonymised
			? m.people.anonymised
			: p.disabled
				? m.people.disabled
				: p.mustChangePassword
					? m.people.mustChange
					: m.people.active;
</script>

<svelte:head><title>{m.people.heading} · {m.app.name}</title></svelte:head>

<section>
	<h2>{m.people.heading}</h2>
	<p class="dim">{m.people.intro}</p>
	{#if data.people.items.length}
		<table class="table">
			<thead>
				<tr>
					<th scope="col">{m.people.name}</th>
					<th scope="col">{m.people.role}</th>
					<th scope="col">{m.people.status}</th>
					<th scope="col">{m.people.lastSignIn}</th>
					<th scope="col">{m.people.actions}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.people.items as p (p.id)}
					{@const out = outcome(p.id)}
					{@const self = p.id === data.me.id}
					<tr>
						<td>
							<span class="who">{p.displayName}</span>
							<code class="dim">{p.username}</code>
							{#if self}<span class="dim">({m.common.you})</span>{/if}
						</td>
						<td><RoleBadge role={p.role} /></td>
						<td><span class="status" class:off={p.disabled}>{status(p)}</span></td>
						<td><Time at={p.lastSignInAt} fallback={m.common.never} /></td>
						<td>
							<div class="actions">
								{#if p.role === 'owner'}
									<span class="lock"
										><Lock size={14} strokeWidth={1.5} aria-hidden={true} />{m.people
											.ownerLock}</span
									>
								{:else}
									<form method="POST" action="?/role" use:enhance={keep} class="role">
										<input type="hidden" name="id" value={p.id} />
										<input type="hidden" name="version" value={p.version} />
										<label class="visually-hidden" for="role-{p.id}"
											>{m.people.roleFor(p.displayName)}</label
										>
										<select id="role-{p.id}" name="role">
											{#each ASSIGNABLE_ROLES as r (r)}<option value={r} selected={r === p.role}
													>{m.roles[r]}</option
												>{/each}
										</select>
										<Button type="submit">{m.people.changeRole}</Button>
									</form>
								{/if}
								{#if !p.anonymised}
									<form method="POST" action="?/reset" use:enhance={keep}>
										<input type="hidden" name="id" value={p.id} />
										<input type="hidden" name="version" value={p.version} />
										<ConfirmButton label={m.people.reset} confirm={m.people.resetConfirm} />
									</form>
								{/if}
								{#if p.role === 'owner'}
									<!-- The Owner is never disabled or anonymised: they transfer ownership first. -->
								{:else if p.disabled}
									<form method="POST" action="?/enable" use:enhance={keep}>
										<input type="hidden" name="id" value={p.id} />
										<input type="hidden" name="version" value={p.version} />
										<Button type="submit">{m.people.enable}</Button>
									</form>
									{#if !p.anonymised}
										<form method="POST" action="?/anonymise" use:enhance={keep}>
											<input type="hidden" name="id" value={p.id} />
											<input type="hidden" name="version" value={p.version} />
											<ConfirmButton
												label={m.people.anonymise}
												confirm={m.people.anonymiseConfirm}
											/>
										</form>
									{/if}
								{:else if !self}
									<form method="POST" action="?/disable" use:enhance={keep}>
										<input type="hidden" name="id" value={p.id} />
										<input type="hidden" name="version" value={p.version} />
										<ConfirmButton label={m.people.disable} confirm={m.people.disableConfirm} />
									</form>
								{/if}
							</div>
						</td>
					</tr>
					{#if out}
						<tr class="outcome">
							<td colspan="5">
								{#if out.temporary}
									<SecretBox
										label={m.people.temporary(p.displayName)}
										value={out.temporary}
										help={m.people.temporaryHelp}
									/>
								{:else}
									<Message kind={out.ok ? 'ok' : 'danger'}>{out.text}</Message>
								{/if}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
		<div class="paging">
			{#if data.after}<a href="/owner">{m.common.first}</a>{/if}
			{#if data.people.next}<a href="?after={data.people.next}">{m.common.nextPeople}</a>{/if}
		</div>
	{:else}
		<EmptyState text={m.people.empty} />
	{/if}
</section>

{#if data.me.role === 'owner'}
	<TransferOwnership
		find={data.find}
		after={data.after}
		candidates={data.candidates}
		result={resultOf(form, 'transfer')}
	/>
{/if}

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
	table {
		margin-top: var(--space-2);
	}
	.who {
		display: block;
		min-width: 9rem;
	}
	.status {
		white-space: nowrap;
	}
	.status.off::before {
		content: '⊘ ';
		color: var(--danger);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	/* Where the role list would be: the Owner's role is not picked, it is handed on. */
	.lock {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--button-height);
		padding: 0 var(--space-3);
		border: var(--border-hairline) dashed var(--rule-strong);
		color: var(--bone-dim);
		font-size: var(--size-label);
		white-space: nowrap;
	}
	.lock :global(svg) {
		color: var(--role-owner);
	}
	form {
		display: flex;
		gap: var(--space-2);
	}
	select {
		min-height: var(--button-height);
		padding: var(--space-1) var(--space-2);
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
	.outcome:hover {
		background: none;
	}
	.paging {
		display: flex;
		gap: var(--space-4);
	}
</style>

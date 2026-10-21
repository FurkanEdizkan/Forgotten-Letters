<script lang="ts">
	import { m } from '#lib/messages';
	import Invites from '#lib/ui/Invites.svelte';
	import RoleBadge from '#lib/ui/RoleBadge.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Time from '#lib/ui/Time.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const result = $derived(
		form
			? 'message' in form
				? { ...form, op: String(form.values?.op ?? ''), id: String(form.values?.id ?? '') }
				: form
			: null
	);
</script>

<svelte:head><title>{m.admin.title} · {m.app.name}</title></svelte:head>

<h1>{m.admin.title}</h1>
<p class="dim">{m.admin.intro}</p>

<Invites invites={data.invites} roles={data.roles} {result} />

<section>
	<h3>{m.admin.invitedHeading}</h3>
	{#if data.invited === null}
		<p class="dim">{m.admin.ownerSees} <a href="/owner">{m.admin.toPeople}</a></p>
	{:else if data.invited.length}
		<table class="table">
			<thead>
				<tr>
					<th scope="col">{m.people.name}</th>
					<th scope="col">{m.people.role}</th>
					<th scope="col">{m.people.status}</th>
					<th scope="col">{m.people.lastSignIn}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.invited as p (p.id)}
					<tr>
						<td>{p.displayName} <code class="dim">{p.username}</code></td>
						<td><RoleBadge role={p.role} /></td>
						<td>{p.disabled ? m.people.disabled : m.people.active}</td>
						<td><Time at={p.lastSignInAt} fallback={m.common.never} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<EmptyState text={m.admin.invitedEmpty} />
	{/if}
</section>

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
</style>

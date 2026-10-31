<!--
  /invite/[token]: an invite to the group, on the first-run split with glass buttons to match the seat link page
  (decision 48). Same states, form, field names and action as before.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/messages';
	import VisitorStage from '#lib/ui/VisitorStage.svelte';
	import WizardField from '#lib/ui/WizardField.svelte';
	import GlassButton from '#lib/ui/GlassButton.svelte';
	import Callout from '#lib/ui/Callout.svelte';
	import Time from '#lib/ui/Time.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const invite = $derived(data.invite);
	const closed = $derived(
		invite.state === 'open'
			? null
			: {
					used: m.invite.used,
					expired: m.invite.expired,
					revoked: m.invite.revoked,
					unknown: m.invite.unknown
				}[invite.state]
	);
	let busy = $state(false);
</script>

<svelte:head><title>{m.invite.title} · {m.app.name}</title></svelte:head>

<VisitorStage>
	<header>
		<h1>{m.invite.title}</h1>
		{#if invite.state === 'open'}
			<p class="lead">{m.invite.open(invite.inviter, m.roles[invite.role])}</p>
			<p class="dim">{m.invite.expires} <Time at={invite.expiresAt} />.</p>
		{/if}
	</header>
	{#if closed}
		<Callout kind="warn">{closed}</Callout>
		<p class="dim">{m.invite.askAgain}</p>
		<div><GlassButton href="/login">{m.invite.toLogin}</GlassButton></div>
	{:else if invite.state === 'open'}
		<form
			method="POST"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}}
		>
			{#if form?.message}<Callout kind="danger">{form.message}</Callout>{/if}
			<WizardField
				label={m.invite.username}
				name="username"
				autocomplete="username"
				autocapitalize="none"
				spellcheck={false}
				required
				hint={m.invite.usernameHint}
				value={form?.values?.username ?? ''}
				error={form?.fields?.username}
			/>
			<WizardField
				label={m.invite.displayName}
				name="displayName"
				autocomplete="nickname"
				required
				hint={m.invite.displayNameHint}
				value={form?.values?.displayName ?? ''}
				error={form?.fields?.displayName}
			/>
			<WizardField
				label={m.invite.password}
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength={10}
				maxlength={128}
				hint={m.invite.passwordHint}
				error={form?.fields?.password}
			/>
			<GlassButton variant="primary" type="submit" disabled={busy} class="go"
				>{m.invite.submit}</GlassButton
			>
		</form>
	{/if}
</VisitorStage>

<style>
	header,
	form {
		display: grid;
		gap: var(--space-2);
	}
	form {
		gap: var(--space-4);
	}
	.lead {
		font-size: 1.15rem;
	}
	form :global(.go) {
		width: 100%;
		margin-top: var(--space-1);
	}
</style>

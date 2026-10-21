<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/messages';
	import AuthCard from '#lib/ui/AuthCard.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Message from '#lib/ui/Message.svelte';
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
</script>

<svelte:head><title>{m.invite.title} · {m.app.name}</title></svelte:head>

<AuthCard subtitle={m.invite.title} wide>
	{#if closed}
		<Message kind="warn">{closed}</Message>
		<p class="dim">{m.invite.askAgain}</p>
		<Button href="/login">{m.invite.toLogin}</Button>
	{:else if invite.state === 'open'}
		<div class="about">
			<p>{m.invite.open(invite.inviter, m.roles[invite.role])}</p>
			<p class="dim">{m.invite.expires} <Time at={invite.expiresAt} />.</p>
		</div>
		<form method="POST" use:enhance>
			{#if form?.message}<Message kind="danger">{form.message}</Message>{/if}
			<Field
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
			<Field
				label={m.invite.displayName}
				name="displayName"
				autocomplete="nickname"
				required
				hint={m.invite.displayNameHint}
				value={form?.values?.displayName ?? ''}
				error={form?.fields?.displayName}
			/>
			<Field
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
			<Button kind="primary" type="submit">{m.invite.submit}</Button>
		</form>
	{/if}
</AuthCard>

<style>
	form,
	.about {
		display: grid;
		gap: var(--space-4);
	}
	.about {
		gap: var(--space-1);
	}
</style>

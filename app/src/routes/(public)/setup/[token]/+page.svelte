<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/messages';
	import AuthCard from '#lib/ui/AuthCard.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Message from '#lib/ui/Message.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{m.setup.title} · {m.app.name}</title></svelte:head>

<AuthCard subtitle={m.setup.title} wide>
	{#if !data.valid && !form}
		<Message kind="warn">{m.setup.invalid}</Message>
		<p class="dim">{m.setup.invalidHelp}</p>
		<Button href="/login">{m.setup.toLogin}</Button>
	{:else}
		<p class="dim">{m.setup.intro}</p>
		<form method="POST" use:enhance>
			{#if form?.message}<Message kind="danger">{form.message}</Message>{/if}
			<Field
				label={m.setup.username}
				name="username"
				autocomplete="username"
				autocapitalize="none"
				spellcheck={false}
				required
				hint={m.setup.usernameHint}
				value={form?.values?.username ?? ''}
				error={form?.fields?.username}
			/>
			<Field
				label={m.setup.displayName}
				name="displayName"
				autocomplete="nickname"
				required
				hint={m.setup.displayNameHint}
				value={form?.values?.displayName ?? ''}
				error={form?.fields?.displayName}
			/>
			<Field
				label={m.setup.password}
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength={10}
				maxlength={128}
				hint={m.setup.passwordHint}
				error={form?.fields?.password}
			/>
			<Button kind="primary" type="submit">{m.setup.submit}</Button>
		</form>
	{/if}
</AuthCard>

<style>
	form {
		display: grid;
		gap: var(--space-4);
	}
</style>

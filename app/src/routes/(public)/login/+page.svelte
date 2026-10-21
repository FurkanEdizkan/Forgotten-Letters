<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/messages';
	import AuthCard from '#lib/ui/AuthCard.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Message from '#lib/ui/Message.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
</script>

<svelte:head><title>{m.login.title} · {m.app.name}</title></svelte:head>

<AuthCard subtitle={m.login.title}>
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
		{#if form?.message}<Message kind="danger">{form.message}</Message>{/if}
		<Field
			label={m.login.username}
			name="username"
			autocomplete="username"
			autocapitalize="none"
			spellcheck={false}
			required
			value={form?.values?.username ?? ''}
			error={form?.fields?.username}
		/>
		<Field
			label={m.login.password}
			name="password"
			type="password"
			autocomplete="current-password"
			required
			error={form?.fields?.password}
		/>
		<Checkbox name="remember" label={m.login.remember} checked={!!form?.values?.remember} />
		<Button kind="primary" type="submit" disabled={busy}>{m.login.submit}</Button>
	</form>
</AuthCard>

<style>
	form {
		display: grid;
		gap: var(--space-4);
	}
</style>

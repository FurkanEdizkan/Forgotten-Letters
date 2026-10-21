<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/messages';
	import Card from '#lib/ui/Card.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Message from '#lib/ui/Message.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{m.forcedPassword.title} · {m.app.name}</title></svelte:head>

<div class="narrow">
	<h1>{m.forcedPassword.title}</h1>
	<Card>
		<p class="dim">{m.forcedPassword.intro}</p>
		<form method="POST" use:enhance>
			<input type="hidden" name="username" autocomplete="username" value={data.me.username} />
			{#if form?.message}<Message kind="danger">{form.message}</Message>{/if}
			<Field
				label={m.forcedPassword.current}
				name="current"
				type="password"
				autocomplete="current-password"
				required
				error={form?.fields?.current}
			/>
			<Field
				label={m.forcedPassword.newPassword}
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength={10}
				maxlength={128}
				hint={m.forcedPassword.newPasswordHint}
				error={form?.fields?.password}
			/>
			<div><Button kind="primary" type="submit">{m.forcedPassword.submit}</Button></div>
		</form>
	</Card>
</div>

<style>
	.narrow {
		display: grid;
		gap: var(--space-5);
		max-width: 28rem;
	}
	form {
		display: grid;
		gap: var(--space-4);
	}
</style>

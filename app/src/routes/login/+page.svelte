<script lang="ts">
	import { enhance } from '$app/forms';
	import Lockup from '$lib/components/Lockup.svelte';

	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Sign in · Carcass Front</title></svelte:head>

<main class="cover">
	<Lockup name="Carcass Front" />
	<form
		method="POST"
		class="page"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<h1>Sign in</h1>
		<label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value={form?.username ?? ''} /></label>
		<label>Password <input name="password" type="password" autocomplete="current-password" required /></label>
		<label class="remember"><input type="checkbox" name="remember" checked /> Remember me on this device</label>
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
		<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
		<p class="hint">Accounts are made by the Campaign Master. Ask them if you have none, or have forgotten your password.</p>
	</form>
	<a class="back" href="/">Back to the map</a>
</main>

<style>
	.cover {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 22px;
		min-height: 100vh;
		padding: 32px 16px;
		background: radial-gradient(circle at 50% 30%, var(--night-2), var(--night) 70%);
	}
	.cover :global(.lockup .name) {
		font-size: 2.6rem;
	}
	.page {
		display: grid;
		gap: 14px;
		width: min(24rem, 100%);
		padding: 22px 24px 20px;
		background: var(--paper);
		border-top: 2px solid var(--blood);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
	}
	h1 {
		margin: 0;
		font-size: 2rem;
	}
	label {
		display: grid;
		gap: 4px;
		font-weight: 600;
	}
	.error {
		margin: 0;
		color: var(--blood);
	}
	.hint {
		margin: 0;
		font-size: 0.88rem;
		color: var(--muted);
	}
	.back {
		color: var(--bone-dim);
	}
	.back:hover {
		color: var(--bone);
	}
	.remember {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 400;
	}
</style>

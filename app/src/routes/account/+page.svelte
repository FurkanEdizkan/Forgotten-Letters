<script lang="ts">
	import { enhance } from '$app/forms';
	import Lockup from '$lib/components/Lockup.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Your account · Carcass Front</title></svelte:head>

<main class="cover">
	<Lockup name="Carcass Front" />
	<form method="POST" action="?/password" class="page" use:enhance>
		<h1>{data.first ? 'Choose your password' : 'Change password'}</h1>
		{#if data.first}
			<p class="lede">You signed in with a password from the Campaign Master. Choose your own before going on.</p>
		{/if}
		<label>{data.first ? 'The password you were given' : 'Current password'} <input name="current" type="password" autocomplete="current-password" required /></label>
		<label>New password <small>(at least 8 characters)</small> <input name="next" type="password" autocomplete="new-password" minlength="8" required /></label>
		<label>New password again <input name="again" type="password" autocomplete="new-password" minlength="8" required /></label>
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
		<button>Save password</button>
		<p class="hint">Saving signs you out on every other device.</p>
	</form>
	<form method="POST" action="/logout"><button class="ghost signout">Sign out</button></form>
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
	.page {
		display: grid;
		gap: 14px;
		width: min(26rem, 100%);
		padding: 22px 24px 20px;
		background: var(--paper);
		border-top: 2px solid var(--blood);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
	}
	h1 {
		margin: 0;
		font-size: 1.9rem;
	}
	.lede,
	.hint {
		margin: 0;
		color: var(--ink-soft);
	}
	.hint {
		font-size: 0.88rem;
		color: var(--muted);
	}
	label {
		display: grid;
		gap: 4px;
		font-weight: 600;
	}
	label small {
		font-weight: 400;
		color: var(--muted);
	}
	.error {
		margin: 0;
		color: var(--blood);
	}
	.signout {
		color: var(--bone);
		border-color: rgba(236, 229, 211, 0.35);
	}
	.signout:hover {
		color: #fff;
		border-color: var(--ember);
	}
</style>

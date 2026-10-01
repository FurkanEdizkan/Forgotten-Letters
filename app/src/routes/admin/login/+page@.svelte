<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import CoverBand from '$lib/components/CoverBand.svelte';

	let { data, form } = $props();
	let busy = $state(false);
	const next = $derived(page.url.searchParams.get('next'));
</script>

<svelte:head><title>Campaign Master · Carcass Front</title></svelte:head>

<CoverBand back={false}>
	<p class="lead">The Campaign Master's door.</p>
	{#if data.signedInAs}
		<p class="lead">You are signed in as {data.signedInAs}. Signing in here replaces that.</p>
	{/if}
	<form
		method="POST"
		action={next ? `?next=${encodeURIComponent(next)}` : ''}
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value={form?.username ?? ''} /></label>
		<label>Password <input name="password" type="password" autocomplete="current-password" required /></label>
		<label class="remember"><input type="checkbox" name="remember" checked /> Remember me on this device</label>
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
		<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
	</form>
</CoverBand>

<style>
	.lead {
		margin: -6px 0 0;
		max-width: 30ch;
		text-align: center;
		color: var(--bone-dim);
		font-size: 0.95rem;
	}
</style>

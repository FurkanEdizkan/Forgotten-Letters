<script lang="ts">
	import { enhance } from '$app/forms';
	import CoverBand from '$lib/components/CoverBand.svelte';

	let { data, form } = $props();
	let busy = $state(false);
	const seatLabel = $derived(data.seat ? (/^Seat \d+$/.test(data.seat.name) ? data.seat.name : `seat ${data.seat.number ?? ''} (${data.seat.name})`) : '');
	const why: Record<string, string> = {
		used: 'This invite has been used already. If it was you, sign in instead.',
		expired: 'This invite link has expired. Ask the Campaign Master for a new one.',
		revoked: 'This invite link was withdrawn. Ask the Campaign Master for a new one.',
		unknown: 'This invite link is not valid. Check you copied all of it, or ask the Campaign Master for a new one.'
	};
</script>

<svelte:head><title>Join · {data.campaign ?? 'Carcass Front'}</title></svelte:head>

<CoverBand title={data.campaign ?? 'Carcass Front'}>
	{#if data.state === 'valid'}
		<h1 class="head">Join as {seatLabel}</h1>
		{#if data.signedInAs}
			<p class="hint">You are signed in as {data.signedInAs}. Joining makes a new account for this seat; <a href="/settings">sign out</a> first if this seat is meant for that account.</p>
		{/if}
		<form
			method="POST"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			<label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value={form?.username ?? ''} /></label>
			<label>Your name <input name="displayName" autocomplete="nickname" placeholder="as the others know you" value={form?.displayName ?? ''} /></label>
			<label>Email <input name="email" type="email" autocomplete="email" placeholder="optional" value={form?.email ?? ''} /></label>
			<label>Password <input name="password" type="password" autocomplete="new-password" required minlength="8" /></label>
			<label>Password again <input name="confirm" type="password" autocomplete="new-password" required minlength="8" /></label>
			{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
			<button disabled={busy}>{busy ? 'Joining…' : 'Join the campaign'}</button>
			<p class="hint">Next you build your warband and choose your Vision.</p>
		</form>
	{:else}
		<p class="sent" role="alert">{why[data.state] ?? why.unknown}</p>
		{#if data.state === 'used'}<p><a class="signin" href="/login">Sign in</a></p>{/if}
	{/if}
</CoverBand>

<style>
	.head {
		margin: 0;
		font-size: 1.5rem;
		text-align: center;
		color: var(--bone);
	}
	.signin {
		color: var(--bone);
	}
</style>

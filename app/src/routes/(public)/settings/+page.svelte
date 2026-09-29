<script lang="ts">
	import { enhance } from '$app/forms';
	import Lockup from '$lib/components/Lockup.svelte';
	import { CONFIGURE } from '$lib/nav';

	let { data, form } = $props();
</script>

<svelte:head><title>Settings · Carcass Front</title></svelte:head>

{#if data.first}
	<!-- Nothing else is reachable yet, so this stands alone without the panel. -->
	<main class="cover">
		<Lockup name="Carcass Front" />
		<form method="POST" action="?/password" class="card" use:enhance>
			<h1>Choose your password</h1>
			<p class="lede">You signed in with a password from the Campaign Master. Choose your own before going on.</p>
			<label>The password you were given <input name="current" type="password" autocomplete="current-password" required /></label>
			<label>New password <small>(at least 8 characters)</small> <input name="next" type="password" autocomplete="new-password" minlength="8" required /></label>
			<label>New password again <input name="again" type="password" autocomplete="new-password" minlength="8" required /></label>
			{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
			<button>Save password</button>
			<p class="hint">Saving signs you out on every other device.</p>
		</form>
		<form method="POST" action="/logout"><button class="ghost signout">Sign out</button></form>
	</main>
{:else}
	<h1>Settings</h1>

	<section>
		<h2>Your account</h2>
		<form method="POST" action="?/password" class="fields" use:enhance>
			<label>Current password <input name="current" type="password" autocomplete="current-password" required /></label>
			<label>New password <small>(at least 8 characters)</small> <input name="next" type="password" autocomplete="new-password" minlength="8" required /></label>
			<label>New password again <input name="again" type="password" autocomplete="new-password" minlength="8" required /></label>
			{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
			<button>Save password</button>
			<p class="hint">Saving signs you out on every other device.</p>
		</form>
	</section>

	{#if data.isAdmin}
		<section>
			<h2>Admin settings</h2>
			<p class="lede">What the campaign is built from. Only the Campaign Master can open these.</p>
			<ul class="menu">
				{#each CONFIGURE as item (item.href + item.label)}
					<li><a href={item.href}>{item.label}</a></li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}

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
	.card {
		display: grid;
		gap: 14px;
		width: min(26rem, 100%);
		padding: 22px 24px 20px;
		background: var(--paper);
		border-top: 2px solid var(--blood);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
	}
	section {
		margin: 28px 0;
	}
	.fields {
		display: grid;
		gap: 14px;
		max-width: 26rem;
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
	.lede,
	.hint {
		margin: 0;
		color: var(--ink-soft);
	}
	.hint {
		font-size: 0.88rem;
		color: var(--muted);
	}
	.error {
		margin: 0;
		color: var(--blood);
	}
	/* Ruled, not boxed: the book opens a list with a 2px ink rule and divides rows with hairlines. */
	.menu {
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
		border-top: 2px solid var(--ink);
	}
	.menu li {
		border-bottom: 1px solid var(--rule);
	}
	.menu a {
		display: block;
		padding: 10px 2px;
		color: var(--ink);
		text-decoration: none;
		font-weight: 600;
	}
	.menu a:hover {
		color: var(--blood);
	}
	.signout {
		color: var(--bone);
		border-color: rgba(236, 229, 211, 0.35);
	}
	.signout:hover {
		border-color: var(--ember);
	}
</style>

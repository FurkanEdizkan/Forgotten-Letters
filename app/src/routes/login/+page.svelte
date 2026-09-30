<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Lockup from '$lib/components/Lockup.svelte';

	let { form } = $props();
	let busy = $state(false);

	type Tab = 'signin' | 'signup' | 'reset';
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'signin', label: 'Sign in' },
		{ id: 'signup', label: 'Create account' },
		{ id: 'reset', label: 'Forgot password' }
	];
	const asTab = (v: string | null | undefined): Tab | null => (TABS.some((t) => t.id === v) ? (v as Tab) : null);
	// A failed or finished submission names its own tab; otherwise the address does.
	const tab = $derived<Tab>(asTab(form?.tab) ?? asTab(page.url.searchParams.get('tab')) ?? 'signin');
	// Where the visitor was before; kept across tabs and form posts so sign-in returns them there.
	const next = $derived(page.url.searchParams.get('next'));
	const withNext = (q: URLSearchParams) => {
		if (next) q.set('next', next);
		return q;
	};
	const tabHref = (id: Tab) => {
		const q = withNext(new URLSearchParams(id === 'signin' ? {} : { tab: id })).toString();
		return `/login${q ? `?${q}` : ''}`;
	};
	const action = (name: Tab) => `?/${name}${next ? `&next=${encodeURIComponent(next)}` : ''}`;

	const submit = () => {
		busy = true;
		return async ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			busy = false;
		};
	};
</script>

<svelte:head><title>{TABS.find((t) => t.id === tab)?.label} · Carcass Front</title></svelte:head>

<main class="cover">
	<!-- Pictures from the campaign's history and heroes go here later; for now, the night. -->
	<div class="backdrop" aria-hidden="true"></div>

	<section class="band">
		<div class="inner">
			<Lockup name="Carcass Front" />
			<nav class="tabs" aria-label="Account">
				{#each TABS as t (t.id)}
					<a href={tabHref(t.id)} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</a>
				{/each}
			</nav>

			{#if tab === 'signin'}
				<form method="POST" action={action('signin')} use:enhance={submit}>
					<label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value={form?.username ?? ''} /></label>
					<label>Password <input name="password" type="password" autocomplete="current-password" required /></label>
					<label class="remember"><input type="checkbox" name="remember" checked /> Remember me on this device</label>
					{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
					<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
				</form>
			{:else if tab === 'signup'}
				{#if form?.sent}
					<p class="sent" role="status">Sent to the Campaign Master for approval. You can sign in once they accept it.</p>
				{:else}
					<form method="POST" action={action('signup')} use:enhance={submit}>
						<label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value={form?.username ?? ''} /></label>
						<label>Display name <input name="displayName" autocomplete="nickname" placeholder="optional" value={form && 'displayName' in form ? (form.displayName ?? '') : ''} /></label>
						<label>Password <input name="password" type="password" autocomplete="new-password" required minlength="8" /></label>
						<label>Password again <input name="confirm" type="password" autocomplete="new-password" required minlength="8" /></label>
						{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
						<button disabled={busy}>{busy ? 'Sending…' : 'Request an account'}</button>
						<p class="hint">The Campaign Master approves every account.</p>
					</form>
				{/if}
			{:else if form?.sent}
				<p class="sent" role="status">If that account exists, the Campaign Master has been asked to reset it.</p>
			{:else}
				<form method="POST" action={action('reset')} use:enhance={submit}>
					<label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value={form?.username ?? ''} /></label>
					{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
					<button disabled={busy}>{busy ? 'Sending…' : 'Ask for a reset'}</button>
					<p class="hint">The Campaign Master will give you a temporary password to sign in with.</p>
				</form>
			{/if}
		</div>
	</section>

	<a class="back" href="/">Back to the map</a>
</main>

<style>
	.cover {
		position: relative;
		display: grid;
		grid-template-rows: 1fr auto 1fr;
		min-height: 100vh;
		background: var(--night);
		color: var(--bone);
	}
	.backdrop {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 30%, var(--night-2), var(--night) 70%);
		background-size: cover;
		background-position: center;
	}
	/* The half-transparent band across the middle that carries everything. */
	.band {
		position: relative;
		grid-row: 2;
		padding: 28px 16px 30px;
		background: rgba(10, 9, 7, 0.6);
		border-block: 1px solid var(--blood);
	}
	.inner {
		display: grid;
		justify-items: center;
		gap: 18px;
		width: min(24rem, 100%);
		margin: 0 auto;
	}
	.inner :global(.lockup) {
		justify-items: center;
	}
	.inner :global(.lockup .name) {
		font-size: 2.6rem;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px 18px;
	}
	.tabs a {
		padding: 2px 0;
		color: var(--bone-dim);
		font-family: var(--font-title);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-decoration: none;
		border-bottom: 2px solid transparent;
	}
	.tabs a:hover {
		color: var(--bone);
	}
	.tabs a[aria-current='page'] {
		color: var(--bone);
		border-bottom-color: var(--blood-bright);
	}
	form {
		display: grid;
		gap: 14px;
		width: 100%;
	}
	label {
		display: grid;
		gap: 4px;
		font-weight: 600;
	}
	/* The house button is night on night here: give it the map's blood fill so it reads on the band. */
	form button {
		background: #8f1f18;
		color: var(--bone);
		border: 1px solid #b3261e;
	}
	form button:hover:not(:disabled) {
		background: #a3170f;
	}
	.remember {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 400;
	}
	.error {
		margin: 0;
		color: var(--ember);
	}
	.hint {
		margin: 0;
		font-size: 0.88rem;
		color: var(--bone-dim);
	}
	.sent {
		margin: 0;
		text-align: center;
	}
	.back {
		position: relative;
		grid-row: 3;
		justify-self: center;
		align-self: start;
		margin-top: 18px;
		color: var(--bone-dim);
	}
	.back:hover {
		color: var(--bone);
	}
</style>

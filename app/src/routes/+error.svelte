<script lang="ts">
	import { page } from '$app/state';

	/** Any error the app raises, on a book page: what happened, and a way back. */
	const status = $derived(page.status);
	const title = $derived(status === 403 ? 'Not for you' : status === 404 ? 'Not found' : status === 401 ? 'Sign in first' : 'Something went wrong');
	const signedIn = $derived(!!(page.data as { user?: unknown }).user);
	// The admin has its own door, which only the Campaign Master can get through.
	const door = $derived(`${page.url.pathname.startsWith('/admin') || page.url.pathname.startsWith('/settings/admin') ? '/admin/login' : '/login'}?next=${encodeURIComponent(page.url.pathname)}`);
</script>

<svelte:head><title>{title} · Carcass Front</title></svelte:head>

<main class="sheet">
	<p class="code">{status}</p>
	<h1>{title}</h1>
	<p class="why">{page.error?.message ?? ''}</p>
	<nav class="ways">
		<a class="button" href="/">The live map</a>
		{#if status === 403 && signedIn}
			<form method="POST" action="/logout?next={encodeURIComponent(door)}"><button class="ghost">Sign in as someone else</button></form>
		{:else if !signedIn}
			<a class="button ghost" href={door}>Sign in</a>
		{/if}
	</nav>
	<footer class="running-foot">Carcass Front</footer>
</main>

<style>
	.sheet {
		max-width: 34rem;
		margin: 12vh auto 0;
		padding: 28px clamp(16px, 4vw, 32px) 20px;
		background: var(--paper);
		border-top: 2px solid var(--blood);
	}
	.code {
		margin: 0;
		font-family: var(--font-title);
		font-size: 1rem;
		letter-spacing: 0.12em;
		color: var(--muted);
	}
	h1 {
		margin: 4px 0 8px;
	}
	.why {
		margin: 0 0 20px;
		color: var(--ink-soft);
	}
	.ways {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.ways form {
		margin: 0;
	}
	.running-foot {
		margin-top: 28px;
	}
</style>

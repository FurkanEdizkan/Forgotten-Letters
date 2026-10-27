<!--
  /login: sign-in in the first-run split (decision d1): the emblem in the dark well on the left, the form on the
  right with the glass primary button. Same form, field names and action as before.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { m } from '#lib/messages';
	import SplitStage, { SPLIT } from '#lib/ui/SplitStage.svelte';
	import WizardField from '#lib/ui/WizardField.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import GlassButton from '#lib/ui/GlassButton.svelte';
	import Callout from '#lib/ui/Callout.svelte';
	import { emblemIn, entrance } from '#lib/ui/motion';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
	let emblem: HTMLElement | null = $state(null);
	let col: HTMLElement | null = $state(null);

	onMount(() => {
		emblemIn(emblem);
		if (col) entrance(Array.from(col.children), { delay: 150, gap: 50 });
	});
</script>

<svelte:head><title>{m.login.title} · {m.app.name}</title></svelte:head>

<SplitStage split={SPLIT.welcome} bind:emblem>
	<main class="field">
		<div class="col" bind:this={col}>
			<header>
				<p class="brand" aria-hidden="true">{m.app.name}</p>
				<h1 class="title">{m.login.title}</h1>
			</header>
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
				{#if form?.message}<Callout kind="danger">{form.message}</Callout>{/if}
				<WizardField
					label={m.login.username}
					name="username"
					autocomplete="username"
					autocapitalize="none"
					spellcheck={false}
					required
					value={form?.values?.username ?? ''}
					error={form?.fields?.username}
				/>
				<WizardField
					label={m.login.password}
					name="password"
					type="password"
					autocomplete="current-password"
					required
					error={form?.fields?.password}
				/>
				<Checkbox name="remember" label={m.login.remember} checked={!!form?.values?.remember} />
				<GlassButton variant="primary" type="submit" disabled={busy} class="go">
					{busy ? m.login.signingIn : m.login.submit}
				</GlassButton>
			</form>
			<p class="note">{m.login.noAccount}</p>
		</div>
	</main>
</SplitStage>

<style>
	.field {
		display: grid;
		align-items: center;
		min-height: 100vh;
		min-height: 100dvh;
		padding: var(--space-6) 9% var(--space-6) 8%;
	}
	.col {
		display: grid;
		gap: var(--space-5);
		width: 100%;
		max-width: 28rem;
	}
	header {
		display: grid;
		gap: var(--space-1);
	}
	.brand {
		font-family: var(--font-display);
		font-size: clamp(2.4rem, 1.6rem + 1.8vw, 3.4rem);
		letter-spacing: var(--track-display);
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
	}
	/* The page heading is the action; the name above is the brand, so it is not read twice. */
	.title {
		font-family: var(--font-body);
		font-size: 1.15rem;
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		color: var(--bone-dim);
	}
	form {
		display: grid;
		gap: var(--space-4);
	}
	form :global(.go) {
		width: 100%;
		margin-top: var(--space-1);
	}
	.note {
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
</style>

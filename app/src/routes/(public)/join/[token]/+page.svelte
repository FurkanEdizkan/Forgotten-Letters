<!--
  /join/[token]: a seat link (decision 48: the first-run split with glass buttons). Open: the campaign's name, the
  seat on offer and the link's facts; signed in, one "Take the seat"; signed out, "Sign in" or "Create an
  account", each taking the seat in the same step. Used, revoked, expired and unknown links say so, with the way on.
-->
<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { m } from '#lib/messages';
	import { dayYear, day } from '#lib/ui/campaign-facts';
	import VisitorStage from '#lib/ui/VisitorStage.svelte';
	import WizardField from '#lib/ui/WizardField.svelte';
	import GlassButton from '#lib/ui/GlassButton.svelte';
	import Segmented from '#lib/ui/Segmented.svelte';
	import Callout from '#lib/ui/Callout.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const j = m.join;

	const pv = $derived(data.preview);
	// A failed sign-up stays on the sign-up form.
	const startWith = () => (form?.values?.op === 'signup' ? 'signup' : 'signin');
	let how = $state(startWith());
	let busy = $state(false);

	const submit: SubmitFunction = () => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	};
	const tabs = [
		{ id: 'signin', label: j.signIn },
		{ id: 'signup', label: j.signUp }
	];
</script>

<svelte:head><title>{j.title} · {m.app.name}</title></svelte:head>

<VisitorStage>
	{#if pv.state === 'open'}
		<header>
			<h1>{pv.campaign.name}</h1>
			<p class="lead">{j.invited(pv.seatName)}</p>
			<p class="dim">
				{j.meta(m.campaigns.kinds[pv.campaign.kind], pv.campaign.cmName, day(pv.expiresAt))}
			</p>
		</header>
		{#if form?.message}<Callout kind="danger">{form.message}</Callout>{/if}
		{#if data.signedInAs}
			<form method="POST" action="?/take" use:enhance={submit}>
				<p class="dim">{j.signedInAs(data.signedInAs)}</p>
				<GlassButton variant="primary" type="submit" disabled={busy} class="go">
					{busy ? j.busy : j.take}
				</GlassButton>
			</form>
		{:else}
			<Segmented label={j.how} {tabs} bind:value={how}>
				{#snippet panel(id)}
					{#if id === 'signin'}
						<form method="POST" action="?/signin" use:enhance={submit}>
							<input type="hidden" name="op" value="signin" />
							<WizardField
								label={j.username}
								name="username"
								autocomplete="username"
								autocapitalize="none"
								spellcheck={false}
								required
								value={form?.values?.op === 'signin' ? String(form.values.username ?? '') : ''}
								error={form?.values?.op === 'signin' ? form.fields?.username : null}
							/>
							<WizardField
								label={j.password}
								name="password"
								type="password"
								autocomplete="current-password"
								required
								error={form?.values?.op === 'signin' ? form.fields?.password : null}
							/>
							<GlassButton variant="primary" type="submit" disabled={busy} class="go">
								{busy ? j.busy : j.signInSubmit}
							</GlassButton>
						</form>
					{:else}
						<form method="POST" action="?/signup" use:enhance={submit}>
							<input type="hidden" name="op" value="signup" />
							<WizardField
								label={j.username}
								name="username"
								autocomplete="username"
								autocapitalize="none"
								spellcheck={false}
								required
								hint={j.usernameHint}
								value={form?.values?.op === 'signup' ? String(form.values.username ?? '') : ''}
								error={form?.values?.op === 'signup' ? form.fields?.username : null}
							/>
							<WizardField
								label={j.displayName}
								name="displayName"
								autocomplete="nickname"
								required
								hint={j.displayNameHint}
								value={form?.values?.op === 'signup' ? String(form.values.displayName ?? '') : ''}
								error={form?.values?.op === 'signup' ? form.fields?.displayName : null}
							/>
							<WizardField
								label={j.password}
								name="password"
								type="password"
								autocomplete="new-password"
								required
								minlength={10}
								maxlength={128}
								hint={j.passwordHint}
								error={form?.values?.op === 'signup' ? form.fields?.password : null}
							/>
							<GlassButton variant="primary" type="submit" disabled={busy} class="go">
								{busy ? j.busy : j.signUpSubmit}
							</GlassButton>
						</form>
					{/if}
				{/snippet}
			</Segmented>
			<p class="note">{j.later}</p>
		{/if}
	{:else}
		<header>
			<h1>
				{pv.state === 'expired'
					? j.expiredTitle
					: pv.state === 'unknown'
						? j.unknownTitle
						: pv.state === 'revoked'
							? j.revokedTitle
							: j.usedTitle}
			</h1>
			<p class="lead">
				{#if pv.state === 'expired'}{j.expired(dayYear(pv.expiresAt))}
				{:else if pv.state === 'unknown'}{j.unknown}
				{:else if pv.state === 'revoked'}{j.revoked(pv.campaign.name)}
				{:else}{j.used(pv.campaign.name)}{/if}
			</p>
		</header>
		<p class="dim">{j.askAgain}</p>
		<div>
			{#if data.signedInAs}
				<GlassButton href="/campaigns">{m.campaigns.backToList}</GlassButton>
			{:else}
				<GlassButton href="/login">{j.toLogin}</GlassButton>
			{/if}
		</div>
	{/if}
</VisitorStage>

<style>
	header,
	form {
		display: grid;
		gap: var(--space-2);
	}
	form {
		gap: var(--space-4);
	}
	h1 {
		overflow-wrap: anywhere;
	}
	.lead {
		font-size: 1.15rem;
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

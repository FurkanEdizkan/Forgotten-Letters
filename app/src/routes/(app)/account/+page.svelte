<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/messages';
	import Card from '#lib/ui/Card.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Message from '#lib/ui/Message.svelte';
	import Time from '#lib/ui/Time.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** The result of one of this page's forms, by its hidden `op`. */
	const result = (op: string) =>
		form && 'done' in form
			? form.op === op
				? { ok: true as const }
				: null
			: form?.values?.op === op
				? { ok: false as const, message: form.message, fields: form.fields }
				: null;
	const name = $derived(result('name'));
	const pass = $derived(result('password'));
	const everywhere = $derived(result('everywhere'));

	/** A short browser and system from a user-agent string. */
	function deviceOf(ua: string | null) {
		if (!ua) return m.account.unknownDevice;
		const browser = /Edg\//.test(ua)
			? 'Edge'
			: /Firefox\//.test(ua)
				? 'Firefox'
				: /Chrome\//.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: null;
		const os = /Windows/.test(ua)
			? 'Windows'
			: /Mac OS X/.test(ua)
				? 'macOS'
				: /Android/.test(ua)
					? 'Android'
					: /iPhone|iPad/.test(ua)
						? 'iOS'
						: /Linux/.test(ua)
							? 'Linux'
							: null;
		return browser && os ? `${browser} on ${os}` : (browser ?? os ?? ua.slice(0, 60));
	}
</script>

<svelte:head><title>{m.account.title} · {m.app.name}</title></svelte:head>

<h1>{m.account.title}</h1>
<p class="dim">{m.account.username}: <code>{data.me.username}</code></p>

<div class="grid">
	<Card title={m.account.nameHeading}>
		<form
			method="POST"
			action="?/name"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
		>
			<input type="hidden" name="op" value="name" />
			{#if name?.ok}<Message>{m.account.nameSaved}</Message>{/if}
			{#if name && !name.ok}<Message kind="danger">{name.message}</Message>{/if}
			<Field
				label={m.account.displayName}
				name="displayName"
				autocomplete="nickname"
				required
				maxlength={60}
				value={data.me.displayName}
				hint={m.account.displayNameHint}
				error={name && !name.ok ? name.fields?.displayName : null}
			/>
			<div><Button kind="primary" type="submit">{m.common.save}</Button></div>
		</form>
	</Card>

	<Card title={m.account.passwordHeading}>
		<form method="POST" action="?/password" use:enhance>
			<input type="hidden" name="op" value="password" />
			<input type="hidden" name="username" autocomplete="username" value={data.me.username} />
			{#if pass?.ok}<Message>{m.account.passwordChanged}</Message>{/if}
			{#if pass && !pass.ok}<Message kind="danger">{pass.message}</Message>{/if}
			<Field
				label={m.account.current}
				name="current"
				type="password"
				autocomplete="current-password"
				required
				error={pass && !pass.ok ? pass.fields?.current : null}
			/>
			<Field
				label={m.account.newPassword}
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength={10}
				maxlength={128}
				hint={m.account.newPasswordHint}
				error={pass && !pass.ok ? pass.fields?.password : null}
			/>
			<div><Button type="submit">{m.account.changePassword}</Button></div>
		</form>
	</Card>
</div>

<section class="devices">
	<h2>{m.account.devicesHeading}</h2>
	<p class="dim">{m.account.devicesIntro}</p>
	{#if everywhere?.ok}<Message>{m.account.signedOutEverywhere}</Message>{/if}
	<table class="table">
		<thead>
			<tr>
				<th scope="col">{m.account.device}</th>
				<th scope="col">{m.account.address}</th>
				<th scope="col">{m.account.kind}</th>
				<th scope="col">{m.account.lastSeen}</th>
			</tr>
		</thead>
		<tbody>
			{#each data.devices as d, i (i)}
				<tr>
					<td>
						{deviceOf(d.userAgent)}
						{#if d.current}<span class="this">{m.account.thisDevice}</span>{/if}
					</td>
					<td><code>{d.ip ?? '—'}</code></td>
					<td class="dim">{d.remember ? m.account.remembered : m.account.browserSession}</td>
					<td><Time at={d.lastSeenAt} /></td>
				</tr>
			{/each}
		</tbody>
	</table>
	<form method="POST" action="?/everywhere" use:enhance>
		<input type="hidden" name="op" value="everywhere" />
		<ConfirmButton
			label={m.account.signOutEverywhere}
			confirm={m.account.signOutEverywhereConfirm}
		/>
	</form>
</section>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
		gap: var(--space-5);
	}
	form {
		display: grid;
		gap: var(--space-4);
	}
	.devices {
		display: grid;
		gap: var(--space-3);
		justify-items: start;
	}
	.devices table {
		margin-top: var(--space-2);
	}
	.this {
		margin-left: var(--space-2);
		padding: 0 var(--space-2);
		border: var(--border-hairline) solid var(--ok);
		color: var(--ok);
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
	}
</style>

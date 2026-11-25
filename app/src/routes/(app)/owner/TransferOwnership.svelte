<!--
  Transfer ownership, under the People table (decision 80). A search box (a GET form on the page's own query, so it
  works without scripts; with scripts it searches as you type) finds active accounts other than the Owner; the
  matches are radio rows with their role. The Owner's password and a confirm in place that names both people hand
  the copy over; the page then moves to /admin. Its own form, not PersonPicker, so the button can confirm in place.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import Search from '@lucide/svelte/icons/search';
	import { m } from '#lib/messages';
	import type { Role } from '#lib/roles';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Field from '#lib/ui/Field.svelte';
	import Message from '#lib/ui/Message.svelte';
	import RoleBadge from '#lib/ui/RoleBadge.svelte';

	type Candidate = {
		id: string;
		displayName: string;
		username: string;
		role: Role;
		version: number;
	};
	type Props = {
		find: string;
		after: string | null;
		candidates: Candidate[];
		result: { error: string | null; fields: Record<string, string> };
	};
	let { find, after, candidates, result }: Props = $props();
	const t = m.people.transfer;

	// The first match is picked until the Owner picks another; its row version travels with the form.
	let chosen = $state<string | null>(null);
	const picked = $derived(candidates.find((c) => c.id === chosen) ?? candidates[0] ?? null);

	let finder: HTMLFormElement | null = $state(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	function oninput(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).value.trim();
		clearTimeout(timer);
		if (v) timer = setTimeout(() => finder?.requestSubmit(), 300);
	}
</script>

<section class="transfer" aria-labelledby="transfer-heading">
	<h3 id="transfer-heading">{t.heading}</h3>
	<p class="dim">{t.intro(m.roles.admin)}</p>
	<form
		method="GET"
		role="search"
		class="find"
		bind:this={finder}
		onsubmit={() => clearTimeout(timer)}
		data-sveltekit-keepfocus
		data-sveltekit-noscroll
		data-sveltekit-replacestate
	>
		{#if after}<input type="hidden" name="after" value={after} />{/if}
		<Field
			label={t.newOwner}
			name="find"
			type="search"
			autocomplete="off"
			maxlength={32}
			placeholder={t.placeholder}
			value={find}
			{oninput}
		/>
		<Button type="submit" icon={Search}>{t.find}</Button>
	</form>
	{#if !find}
		<p class="dim small">{t.hint}</p>
	{:else if candidates.length && picked}
		<form class="pick" method="POST" action="?/transfer" use:enhance>
			<input type="hidden" name="op" value="transfer" />
			<input type="hidden" name="version" value={picked.version} />
			<fieldset>
				<legend class="visually-hidden">{t.people}</legend>
				{#each candidates as c (c.id)}
					<label class="person">
						<input
							type="radio"
							name="to"
							value={c.id}
							checked={c.id === picked.id}
							onchange={() => (chosen = c.id)}
						/>
						<span>{c.displayName}</span>
						<code class="dim">{c.username}</code>
						<span class="role"><RoleBadge role={c.role} /></span>
					</label>
				{/each}
			</fieldset>
			<div class="go">
				<Field
					label={t.password}
					name="password"
					type="password"
					autocomplete="current-password"
					required
					error={result.fields.password}
				/>
				<ConfirmButton label={t.button} confirm={t.confirm(picked.displayName, m.roles.admin)} />
			</div>
			{#if result.error && !result.fields.password}<Message kind="danger">{result.error}</Message
				>{/if}
		</form>
	{:else}
		<p class="dim">{t.noMatch}</p>
	{/if}
</section>

<style>
	.transfer {
		display: grid;
		gap: var(--space-3);
		/* A set width, so the panel does not jump when the armed confirm grows. */
		width: 100%;
		max-width: 52rem;
		margin-top: var(--space-6);
	}
	.find,
	.go {
		display: flex;
		align-items: end;
		gap: var(--space-3);
	}
	.find :global(.field) {
		flex: 1;
	}
	/* The armed confirm names both people and grows; it wraps under the field rather than squeezing it. */
	.go {
		flex-wrap: wrap;
		align-items: start;
	}
	.go :global(.field) {
		flex: 0 0 15rem;
	}
	/* The confirm button lines up with the password well (under its label), not with the error line. */
	.go > :global(button) {
		margin-top: calc(var(--size-label) * var(--line-body) + var(--space-1));
	}
	.pick {
		display: grid;
		gap: var(--space-3);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		border-top: var(--border-opening) solid var(--rule-strong);
	}
	.person {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--border-hairline) solid var(--rule);
		cursor: pointer;
		transition: background-color var(--duration-fast) var(--easing);
	}
	.person:hover,
	.person:has(input:checked) {
		background: var(--panel-hover);
	}
	.person input {
		margin: 0;
		accent-color: var(--blood-bright);
	}
	.role {
		margin-left: auto;
	}
	.small {
		font-size: var(--size-label);
	}
</style>

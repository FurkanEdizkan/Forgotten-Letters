<!--
  Pick an existing account by name: a search box (a GET form on the page's own query, so it works without
  scripts; with scripts it searches as you type) and, under it, the people who match as radio rows with their
  display name and username only. Picking posts `userId` (plus whatever `extra` adds, such as a seat) to `action`.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import Search from '@lucide/svelte/icons/search';
	import Button from './Button.svelte';
	import Field from './Field.svelte';
	import Message from './Message.svelte';

	type Props = {
		label: string;
		placeholder: string;
		findLabel: string;
		/** The query key the page's load reads, for example "find". */
		param: string;
		/** The tab to come back to after a search. */
		tab: string;
		query: string;
		people: { id: string; displayName: string; username: string }[];
		peopleLabel: string;
		noMatch: string;
		action: string;
		op: string;
		submit: string;
		error?: string | null;
		extra?: Snippet;
	};
	let {
		label,
		placeholder,
		findLabel,
		param,
		tab,
		query,
		people,
		peopleLabel,
		noMatch,
		action,
		op,
		submit,
		error,
		extra
	}: Props = $props();

	let finder: HTMLFormElement | null = $state(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	function oninput(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).value.trim();
		clearTimeout(timer);
		if (v) timer = setTimeout(() => finder?.requestSubmit(), 300);
	}
</script>

<div class="picker">
	<form
		method="GET"
		role="search"
		class="find"
		bind:this={finder}
		data-sveltekit-keepfocus
		data-sveltekit-noscroll
		data-sveltekit-replacestate
	>
		<input type="hidden" name="tab" value={tab} />
		<Field
			{label}
			name={param}
			type="search"
			autocomplete="off"
			maxlength={32}
			{placeholder}
			value={query}
			{oninput}
		/>
		<Button type="submit" icon={Search}>{findLabel}</Button>
	</form>
	{#if query}
		{#if people.length}
			<form class="pick" method="POST" {action} use:enhance>
				<input type="hidden" name="op" value={op} />
				<fieldset>
					<legend class="visually-hidden">{peopleLabel}</legend>
					{#each people as p, i (p.id)}
						<label class="person">
							<input type="radio" name="userId" value={p.id} checked={i === 0} />
							<span>{p.displayName}</span>
							<code class="dim">{p.username}</code>
						</label>
					{/each}
				</fieldset>
				<div class="go">
					{#if extra}{@render extra()}{/if}
					<Button kind="primary" type="submit">{submit}</Button>
				</div>
			</form>
		{:else}
			<p class="dim">{noMatch}</p>
		{/if}
	{/if}
	{#if error}<Message kind="danger">{error}</Message>{/if}
</div>

<style>
	.picker {
		display: grid;
		gap: var(--space-3);
		max-width: 44rem;
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
</style>

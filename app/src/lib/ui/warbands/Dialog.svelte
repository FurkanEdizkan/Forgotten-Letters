<!--
  A builder dialog (DESIGN.md §6: square, a panel with the overlay shadow): the browser's own modal <dialog>, so
  focus stays inside and Escape closes it. It opens when mounted; closing it (Escape, the Close button or the
  backdrop) calls `onclose`, which takes its query off the address.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/messages';

	type Props = { title: string; onclose: () => void; children: Snippet; wide?: boolean };
	let { title, onclose, children, wide = false }: Props = $props();
	const uid = $props.id();
	let el: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (el && !el.open) el.showModal();
	});
</script>

<dialog
	bind:this={el}
	class:wide
	aria-labelledby="{uid}-t"
	{onclose}
	onclick={(e) => {
		if (e.target === el) el?.close();
	}}
>
	<div class="in">
		<header>
			<h2 id="{uid}-t">{title}</h2>
			<button
				type="button"
				class="x"
				aria-label={m.warbands.builder.close}
				onclick={() => el?.close()}><X size={20} aria-hidden={true} /></button
			>
		</header>
		{@render children()}
	</div>
</dialog>

<style>
	dialog {
		width: min(44rem, calc(100vw - 4rem));
		max-height: calc(100vh - 4rem);
		padding: 0;
		background: var(--panel);
		color: var(--bone);
		border: var(--border-hairline) solid var(--rule-strong);
		border-top: var(--border-card-top) solid var(--blood);
		box-shadow: var(--shadow-overlay);
	}
	dialog.wide {
		width: min(64rem, calc(100vw - 4rem));
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	.in {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-4) var(--space-5) var(--space-5);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.x {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		background: none;
		border: var(--border-hairline) solid var(--rule-strong);
		color: var(--bone);
		cursor: pointer;
	}
	.x:hover {
		border-color: var(--blood-bright);
	}
</style>

<script lang="ts">
	import { enhance } from '$app/forms';
	import Download from '@lucide/svelte/icons/download';
	import { m, fileSize } from '#lib/messages';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Message from '#lib/ui/Message.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Time from '#lib/ui/Time.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state<string | null>(null);
</script>

<svelte:head><title>{m.backups.heading} · {m.app.name}</title></svelte:head>

<section>
	<h2>{m.backups.heading}</h2>
	<p class="dim">{m.backups.intro}</p>
	{#if form?.safety}<Message>{m.backups.restored(form.safety)}</Message>{/if}
	{#if form?.message}<Message kind="danger">{form.message}</Message>{/if}
	{#if data.backups.length}
		<table class="table">
			<thead>
				<tr>
					<th scope="col">{m.backups.file}</th>
					<th scope="col">{m.backups.created}</th>
					<th scope="col" class="num">{m.backups.size}</th>
					<th scope="col"><span class="visually-hidden">{m.people.actions}</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.backups as b (b.name)}
					<tr>
						<td><code>{b.name}</code></td>
						<td><Time at={b.createdAt} /></td>
						<td class="num">{fileSize(b.size)}</td>
						<td
							><div class="actions">
								<Button href="/owner/backups/{encodeURIComponent(b.name)}" download icon={Download}
									>{m.backups.download}</Button
								>
								<form
									method="POST"
									action="?/restore"
									use:enhance={() => {
										busy = b.name;
										return async ({ update }) => {
											await update();
											busy = null;
										};
									}}
								>
									<input type="hidden" name="name" value={b.name} />
									{#if busy === b.name}
										<Button disabled>{m.backups.restore}…</Button>
									{:else}
										<ConfirmButton label={m.backups.restore} confirm={m.backups.restoreConfirm} />
									{/if}
								</form>
							</div></td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<EmptyState text={m.backups.empty} />
	{/if}
</section>

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
	table {
		margin-top: var(--space-2);
	}
	code {
		white-space: nowrap;
	}
	.actions {
		display: flex;
		gap: var(--space-2);
		justify-content: flex-end;
	}
</style>

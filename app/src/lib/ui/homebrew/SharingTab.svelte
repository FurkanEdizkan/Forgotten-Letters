<!--
  The homebrew editor's Sharing tab: whether the set is private or shared with everyone here (and the button to
  change it), export as a file, and delete for good (press twice). Refusals (in use by others, a private base)
  show here.
-->
<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import type { ApiHomebrew } from '#lib/schemas/homebrew';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import Button from '#lib/ui/Button.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Message from '#lib/ui/Message.svelte';

	type Props = { homebrew: ApiHomebrew; copiedFrom: string | null; form: FormResult };
	let { homebrew, copiedFrom, form }: Props = $props();
	const s = m.homebrew.sharing;
	const shared = $derived(homebrew.visibility === 'shared');
	const shareResult = $derived(resultOf(form, 'share'));
	const removeResult = $derived(resultOf(form, 'remove'));
	const keep =
		() =>
		({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<div class="tab">
	{#if copiedFrom}<p class="dim">{m.homebrew.editor.copiedFrom(copiedFrom)}</p>{/if}
	<section>
		<p>{shared ? s.shared : s.private}</p>
		{#if homebrew.mine}
			<form method="POST" action="?/share" use:enhance={keep}>
				<input type="hidden" name="op" value="share" />
				<input type="hidden" name="on" value={shared ? 'false' : 'true'} />
				<Button kind={shared ? 'ghost' : 'primary'} type="submit"
					>{shared ? s.unshare : s.share}</Button
				>
			</form>
		{/if}
		{#if shareResult.error}<Message kind="warn">{shareResult.error}</Message>{/if}
	</section>
	<section>
		<div>
			<Button icon={Download} href="/api/v1/homebrew/{homebrew.id}/export" download
				>{s.export}</Button
			>
		</div>
		<p class="dim small">{s.exportHint}</p>
	</section>
	{#if homebrew.mine}
		<section>
			<form method="POST" action="?/remove" use:enhance={keep}>
				<input type="hidden" name="op" value="remove" />
				<ConfirmButton label={s.remove} confirm={s.removeConfirm} />
			</form>
			{#if removeResult.error}<Message kind="warn">{removeResult.error}</Message>{/if}
		</section>
	{/if}
</div>

<style>
	.tab,
	section {
		display: grid;
		gap: var(--space-3);
		max-width: 52rem;
	}
	.tab {
		gap: var(--space-6);
	}
	.small {
		font-size: var(--size-label);
	}
</style>

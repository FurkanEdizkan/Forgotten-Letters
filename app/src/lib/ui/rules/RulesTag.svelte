<!--
  A warband's or campaign's rules as players read them (2026-11-03): "1.0.1", "1.0.2 (Carcass Front)",
  "1.0.2 (Preview)". A chip like the keyword chips; a preview (not an official release) gets the warning edge and
  says so on hover and to screen readers.
-->
<script lang="ts">
	import { m } from '#lib/messages';

	type Props = { rules: { text: string; preview: boolean } };
	let { rules }: Props = $props();
</script>

<span
	class="tag data"
	class:preview={rules.preview}
	data-rules={rules.text}
	title={rules.preview ? m.warbands.builder.previewTag : undefined}
	>{rules.text}{#if rules.preview}<span class="visually-hidden">
			— {m.warbands.builder.previewTag}</span
		>{/if}</span
>

<style>
	.tag {
		display: inline-block;
		margin-left: var(--space-1);
		padding: 0 var(--space-2);
		background: var(--panel-raised);
		border: var(--border-hairline) solid var(--rule);
		border-left: var(--border-chip-edge) solid var(--rule-strong);
		color: var(--bone-dim);
		font-size: var(--size-label);
		line-height: 1.6;
		white-space: nowrap;
	}
	.preview {
		border-left-color: var(--warn);
		color: var(--bone);
	}
</style>

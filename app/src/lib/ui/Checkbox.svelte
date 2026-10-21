<!-- A square checkbox in an inset box with a drawn tick; the whole label is clickable. -->
<script lang="ts">
	type Props = { name: string; label: string; checked?: boolean; hint?: string };
	let { name, label, checked = false, hint }: Props = $props();
</script>

<label class="check">
	<input type="checkbox" {name} {checked} />
	<span class="box" aria-hidden="true"></span>
	<span
		>{label}{#if hint}<span class="hint">{hint}</span>{/if}</span
	>
</label>

<style>
	.check {
		display: inline-flex;
		align-items: flex-start;
		gap: var(--space-2);
		cursor: pointer;
		position: relative;
	}
	input {
		position: absolute;
		opacity: 0;
		width: 18px;
		height: 18px;
		margin: 0;
	}
	.box {
		flex: none;
		width: 18px;
		height: 18px;
		margin-top: 3px;
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		position: relative;
	}
	input:checked + .box::after {
		content: '';
		position: absolute;
		left: 5px;
		top: 1px;
		width: 5px;
		height: 10px;
		border: solid var(--blood-bright);
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}
	input:focus-visible + .box {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: 2px;
	}
	.hint {
		display: block;
		color: var(--bone-faint);
		font-size: var(--size-label);
	}
</style>

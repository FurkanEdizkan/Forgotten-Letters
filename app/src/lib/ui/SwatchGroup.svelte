<!--
  A radio group of colour swatches: a dot and a name per option (the name is the signal, the colour is the extra).
  Keyboard as a native radio group: Tab enters at the picked swatch, arrow keys move and pick, Home and End jump.
  A hidden input carries the value in a form.
-->
<script lang="ts">
	type Option = { value: string; label: string; colour: string };
	type Props = {
		label: string;
		name: string;
		options: Option[];
		value: string;
		disabled?: boolean;
		error?: string | null;
		onchange?: (value: string) => void;
	};
	let {
		label,
		name,
		options,
		value = $bindable(),
		disabled = false,
		error,
		onchange
	}: Props = $props();

	const uid = $props.id();
	let buttons: HTMLButtonElement[] = $state([]);

	function pick(i: number, focus = false) {
		const o = options[i];
		if (!o || disabled) return;
		value = o.value;
		onchange?.(o.value);
		if (focus) buttons[i]?.focus();
	}

	function onkeydown(e: KeyboardEvent, i: number) {
		const n = options.length;
		const to: Record<string, number> = {
			ArrowRight: (i + 1) % n,
			ArrowDown: (i + 1) % n,
			ArrowLeft: (i - 1 + n) % n,
			ArrowUp: (i - 1 + n) % n,
			Home: 0,
			End: n - 1
		};
		const target = to[e.key];
		if (target !== undefined) {
			e.preventDefault();
			pick(target, true);
		}
	}

	// Roving tab stop: the picked swatch, or the first when nothing matches.
	const tabStop = $derived(
		Math.max(
			0,
			options.findIndex((o) => o.value === value)
		)
	);
</script>

<div class="swatches" class:invalid={!!error}>
	<span class="lab" id="{name}-{uid}-label">{label}</span>
	<div
		class="grid"
		role="radiogroup"
		aria-labelledby="{name}-{uid}-label"
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? `${name}-${uid}-error` : undefined}
		aria-disabled={disabled ? 'true' : undefined}
	>
		{#each options as o, i (o.value)}
			<button
				bind:this={buttons[i]}
				type="button"
				role="radio"
				class="swb"
				class:on={o.value === value}
				aria-checked={o.value === value}
				tabindex={i === tabStop ? 0 : -1}
				{disabled}
				onclick={() => pick(i)}
				onkeydown={(e) => onkeydown(e, i)}
			>
				<i style:background={o.colour}></i>{o.label}
			</button>
		{/each}
	</div>
	<input type="hidden" {name} {value} />
	{#if error}<p class="error" id="{name}-{uid}-error">{error}</p>{/if}
</div>

<style>
	.swatches {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	.lab {
		font-size: var(--size-label);
		font-weight: 600;
		color: var(--bone);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7.2em, 1fr));
		gap: var(--space-2);
	}
	.swb {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 0.45em 0.7em;
		border-radius: 0.45em;
		border: var(--border-hairline) solid var(--rule-strong);
		background: var(--inset);
		color: var(--bone-dim);
		font-family: var(--font-body);
		font-size: var(--size-label);
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--duration-fast) var(--easing),
			color var(--duration-fast) var(--easing),
			box-shadow var(--duration-fast) var(--easing),
			background-color var(--duration-fast) var(--easing);
	}
	.swb i {
		width: 1em;
		height: 1em;
		flex: none;
		border-radius: var(--radius-disc);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.15);
	}
	.swb:hover {
		color: var(--bone);
		border-color: var(--bone-faint);
		background: var(--panel);
	}
	.swb:active {
		background: var(--panel-hover);
	}
	.swb.on {
		color: var(--bone);
		border-color: var(--blood-bright);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--blood-bright) 25%, transparent);
	}
	.swb:focus-visible {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: 2px;
	}
	.swb:disabled {
		cursor: not-allowed;
		color: var(--bone-faint);
		background: var(--panel-raised);
		border-color: var(--panel-raised);
	}
	.invalid .swb {
		border-color: var(--danger);
	}
	.error {
		color: var(--bone);
		font-size: var(--size-label);
	}
	.error::before {
		content: '! ';
		color: var(--danger);
		font-weight: 700;
	}
</style>

<!--
  A choice between a few options, each a square card with its name and what it means (Listed or Private, the
  campaign type). Real radio inputs in a fieldset, so keyboard and screen readers work as usual; the chosen card
  gets the 2 px selected ring.
-->
<script lang="ts">
	type Option = { value: string; label: string; help: string };
	type Props = {
		legend: string;
		name: string;
		options: Option[];
		value: string;
		disabled?: boolean;
	};
	let { legend, name, options, value = $bindable(), disabled = false }: Props = $props();
</script>

<fieldset {disabled}>
	<legend class="label">{legend}</legend>
	<div class="cards">
		{#each options as o (o.value)}
			<label class="card" class:on={value === o.value}>
				<input type="radio" {name} value={o.value} bind:group={value} />
				<span class="name">{o.label}</span>
				<span class="help">{o.help}</span>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	fieldset {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	legend {
		padding: 0 0 var(--space-1);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: var(--space-3);
	}
	.card {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-2);
		padding: var(--space-3);
		background: var(--inset);
		border: var(--border-hairline) solid var(--rule-strong);
		cursor: pointer;
		transition: border-color var(--duration-fast) var(--easing);
	}
	.card:hover {
		border-color: var(--bone-dim);
	}
	.card.on {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: -1px;
		border-color: var(--blood-bright);
	}
	input {
		margin: 0.3em 0 0;
		accent-color: var(--blood-bright);
	}
	input:focus-visible {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: 2px;
	}
	.name {
		font-weight: 600;
	}
	.help {
		grid-column: 2;
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	fieldset:disabled .card {
		cursor: not-allowed;
		opacity: 0.6;
	}
</style>

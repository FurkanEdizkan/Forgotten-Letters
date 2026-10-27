<!--
  The wizard's Server step body. How the copy runs is a fact, not a choice: run directly, the port is a field and
  the new address is shown; in Docker or in development (portLocked) the port is read-only with the .env lines that
  change it. Either way a `port` field goes with the form.
-->
<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import Lock from '@lucide/svelte/icons/lock';
	import ServerIcon from '@lucide/svelte/icons/server';
	import Container from '@lucide/svelte/icons/container';
	import { m } from '#lib/messages';
	import WizardField from '#lib/ui/WizardField.svelte';
	import Callout from '#lib/ui/Callout.svelte';

	type Props = {
		portLocked: boolean;
		/** The port in use, shown when it is locked. */
		lockedPort: number;
		port: string;
		address: string;
		error?: string | null;
	};
	let { portLocked, lockedPort, port = $bindable(), address, error }: Props = $props();
	const s = m.wizard.server;
</script>

<p class="mode">
	{#if portLocked}
		<Container size={16} strokeWidth={1.6} aria-hidden={true} />{s.docker}
	{:else}
		<ServerIcon size={16} strokeWidth={1.6} aria-hidden={true} />{s.direct}
	{/if}
</p>

{#if portLocked}
	<input type="hidden" name="port" value={lockedPort} />
	<WizardField label={s.port} value={String(lockedPort)} readonly mono>
		{#snippet suffix()}
			<span class="lock"><Lock size={13} strokeWidth={1.6} aria-hidden={true} />{s.lockedTag}</span>
		{/snippet}
	</WizardField>
	<div class="howto">
		<p class="lab">{s.lockedHow}</p>
		<pre class="codeb">APP_PORT={lockedPort}
docker compose up -d</pre>
	</div>
	<Callout>{s.lockedNote}</Callout>
{:else}
	<div class="row2">
		<WizardField
			label={s.port}
			name="port"
			inputmode="numeric"
			mono
			required
			hint={s.portHint}
			bind:value={port}
			{error}
		/>
		<WizardField label={s.address} value={address} readonly mono hint={s.addressHint}>
			{#snippet suffix()}
				<button
					type="button"
					class="copy"
					aria-label={m.common.copy}
					title={m.common.copy}
					onclick={() => navigator.clipboard?.writeText(address)}
				>
					<Copy size={15} strokeWidth={1.6} aria-hidden={true} />
				</button>
			{/snippet}
		</WizardField>
	</div>
	<Callout>{s.moveNote}</Callout>
{/if}

<style>
	.mode {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		justify-self: start;
		padding: 0.3em 0.8em;
		border-radius: 0.55em;
		border: var(--border-hairline) solid var(--rule);
		background: var(--inset);
		color: var(--bone);
		font-size: var(--size-label);
	}
	.mode :global(svg) {
		color: var(--blood-bright);
	}
	.row2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
		align-items: start;
	}
	.lock {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.1em 0.6em;
		border: var(--border-hairline) solid var(--rule-strong);
		border-radius: 1em;
	}
	.copy {
		display: grid;
		place-items: center;
		width: 1.8em;
		height: 1.8em;
		border: 0;
		border-radius: 0.35em;
		background: transparent;
		color: var(--bone-dim);
		cursor: pointer;
		transition:
			color var(--duration-fast) var(--easing),
			background-color var(--duration-fast) var(--easing);
	}
	.copy:hover {
		color: var(--bone);
		background: var(--panel-raised);
	}
	.copy:active {
		background: var(--panel-hover);
	}
	.copy:focus-visible {
		outline: var(--border-focus) solid var(--blood-bright);
	}
	.howto {
		display: grid;
		gap: var(--space-2);
	}
	.howto .lab {
		text-transform: none;
		letter-spacing: 0;
		color: var(--bone);
	}
	.codeb {
		margin: 0;
		padding: var(--space-3) var(--space-4);
		border-radius: 0.45em;
		border: var(--border-hairline) solid var(--rule);
		background: var(--inset);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--bone);
	}
</style>

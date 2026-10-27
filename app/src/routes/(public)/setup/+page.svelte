<!--
  /setup: the first-run wizard, Owner → Look → Server → Done, in one form. Each step checks its fields in the browser
  with the shared zod rules before moving on (wizard.ts); Finish posts every field to ?/finish, which checks them
  again. A server error on a field sends the wizard back to that field's step. The steps need scripts; without them a
  note says so.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { m } from '#lib/messages';
	import { ACCENTS, TEXT_SCALE } from '#lib/schemas/settings';
	import type { Accent } from '#lib/schemas/settings';
	import { ACCENT_COLOURS, accentVars } from '#lib/ui/accents';
	import { entrance, stepIn } from '#lib/ui/motion';
	import SplitStage, { SPLIT } from '#lib/ui/SplitStage.svelte';
	import Stepper from '#lib/ui/Stepper.svelte';
	import WizardField from '#lib/ui/WizardField.svelte';
	import Slider from '#lib/ui/Slider.svelte';
	import SwatchGroup from '#lib/ui/SwatchGroup.svelte';
	import TextPreview from '#lib/ui/TextPreview.svelte';
	import Callout from '#lib/ui/Callout.svelte';
	import GlassButton from '#lib/ui/GlassButton.svelte';
	import ServerStep from './ServerStep.svelte';
	import {
		addressWithPort,
		checkStep,
		firstBadStep,
		stepForFields,
		type FieldErrors
	} from './wizard';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const w = m.wizard;
	const LAST = w.steps.length - 1;

	// The wizard starts from the stored settings (defaults on a fresh install) and keeps what was typed after a
	// failed Finish; the server never sends passwords back.
	const start = () => ({
		username: String(form?.values?.username ?? ''),
		displayName: String(form?.values?.displayName ?? ''),
		textScale: data.textScale,
		accent: data.accent as Accent,
		port: String(data.port)
	});
	const initial = start();
	let username = $state(initial.username);
	let displayName = $state(initial.displayName);
	let password = $state('');
	let repeat = $state('');
	let textScale = $state(initial.textScale);
	let accent = $state<Accent>(initial.accent);
	let port = $state(initial.port);

	let step = $state(0);
	let busy = $state(false);
	let errors: FieldErrors = $state({});
	let message: string | null = $state(null);
	let col: HTMLElement | null = $state(null);
	let sections: HTMLElement[] = $state([]);
	let titles: HTMLElement[] = $state([]);

	const accentOptions = ACCENTS.map((a) => ({
		value: a,
		label: m.accents[a],
		colour: ACCENT_COLOURS[a].base
	}));
	const ticks = [90, 100, 110, 120, 130];

	const values = () => ({ username, displayName, password, repeat, textScale, accent, port });
	const address = $derived(addressWithPort(data.address, port, data.portLocked));

	const focusFirstError = (i: number) =>
		sections[i]?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();

	/** Show a step: cross-fade it in from the side it comes from, then focus its title (or its first error). */
	async function go(to: number, focus: 'title' | 'error' = 'title') {
		const dir = to >= step ? 1 : -1;
		step = to;
		await tick();
		stepIn(sections[to] ?? null, dir);
		if (focus === 'error') focusFirstError(to);
		else titles[to]?.focus();
	}

	/** Next: stay and point at the first error, or move on. */
	async function next() {
		errors = checkStep(step, values(), data.portLocked);
		if (Object.keys(errors).length) {
			await tick();
			focusFirstError(step);
			return;
		}
		message = null;
		go(Math.min(step + 1, LAST));
	}

	const submit: SubmitFunction = ({ cancel }) => {
		// Enter in a field submits the form: on the first steps that means Next.
		if (step < LAST) {
			cancel();
			next();
			return;
		}
		// Re-check every step; a problem sends the wizard back to it.
		const bad = firstBadStep(values(), data.portLocked, LAST);
		if (bad) {
			cancel();
			errors = bad.errors;
			go(bad.step, 'error');
			return;
		}
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			// A port move answers with the new address: another origin, so the browser goes there itself.
			if (result.type === 'redirect') {
				const to = new URL(result.location, location.href);
				if (to.origin !== location.origin) {
					location.assign(to.href);
					return;
				}
			}
			if (result.type === 'failure') {
				const fields = (result.data?.fields ?? {}) as FieldErrors;
				errors = fields;
				message = typeof result.data?.message === 'string' ? result.data.message : null;
				await update({ reset: false });
				const back = stepForFields(fields);
				if (back !== null) go(back, 'error');
				return;
			}
			await update({ reset: false });
		};
	};

	onMount(() => {
		if (col) entrance(Array.from(col.children), { gap: 50 });
	});
</script>

<svelte:head><title>{w.title} · {m.app.name}</title></svelte:head>

<SplitStage split={SPLIT.setup} emblemSize="min(82%, 64vh)" accentStyle={accentVars(accent)}>
	<main class="field">
		<form
			method="POST"
			action="?/finish"
			novalidate
			use:enhance={submit}
			class="wcol"
			class:wide={step === 1}
			bind:this={col}
		>
			<Stepper steps={w.steps} current={step} label={w.progress} doneLabel={w.stepDone} />

			<!-- 1 · Owner -->
			<section hidden={step !== 0} bind:this={sections[0]} aria-labelledby="t0">
				<header>
					<h1 class="wtitle" id="t0" tabindex="-1" bind:this={titles[0]}>{w.owner.title}</h1>
					<p class="wdesc">{w.owner.description}</p>
				</header>
				<div class="row2">
					<WizardField
						label={w.owner.username}
						name="username"
						autocomplete="username"
						autocapitalize="none"
						spellcheck={false}
						required
						hint={w.owner.usernameHint}
						bind:value={username}
						error={errors.username}
					/>
					<WizardField
						label={w.owner.displayName}
						name="displayName"
						autocomplete="nickname"
						required
						hint={w.owner.displayNameHint}
						bind:value={displayName}
						error={errors.displayName}
					/>
				</div>
				<WizardField
					label={w.owner.password}
					name="password"
					type="password"
					autocomplete="new-password"
					required
					maxlength={128}
					hint={w.owner.passwordHint}
					bind:value={password}
					error={errors.password}
				/>
				<WizardField
					label={w.owner.repeat}
					type="password"
					autocomplete="new-password"
					placeholder={w.owner.repeatPlaceholder}
					bind:value={repeat}
					error={errors.repeat}
				/>
				<Callout>{w.owner.note}</Callout>
			</section>

			<!-- 2 · Look: the accent recolours the whole stage live (accentStyle above). -->
			<section hidden={step !== 1} bind:this={sections[1]} aria-labelledby="t1">
				<header>
					<h1 class="wtitle" id="t1" tabindex="-1" bind:this={titles[1]}>{w.look.title}</h1>
					<p class="wdesc">{w.look.description}</p>
				</header>
				<div class="look">
					<div class="look-ctl">
						<Slider
							label={w.look.textSize}
							name="textScale"
							min={TEXT_SCALE.min}
							max={TEXT_SCALE.max}
							step={TEXT_SCALE.step}
							{ticks}
							format={(v) => `${v} %`}
							bind:value={textScale}
							error={errors.textScale}
						/>
						<SwatchGroup
							label={w.look.accent}
							name="accent"
							options={accentOptions}
							bind:value={() => accent, (v) => (accent = v as Accent)}
							error={errors.accent}
						/>
					</div>
					<TextPreview
						scale={textScale}
						label={w.look.preview}
						title={w.look.sampleTitle}
						meta={w.look.sampleMeta}
						body={w.look.sampleBody}
						chip={w.look.sampleChip}
						button={w.look.sampleButton}
					/>
				</div>
			</section>

			<!-- 3 · Server -->
			<section hidden={step !== 2} bind:this={sections[2]} aria-labelledby="t2">
				<header>
					<h1 class="wtitle" id="t2" tabindex="-1" bind:this={titles[2]}>{w.server.title}</h1>
					<p class="wdesc">{w.server.description}</p>
				</header>
				<ServerStep
					portLocked={data.portLocked}
					lockedPort={data.port}
					bind:port
					{address}
					error={errors.port}
				/>
			</section>

			<!-- 4 · Done -->
			<section hidden={step !== 3} bind:this={sections[3]} aria-labelledby="t3">
				<header>
					<h1 class="wtitle" id="t3" tabindex="-1" bind:this={titles[3]}>{w.done.title}</h1>
					<p class="wdesc">{w.done.description}</p>
				</header>
				<dl class="summary">
					<dt>{w.done.account}</dt>
					<dd>{displayName || '—'} <span class="dim mono">{username}</span></dd>
					<dt>{w.done.look}</dt>
					<dd>
						<i class="dot" style:background={ACCENT_COLOURS[accent].base}></i>{m.accents[accent]} ·
						{w.done.textSize(textScale)}
					</dd>
					<dt>{w.done.address}</dt>
					<dd class="mono">{address}</dd>
				</dl>
				{#if message}<Callout kind="danger">{message}</Callout>{/if}
			</section>

			<div class="wnav">
				<!-- Back from the first step returns to the welcome page. -->
				{#if step === 0}
					<GlassButton variant="ghost" href="/welcome">{w.back}</GlassButton>
				{:else}
					<GlassButton variant="ghost" disabled={busy} onclick={() => go(step - 1)}>
						{w.back}
					</GlassButton>
				{/if}
				{#if step < LAST}
					<!-- A submit button, so Enter in a field moves on too; submit() turns it into Next. -->
					<GlassButton variant="primary" type="submit">{w.next}</GlassButton>
				{:else}
					<GlassButton variant="primary" type="submit" disabled={busy}>
						{busy ? w.finishing : w.finish}
					</GlassButton>
				{/if}
			</div>
			<noscript><Callout kind="warn">{w.needsScript}</Callout></noscript>
		</form>
	</main>
</SplitStage>

<style>
	.field {
		display: grid;
		align-items: center;
		min-height: 100vh;
		min-height: 100dvh;
		padding: var(--space-6) 8%;
	}
	.wcol {
		display: grid;
		gap: var(--space-5);
		width: 100%;
		max-width: 40rem;
	}
	.wcol.wide {
		max-width: 52rem;
	}
	section {
		display: grid;
		gap: var(--space-4);
	}
	section[hidden] {
		display: none;
	}
	.wtitle {
		font-family: var(--font-heading);
		font-size: 2.1rem;
		letter-spacing: 0;
		text-transform: none;
		color: var(--blood-bright);
		transition: color var(--duration) var(--easing);
	}
	/* Focus moves to the title on each step for screen readers; it is not a control, so no ring. */
	.wtitle:focus {
		outline: none;
	}
	.wdesc {
		margin-top: var(--space-1);
		color: var(--bone-dim);
	}
	.row2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4);
		align-items: start;
	}
	.look {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
		gap: var(--space-5);
		align-items: start;
	}
	.look-ctl {
		display: grid;
		gap: var(--space-5);
	}
	.summary {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-5);
		margin: 0;
		padding: var(--space-4);
		border-radius: 0.6em;
		border: var(--border-hairline) solid var(--rule);
		background: var(--panel);
	}
	.summary dt {
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		color: var(--bone-dim);
	}
	.summary dd {
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.dot {
		width: 0.9em;
		height: 0.9em;
		border-radius: var(--radius-disc);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.15);
	}
	.wnav {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}
</style>

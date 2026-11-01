<!--
  /campaigns/new: the creation wizard, Basics → Schedule → Seats → House rules → Map → Review, in one form inside
  the shell. Flat, square controls (decision 48); only the Stepper is shared with setup. Each step checks its
  fields in the browser with the shared schema before moving on (wizard.ts); Create posts everything to ?/create,
  which checks again. A server error on a field (a taken name) sends the wizard back to that step. The card preview
  follows what is typed. The Map step is a placeholder until step 2.5.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '#lib/ui/enhance';
	import Info from '@lucide/svelte/icons/info';
	import { m } from '#lib/messages';
	import { KINDS, SEATS_MAX, SEATS_MIN, VISIBILITIES } from '#lib/schemas/campaigns';
	import { stepIn } from '#lib/ui/motion';
	import Stepper from '#lib/ui/Stepper.svelte';
	import Field from '#lib/ui/Field.svelte';
	import TextArea from '#lib/ui/TextArea.svelte';
	import RadioCards from '#lib/ui/RadioCards.svelte';
	import Slider from '#lib/ui/Slider.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Message from '#lib/ui/Message.svelte';
	import CampaignCard from '#lib/ui/CampaignCard.svelte';
	import HouseRulesEditor from '#lib/ui/HouseRulesEditor.svelte';
	import ReviewStep from './ReviewStep.svelte';
	import {
		blankValues,
		checkStep,
		firstBadStep,
		REVIEW,
		seatNames,
		stepForFields,
		type FieldErrors,
		type WizardValues
	} from './wizard';

	const w = m.campaigns.wizard;
	const MAP = 4;

	let v: WizardValues = $state(blankValues());
	let step = $state(0);
	let busy = $state(false);
	let errors: FieldErrors = $state({});
	let message: string | null = $state(null);
	let sections: HTMLElement[] = $state([]);
	let titles: HTMLElement[] = $state([]);

	const kindOptions = KINDS.map((k) => ({
		value: k,
		label: m.campaigns.kinds[k],
		help: k === 'carcass_front' ? w.basics.kindHint : w.basics.genericHint
	}));
	const visibilityOptions = VISIBILITIES.map((x) => ({
		value: x,
		label: m.campaigns.visibility[x],
		help: x === 'listed' ? w.schedule.listedHelp : w.schedule.privateHelp
	}));
	const seatTicks = [2, 9, 16, 23, 30];

	// The card as players will see it, from what is typed so far.
	const preview = $derived({
		name: v.name.trim() || w.previewName,
		kind: v.kind,
		stage: 'mustering' as const,
		seatsTaken: 0,
		seatsTotal: v.seats,
		startsOn: v.startsOn || null,
		endsOn: v.endsOn || null,
		gamesPerPlayer: Number(v.gamesPerPlayer) || null,
		cmName: '',
		myRole: 'cm' as const,
		mySeat: false
	});

	const focusFirstError = (i: number) =>
		sections[i]?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();

	/** Show a step: slide it in from the side it comes from, then focus its title (or its first error). */
	async function go(to: number, focus: 'title' | 'error' = 'title') {
		const dir = to >= step ? 1 : -1;
		step = to;
		await tick();
		stepIn(sections[to] ?? null, dir);
		if (focus === 'error') focusFirstError(to);
		else titles[to]?.focus();
	}

	async function next() {
		errors = checkStep(step, v);
		if (Object.keys(errors).length) {
			await tick();
			focusFirstError(step);
			return;
		}
		message = null;
		go(Math.min(step + 1, REVIEW));
	}

	const submit: SubmitFunction = ({ cancel }) => {
		// Enter in a field submits the form: before Review that means Next.
		if (step < REVIEW) {
			cancel();
			next();
			return;
		}
		const bad = firstBadStep(v);
		if (bad) {
			cancel();
			errors = bad.errors;
			go(bad.step, 'error');
			return;
		}
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'failure') {
				const fields = (result.data?.fields ?? {}) as FieldErrors;
				errors = fields;
				message = typeof result.data?.message === 'string' ? result.data.message : null;
				const back = stepForFields(fields);
				if (back !== null) go(back, 'error');
				return;
			}
			await update({ reset: false });
		};
	};
</script>

<svelte:head><title>{w.title} · {m.app.name}</title></svelte:head>

<h1>{w.title}</h1>
<div class="wz" class:wide={step === 3}>
	<form method="POST" action="?/create" novalidate use:enhance={submit} class="wcol">
		<Stepper steps={w.steps} current={step} label={w.progress} doneLabel={w.stepDone} />

		<!-- 1 · Basics -->
		<section hidden={step !== 0} bind:this={sections[0]} aria-labelledby="t0">
			<header>
				<h2 id="t0" tabindex="-1" bind:this={titles[0]}>{w.basics.title}</h2>
				<p class="dim">{w.basics.description}</p>
			</header>
			<Field
				label={w.basics.name}
				name="name"
				maxlength={80}
				required
				hint={w.basics.nameHint}
				bind:value={v.name}
				error={errors.name}
			/>
			<RadioCards legend={w.basics.kind} name="kind" options={kindOptions} bind:value={v.kind} />
			<TextArea
				label={w.basics.description_}
				name="description"
				maxlength={500}
				bind:value={v.description}
				error={errors.description}
			/>
		</section>

		<!-- 2 · Schedule and visibility -->
		<section hidden={step !== 1} bind:this={sections[1]} aria-labelledby="t1">
			<header>
				<h2 id="t1" tabindex="-1" bind:this={titles[1]}>{w.schedule.title}</h2>
				<p class="dim">{w.schedule.description}</p>
			</header>
			<div class="row3">
				<Field
					label={w.schedule.games}
					name="gamesPerPlayer"
					type="number"
					inputmode="numeric"
					min={1}
					max={50}
					bind:value={v.gamesPerPlayer}
					error={errors.gamesPerPlayer}
				/>
				<Field
					label={w.schedule.start}
					name="startsOn"
					type="date"
					bind:value={v.startsOn}
					error={errors.startsOn}
				/>
				<Field
					label={w.schedule.end}
					name="endsOn"
					type="date"
					bind:value={v.endsOn}
					error={errors.endsOn}
				/>
			</div>
			<RadioCards
				legend={w.schedule.who}
				name="visibility"
				options={visibilityOptions}
				bind:value={v.visibility}
			/>
		</section>

		<!-- 3 · Seats -->
		<section hidden={step !== 2} bind:this={sections[2]} aria-labelledby="t2">
			<header>
				<h2 id="t2" tabindex="-1" bind:this={titles[2]}>{w.seats.title}</h2>
				<p class="dim">{w.seats.description}</p>
			</header>
			<Slider
				label={w.seats.count}
				name="seats"
				min={SEATS_MIN}
				max={SEATS_MAX}
				ticks={seatTicks}
				bind:value={v.seats}
				error={errors.seats}
			/>
			<div class="made">
				<span class="label">{w.seats.made}</span>
				<ul class="seatpv">
					{#each seatNames(v.seats) as s (s)}<li>{s}</li>{/each}
				</ul>
			</div>
			<p class="note"><Info size={18} strokeWidth={1.5} aria-hidden={true} />{w.seats.note}</p>
		</section>

		<!-- 4 · House rules -->
		<section hidden={step !== 3} bind:this={sections[3]} aria-labelledby="t3">
			<header>
				<h2 id="t3" tabindex="-1" bind:this={titles[3]}>{w.rules.title}</h2>
				<p class="dim">{w.rules.description}</p>
			</header>
			<HouseRulesEditor bind:rules={v.houseRules} kind={v.kind} {errors} />
		</section>

		<!-- 5 · Map: reserved until step 2.5; nothing is saved for it. -->
		<section hidden={step !== MAP} bind:this={sections[MAP]} aria-labelledby="t4">
			<header>
				<h2 id="t4" tabindex="-1" bind:this={titles[MAP]}>{w.map.title}</h2>
				<p class="dim">{w.map.description}</p>
			</header>
			<p class="note"><Info size={18} strokeWidth={1.5} aria-hidden={true} />{w.map.note}</p>
		</section>

		<!-- 6 · Review -->
		<section hidden={step !== REVIEW} bind:this={sections[REVIEW]} aria-labelledby="t5">
			<header>
				<h2 id="t5" tabindex="-1" bind:this={titles[REVIEW]}>{w.review.title}</h2>
				<p class="dim">{w.review.description}</p>
			</header>
			<ReviewStep {v} edit={(s) => go(s)} />
			{#if message}<Message kind="danger">{message}</Message>{/if}
		</section>

		<div class="wnav">
			{#if step === 0}
				<Button href="/campaigns">{w.cancel}</Button>
			{:else}
				<Button disabled={busy} onclick={() => go(step - 1)}>{w.back}</Button>
			{/if}
			{#if step < REVIEW}
				<!-- A submit button, so Enter in a field moves on too; submit() turns it into Next. -->
				<Button kind="primary" type="submit">{step === MAP ? w.skip : w.next}</Button>
			{:else}
				<Button kind="primary" type="submit" disabled={busy}>{busy ? w.creating : w.create}</Button>
			{/if}
		</div>
		<noscript><Message kind="warn">{w.needsScript}</Message></noscript>
	</form>

	{#if step <= 2}
		<aside class="pv" aria-label={w.preview}>
			<span class="label">{w.preview}</span>
			<CampaignCard card={preview} />
		</aside>
	{/if}
</div>

<style>
	.wz {
		display: grid;
		grid-template-columns: minmax(0, 46rem) minmax(16rem, 20rem);
		gap: var(--space-7);
		align-items: start;
	}
	/* The House rules step has no preview beside it; its library and list take the whole width. */
	.wz.wide {
		grid-template-columns: minmax(0, 72rem);
	}
	.wcol {
		display: grid;
		gap: var(--space-5);
		min-width: 0;
	}
	section {
		display: grid;
		gap: var(--space-4);
	}
	section[hidden] {
		display: none;
	}
	header {
		display: grid;
		gap: var(--space-1);
	}
	/* Focus moves to the title on each step for screen readers; it is not a control, so no ring. */
	h2:focus {
		outline: none;
	}
	.row3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.made {
		display: grid;
		gap: var(--space-2);
	}
	.seatpv {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.seatpv li {
		padding: var(--space-1) var(--space-2);
		border: var(--border-hairline) dashed var(--rule-strong);
		background: var(--inset);
		color: var(--bone-dim);
		font-size: var(--size-label);
		font-variant-numeric: lining-nums;
		white-space: nowrap;
	}
	.note {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		padding: var(--space-3);
		border: var(--border-hairline) solid var(--rule);
		color: var(--bone-dim);
		font-size: var(--size-label);
	}
	.note :global(svg) {
		flex: none;
		color: var(--blood-pale);
	}
	.wnav {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.pv {
		position: sticky;
		top: calc(var(--bar-height, 56px) + var(--space-5));
		display: grid;
		gap: var(--space-2);
	}
	@media (max-width: 1100px) {
		.wz {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>

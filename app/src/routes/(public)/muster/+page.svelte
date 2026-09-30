<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const s = $derived(data.steps);
</script>

<svelte:head><title>Muster · {data.campaign}</title></svelte:head>

<main>
	<h1>Muster</h1>
	{#if !data.seat}
		<p class="lede">You don't have a seat in {data.campaign} yet. Ask the Campaign Master for an invite link, or for a seat for this account.</p>
	{:else}
		<p class="lede">
			{data.seat.name}{data.seat.number ? ` · seat ${data.seat.number}` : ''} in {data.campaign}.
			{#if data.stage === 'mustering'}Get your warband ready; the campaign starts when every seat is.{:else if data.stage === 'underway'}The campaign is under way.{/if}
		</p>

		<ol class="steps">
			<li class:done={s?.account}>
				<span class="mark" aria-hidden="true">{s?.account ? '✓' : '1'}</span>
				<div><strong>Your account</strong><small>Signed in.</small></div>
			</li>
			<li class:done={s?.warband} class:current={s?.next === 'warband'}>
				<span class="mark" aria-hidden="true">{s?.warband ? '✓' : '2'}</span>
				<div>
					<strong>Your warband</strong>
					{#if data.warband}
						<small><a href="/warbands/{data.warband.id}">{data.warband.name}</a> · comes ashore at Entry Zone {data.warband.entryZone}</small>
					{:else}
						<small>Choose a faction and name your warband. Your seat lands at Entry Zone {data.seat.suggestedEntry}.</small>
						<a class="go" href="/warbands/new">Build your warband →</a>
					{/if}
				</div>
			</li>
			<li class:done={s?.vision} class:current={s?.next === 'vision'}>
				<span class="mark" aria-hidden="true">{s?.vision ? '✓' : '3'}</span>
				<div>
					<strong>Your Vision</strong>
					{#if data.vision}
						<small>You keep <em>{data.vision.name}</em>. It stays secret until the reveal.</small>
					{:else if data.offer.length}
						<small>Keep one of these two; it stays secret from the others until the reveal.</small>
						<div class="offer">
							{#each data.offer as v (v.id)}
								<form method="POST" action="?/vision" class="card" use:enhance>
									<input type="hidden" name="card" value={v.id} />
									<h3>{v.name}</h3>
									<ol class="levels">
										{#each v.levels as l, i (i)}<li>{l}</li>{/each}
									</ol>
									<button>Keep {v.name}</button>
								</form>
							{/each}
						</div>
						{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
					{:else}
						<small>{data.warband ? 'The Campaign Master deals the cards soon.' : 'Cards are dealt once your warband is built.'}</small>
					{/if}
				</div>
			</li>
		</ol>

		{#if s?.ready}<p class="ready">Ready. {data.stage === 'mustering' ? 'Waiting for the others.' : ''}</p>{/if}
	{/if}

	{#if data.roll.length}
		<h2>The muster roll</h2>
		<ul class="roll">
			{#each data.roll as r, i (i)}
				<li class:ready={r.ready} class:me={r.me}>{r.name}<span>{r.ready ? 'Ready' : 'Mustering'}</span></li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	main {
		max-width: 52rem;
		margin: 0 auto;
		padding: 28px clamp(16px, 4vw, 40px) 0;
	}
	.lede {
		color: var(--ink-soft);
	}
	.steps {
		list-style: none;
		margin: 18px 0;
		padding: 0;
		border-top: 2px solid var(--ink);
	}
	.steps > li {
		display: grid;
		grid-template-columns: 2.2rem 1fr;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 1px solid var(--rule);
	}
	.steps > li > div {
		display: grid;
		gap: 4px;
	}
	.steps small {
		color: var(--ink-soft);
		font-size: 0.95rem;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--rule);
		border-radius: 50%;
		font-family: var(--font-display);
		color: var(--muted);
	}
	li.done .mark {
		background: var(--ink);
		color: var(--parchment);
		border-color: var(--ink);
	}
	li.current .mark {
		border: 2px solid var(--blood);
		color: var(--blood);
	}
	.go {
		justify-self: start;
		font-weight: 700;
	}
	.offer {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 12px;
		margin-top: 6px;
	}
	.card {
		display: grid;
		gap: 6px;
		padding: 12px 14px;
		background: var(--parchment);
		border: 1px solid var(--rule);
		border-top: 2px solid var(--blood);
	}
	.card h3 {
		margin: 0;
	}
	.levels {
		margin: 0;
		padding-left: 1.2rem;
		font-size: 0.92rem;
	}
	.card button {
		justify-self: start;
	}
	.ready {
		font-weight: 700;
		color: var(--supplies);
	}
	.error {
		color: var(--blood);
	}
	.roll {
		list-style: none;
		padding: 0;
		margin: 0 0 24px;
		border-top: 2px solid var(--ink);
	}
	.roll li {
		display: flex;
		justify-content: space-between;
		padding: 6px 0;
		border-bottom: 1px solid var(--rule);
	}
	.roll li span {
		color: var(--muted);
	}
	.roll li.ready span {
		color: var(--supplies);
		font-weight: 700;
	}
	.roll li.me {
		font-weight: 700;
	}
</style>

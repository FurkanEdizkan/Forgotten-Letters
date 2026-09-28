<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<h1>Backup</h1>

<section>
	<h2>Export</h2>
	<p>
		One JSON file with the whole campaign: players, warbands, every game and adjustment, weather, Visions, and the
		uploaded portraits and faction symbols. Keep one after every game night.
	</p>
	<a class="button" href="/admin/backup/export" download>Download backup</a>
	<p class="muted">It contains the secret Vision cards — don't share it with players.</p>
</section>

<section>
	<h2>Starter pack</h2>
	<p>
		What a fresh install starts from: the zone layout, weather presets, regional weather set-ups and your Faction Studio factions. It
		never holds the book's map, rules or lore, accounts, players or uploads, so it is safe to share. Save it as
		<code>app/seed/starter.json</code> and commit it to give new clones the same start.
	</p>
	<a class="button ghost" href="/admin/backup/starter" download>Download starter pack</a>
</section>

<section class="danger">
	<h2>Restore</h2>
	<p>Replaces the current campaign with the backup. Anything not in the file is lost.</p>
	<form method="POST" action="?/restore" enctype="multipart/form-data" use:enhance>
		<input type="file" name="backup" accept="application/json,.json" required />
		<label class="check"><input type="checkbox" name="confirm" /> Replace the current campaign</label>
		<button>Restore</button>
		{#if form?.restored}<span class="ok">Restored.</span>{/if}
		{#if form?.message}<span class="error">{form.message}</span>{/if}
	</form>
</section>

<style>
	section {
		margin: 16px 0;
		padding: 14px 18px;
		border: 1px solid var(--rule);
		background: var(--parchment);
	}
	section.danger {
		border-color: var(--blood);
	}
	h2 {
		margin: 0 0 8px;
		font-size: 1.6rem;
	}
	form {
		display: grid;
		gap: 10px;
		justify-items: start;
	}
	.check {
		display: flex;
		gap: 6px;
	}
	.button {
		display: inline-block;
		padding: 8px 14px;
		background: var(--ink);
		color: var(--parchment);
		text-decoration: none;
		font-variant-caps: small-caps;
		letter-spacing: 0.06em;
	}
	.muted {
		color: var(--muted);
	}
	.ok {
		color: var(--supplies);
	}
	.error {
		color: var(--blood);
	}
</style>

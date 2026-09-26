<script lang="ts">
	let { form } = $props();
</script>

<main>
	<h1>Campaign Master</h1>
	<form method="POST">
		<label>
			Password
			<input type="password" name="password" autocomplete="current-password" required />
		</label>
		{#if form?.wrong}<p class="error">The seal does not yield.</p>{/if}
		<button>Enter</button>
	</form>
</main>

<style>
	main {
		max-width: 22rem;
		margin: 15vh auto;
		padding: 0 16px;
	}
	form {
		display: grid;
		gap: 12px;
	}
	label {
		display: grid;
		gap: 4px;
	}
	.error {
		color: var(--blood);
		margin: 0;
	}
</style>

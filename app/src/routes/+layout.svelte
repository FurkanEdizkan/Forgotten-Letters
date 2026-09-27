<script lang="ts">
	// Fonts are bundled so the app works at a venue without internet.
	import '@fontsource/eb-garamond/400.css';
	import '@fontsource/eb-garamond/400-italic.css';
	import '@fontsource/eb-garamond/600.css';
	import '@fontsource/eb-garamond/700.css';
	import '@fontsource/unifrakturmaguntia/400.css';
	import '@fontsource/pirata-one/400.css';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Carcass Front</title>
</svelte:head>

{@render children()}

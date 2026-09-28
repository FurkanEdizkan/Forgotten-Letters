<script lang="ts">
	// Fonts are bundled so the app works at a venue without internet.
	import '@fontsource/eb-garamond/400.css';
	import '@fontsource/eb-garamond/400-italic.css';
	import '@fontsource/eb-garamond/600.css';
	import '@fontsource/eb-garamond/700.css';
	import '@fontsource/unifrakturmaguntia/400.css';
	import '@fontsource/pirata-one/400.css';
	import '../app.css';
	import { registerFactions } from '$lib/custom-factions';
	import { setZones } from '$lib/rules/zones';

	let { children, data } = $props();
	// Before any page renders: the Faction Studio's factions join the books' list.
	// The same for the Map Studio's zones.
	$effect.pre(() => {
		registerFactions(data.customFactions);
		setZones(data.zones);
	});
	// svelte-ignore state_referenced_locally
	registerFactions(data.customFactions);
	// svelte-ignore state_referenced_locally
	setZones(data.zones);
</script>

<svelte:head>
	<title>Carcass Front</title>
</svelte:head>

{@render children()}

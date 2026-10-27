<!-- Every signed-in page sits in the app shell: top bar, left panel, the page. -->
<script lang="ts">
	import Shell from '#lib/ui/shell/Shell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<Shell me={data.me} areas={data.areas}>
	{@render children()}
</Shell>

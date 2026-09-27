<script lang="ts" module>
	export type MarkName =
		| 'cross'
		| 'close'
		| 'swords'
		| 'pennant'
		| 'chevron'
		| 'strike'
		| 'ranged'
		| 'melee'
		| 'armour'
		| 'equipment'
		| 'external';
</script>

<script lang="ts">
	/** The app's small drawn marks, in one ink stroke (the cross is solid, as printed). */
	let { name, size = '1em', label }: { name: MarkName; size?: string; label?: string } = $props();
</script>

<svg
	class="mark"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="square"
	stroke-linejoin="miter"
>
	{#if name === 'cross'}
		<!-- Cross pattée, the Trench Crusade device -->
		<path
			fill="currentColor"
			stroke="none"
			d="M8.6 1.5h6.8l-2 8.9 8.9-2v6.8l-8.9-2 2 8.9H8.6l2-8.9-8.9 2V8.4l8.9 2z"
		/>
	{:else if name === 'close'}
		<path d="M5 5l14 14M19 5L5 19" />
	{:else if name === 'swords'}
		<path d="M4 3l12.5 12.5M20 3L7.5 15.5" />
		<path d="M13.5 17.5l4-4M6.5 13.5l4 4" />
		<path d="M18 17l3 3M6 17l-3 3" />
	{:else if name === 'pennant'}
		<path d="M6 21V3" />
		<path fill="currentColor" stroke="none" d="M7 3.5l12 3.5-12 4z" />
	{:else if name === 'chevron'}
		<path d="M9 5l7 7-7 7" />
	{:else if name === 'strike'}
		<path stroke-width="2.6" d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
	{:else if name === 'ranged'}
		<!-- A round of ammunition -->
		<path d="M9 21V10c0-3 1.3-5.6 3-7 1.7 1.4 3 4 3 7v11z" />
		<path d="M9 16h6" />
	{:else if name === 'melee'}
		<path d="M12 2v15M8 17h8M12 17v5" />
		<path d="M10 4.5l2-2.5 2 2.5" />
	{:else if name === 'armour'}
		<path d="M12 2.5l8 3v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10v-6z" />
		<path d="M12 2.5v19" />
	{:else if name === 'equipment'}
		<!-- A satchel -->
		<path d="M4 9h16v11H4z" />
		<path d="M8.5 9V6.5a3.5 3.5 0 017 0V9M4 13h16" />
	{:else if name === 'external'}
		<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
	{/if}
</svg>

<style>
	.mark {
		display: inline-block;
		flex: none;
		vertical-align: -0.125em;
	}
</style>

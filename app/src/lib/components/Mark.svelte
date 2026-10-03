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
		| 'external'
		| 'die'
		| 'burst'
		| 'grip'
		| 'drop'
		| 'figure'
		| 'ground'
		| 'tag';
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
	{:else if name === 'die'}
		<!-- A die showing three -->
		<path d="M4 4h16v16H4z" />
		<path stroke-width="2.6" d="M8 8h.01M12 12h.01M16 16h.01" />
	{:else if name === 'burst'}
		<!-- A shot striking -->
		<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19" />
	{:else if name === 'grip'}
		<!-- A hand-grip with its strap -->
		<path d="M9 21V9h6v12M7 9h10M12 9V3M9 13h6M9 17h6" />
	{:else if name === 'drop'}
		<path d="M12 2.5c3.5 5 6 8.4 6 11.5a6 6 0 01-12 0c0-3.1 2.5-6.5 6-11.5z" />
	{:else if name === 'figure'}
		<path d="M12 3a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM7 21l2-8-3-2 6-2 6 2-3 2 2 8M10 13h4" />
	{:else if name === 'ground'}
		<!-- Broken ground and a wall of sandbags -->
		<path d="M2 20h20M4 20l4-6 3 3 4-7 5 10" />
	{:else if name === 'tag'}
		<path d="M12 4l7 8-7 8-7-8z" />
	{/if}
</svg>

<style>
	.mark {
		display: inline-block;
		flex: none;
		vertical-align: -0.125em;
	}
</style>

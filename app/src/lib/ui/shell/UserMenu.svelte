<!--
  The user button at the right of the top bar and its menu (Bits UI DropdownMenu, so arrows, Home/End, Esc and focus
  return work as a menu should): who is signed in, User settings, Log out. Glass, as one of the first-run exceptions
  (DESIGN.md §6). The menu is portalled to <body>, out of this component's scoped styles, so its rules are global
  and prefixed `fl-umenu`.
-->
<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import LogOut from '@lucide/svelte/icons/log-out';
	import UserCog from '@lucide/svelte/icons/user-cog';
	import { m } from '#lib/messages';
	import type { Role } from '#lib/roles';
	import { initialOf } from './nav';
	import { glow } from './glow';

	type Props = {
		me: { username: string; displayName: string; role: Role; mustChangePassword: boolean };
		open?: boolean;
	};
	let { me, open = $bindable(false) }: Props = $props();
</script>

<!-- Log out is a POST (it changes state), sent by the menu item's submit button through `form`. -->
<form id="fl-logout" method="POST" action="/logout" hidden></form>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				class="user fl-glass"
				type="button"
				use:glow
				aria-label={m.shell.userMenu(me.displayName)}
			>
				<span class="initial" aria-hidden="true">{initialOf(me.displayName)}</span>
				<span class="name">{me.displayName}</span>
				<ChevronDown size={16} strokeWidth={1.5} aria-hidden={true} />
			</button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content class="fl-umenu" align="end" sideOffset={8}>
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading class="fl-umenu-head">
					{m.shell.signedInAs(me.username, m.roles[me.role])}
				</DropdownMenu.GroupHeading>
				{#if !me.mustChangePassword}
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a {...props} class="fl-umenu-item" href="/account">
								<UserCog size={16} strokeWidth={1.5} aria-hidden={true} />{m.shell.userSettings}
							</a>
						{/snippet}
					</DropdownMenu.Item>
				{/if}
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<button {...props} class="fl-umenu-item out" type="submit" form="fl-logout">
							<LogOut size={16} strokeWidth={1.5} aria-hidden={true} />{m.shell.logOut}
						</button>
					{/snippet}
				</DropdownMenu.Item>
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
	.initial {
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 0.4em;
		background: var(--blood);
		color: var(--bone);
		font-family: var(--font-body);
		font-weight: 700;
		letter-spacing: 0;
	}
	.name {
		max-width: 14rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-transform: none;
		letter-spacing: 0;
		font-size: var(--size-body);
		font-weight: 400;
	}
	.user {
		padding-left: var(--space-1);
	}

	:global(.fl-umenu) {
		z-index: 50;
		min-width: 15rem;
		display: grid;
		padding: var(--space-1);
		border-radius: 0.6em;
		/* Over inset, so the danger-coloured Log out stays readable (DESIGN.md §2, Status). */
		background: color-mix(in srgb, var(--inset) 82%, transparent);
		backdrop-filter: blur(14px) saturate(1.2);
		border: var(--border-hairline) solid color-mix(in srgb, var(--bone) 12%, transparent);
		border-top-color: color-mix(in srgb, var(--bone) 24%, transparent);
		border-bottom-color: color-mix(in srgb, var(--inset) 90%, transparent);
		box-shadow: var(--shadow-overlay);
		color: var(--bone);
		font-family: var(--font-body);
	}
	:global(.fl-umenu-head) {
		padding: var(--space-2) var(--space-3);
		color: var(--bone-dim);
		font-size: var(--size-label);
		border-bottom: var(--border-hairline) solid var(--rule);
		margin-bottom: var(--space-1);
	}
	:global(.fl-umenu-item) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--row-height);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: 0.45em;
		background: none;
		color: var(--bone);
		font: inherit;
		font-size: var(--size-body);
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		outline: none;
		transition: background-color var(--duration-fast) var(--easing);
	}
	/* Bits UI marks the item under the pointer or the arrow keys with data-highlighted. */
	:global(.fl-umenu-item[data-highlighted]) {
		background: color-mix(in srgb, var(--bone) 10%, transparent);
		color: var(--bone);
	}
	:global(.fl-umenu-item:focus-visible) {
		outline: var(--border-focus) solid var(--blood-bright);
		outline-offset: -2px;
	}
	:global(.fl-umenu-item.out) {
		color: var(--danger);
	}
	@supports not (backdrop-filter: blur(1px)) {
		:global(.fl-umenu) {
			background: var(--inset);
			border-color: var(--rule-strong);
		}
	}
	@media (prefers-reduced-transparency: reduce) {
		:global(.fl-umenu) {
			background: var(--inset);
			backdrop-filter: none;
			border-color: var(--rule-strong);
		}
	}
</style>

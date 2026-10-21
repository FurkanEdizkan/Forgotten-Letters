<!-- An outlined square badge in the role's colour; the word is always shown. -->
<script lang="ts">
	import { m } from '#lib/messages';
	import type { Role } from '#lib/roles';

	let { role }: { role: Role } = $props();
</script>

<span class="badge {role}">{m.roles[role]}</span>

<style>
	.badge {
		display: inline-block;
		padding: 0 var(--space-2);
		border: var(--border-hairline) solid currentColor;
		font-size: var(--size-label);
		font-weight: 600;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		line-height: 1.6;
		white-space: nowrap;
	}
	.owner {
		color: var(--role-owner);
	}
	.admin {
		color: var(--role-admin);
	}
	.user {
		color: var(--role-user);
	}
</style>

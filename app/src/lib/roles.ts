/**
 * Site roles, ranked owner > admin > user. One check, `can(user, role)`, guards routes, actions and the API.
 * Pure: used by pages, the API and services alike.
 */
export const ROLES = ['owner', 'admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { owner: 3, admin: 2, user: 1 };

/** Does this person have at least this role? */
export const can = (who: { role: Role } | null | undefined, role: Role) =>
	!!who && RANK[who.role] >= RANK[role];

/** Roles this role may invite: owners invite admins and users, admins invite users, users invite nobody. */
export const invitableBy = (role: Role): ('admin' | 'user')[] =>
	role === 'owner' ? ['admin', 'user'] : role === 'admin' ? ['user'] : [];

/** The areas this person can use, in header order; the first is where they land after sign-in. */
export function areasFor(role: Role): { path: string; label: string }[] {
	const owner = { path: '/owner', label: 'Owner' };
	const admin = { path: '/admin', label: 'Campaign Master' };
	const home = { path: '/home', label: 'Player' };
	return role === 'owner' ? [owner, admin, home] : role === 'admin' ? [admin, home] : [home];
}

export const homeFor = (role: Role) => areasFor(role)[0]!.path;

/** The admin account as found at start, with whether the .env password still matches its hash. */
export interface AdminRow {
	role: 'cm' | 'player';
	disabled: boolean;
	mustChangePassword: boolean;
	passwordMatches: boolean;
}

export type AdminSync =
	| { kind: 'create' }
	| { kind: 'none' }
	| { kind: 'update'; fields: Partial<Pick<AdminRow, 'role' | 'disabled' | 'mustChangePassword'>>; rehash: boolean };

/**
 * What start-up must do so the account named in .env is a working Campaign Master with the .env password.
 * The password is re-hashed only when it no longer matches, so a restart doesn't churn it (or sign anyone out).
 */
export function adminSyncPlan(existing: AdminRow | null): AdminSync {
	if (!existing) return { kind: 'create' };
	const fields: Extract<AdminSync, { kind: 'update' }>['fields'] = {};
	if (existing.role !== 'cm') fields.role = 'cm';
	if (existing.disabled) fields.disabled = false;
	if (existing.mustChangePassword) fields.mustChangePassword = false;
	const rehash = !existing.passwordMatches;
	return Object.keys(fields).length || rehash ? { kind: 'update', fields, rehash } : { kind: 'none' };
}

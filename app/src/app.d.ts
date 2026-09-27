// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionUser } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			/** The signed-in account, if any. */
			user: SessionUser | null;
			/** The signed-in account is the Campaign Master. */
			isAdmin: boolean;
		}
	}
}

export {};

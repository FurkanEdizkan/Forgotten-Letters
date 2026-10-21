// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionUser } from '#lib/server/services/audit';

declare global {
	namespace App {
		interface Error {
			message: string;
			requestId?: string;
		}
		interface Locals {
			requestId: string;
			user: SessionUser | null;
		}
	}
}

export {};

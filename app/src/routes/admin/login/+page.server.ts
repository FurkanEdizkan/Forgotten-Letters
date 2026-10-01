import { redirect } from '@sveltejs/kit';
import { signIn } from '$lib/server/signin';
import { safeNext } from '$lib/server/safe-next';
import { accessMode, landingFor } from '$lib/server/access';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

/** The Campaign Master's own door (players sign in at /login). It stands outside the admin layout (+page@.svelte). */
export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user?.role === 'cm') redirect(303, landingFor(accessMode(env.ACCESS), locals.user, safeNext(url.searchParams.get('next'), url.origin)));
	return { signedInAs: locals.user?.username ?? null };
};

export const actions: Actions = {
	default: (event) => signIn(event, 'cm')
};

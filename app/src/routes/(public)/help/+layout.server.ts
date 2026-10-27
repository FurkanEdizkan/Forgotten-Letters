/**
 * Help and legal pages are open to everyone. Signed in, they sit in the app shell like any other page, so the
 * layout passes the shell's data when there is a session and nothing otherwise.
 */
import { shellData } from '#lib/ui/shell/nav';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) =>
	locals.user ? shellData(locals.user) : { me: null, areas: [] };

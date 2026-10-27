import { shellData } from '#lib/ui/shell/nav';
import { requireSignedIn } from './guard';
import type { LayoutServerLoad } from './$types';

// Only what the shell needs (shellData picks the fields); never the session hash.
export const load: LayoutServerLoad = (event) => shellData(requireSignedIn(event));

import { isHttps } from '#lib/server/http';
import { requireRole } from '../guard';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = (event) => {
	requireRole(event, 'owner');
	return { plainHttp: !isHttps(event) };
};

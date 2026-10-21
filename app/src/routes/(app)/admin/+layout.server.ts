import { requireRole } from '../guard';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = (event) => {
	requireRole(event, 'admin');
};

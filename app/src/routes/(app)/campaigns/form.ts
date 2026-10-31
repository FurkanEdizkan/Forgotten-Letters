/**
 * Form transport for the campaign pages. A form flattens to strings, so the house rules (a list of objects) travel
 * as one JSON field; this turns it back before the shared schema parses it.
 */
import { z } from 'zod';

export const withJsonField = <S extends z.ZodType>(schema: S, key: string) =>
	z.preprocess((v) => {
		if (!v || typeof v !== 'object') return v;
		const raw = (v as Record<string, unknown>)[key];
		if (typeof raw !== 'string') return v;
		try {
			return { ...v, [key]: JSON.parse(raw) };
		} catch {
			return v; // left as text, so the schema reports the field
		}
	}, schema);

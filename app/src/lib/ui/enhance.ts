/**
 * Kit's `enhance`, but a save always updates the page in place. Kit 3 treats a post to `?/action` as a navigation
 * whenever the page's own query differs (`?tab=seats`, `?created=1`, `?view=deleted`), which scrolls to the top
 * and drops the query. Redirects still navigate. Use this instead of `$app/forms` everywhere.
 */
import { enhance as kitEnhance, type SubmitFunction } from '$app/forms';

export type { SubmitFunction };

type Opts = Parameters<
	NonNullable<Parameters<Exclude<Awaited<ReturnType<SubmitFunction>>, void>>[0]['update']>
>[0];

export function enhance(form: HTMLFormElement, submit?: SubmitFunction) {
	return kitEnhance(form, async (input) => {
		const after = await submit?.(input);
		return async (out) => {
			const update = (o?: Opts) => out.update({ navigate: false, ...o });
			if (typeof after === 'function') await after({ ...out, update });
			else await update();
		};
	});
}

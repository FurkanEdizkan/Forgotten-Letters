/**
 * Pages with many small forms share one `form` result. Each form sends a hidden `op` (and the id of its row);
 * successes return them too. `resultOf` picks the result that belongs to one form, so a message lands next to the
 * row it is about. Pure, so it is unit-tested.
 */
type Failure = {
	message: string;
	fields?: Record<string, string>;
	values?: Record<string, unknown>;
};
type Success = { op: string; id?: string } & Record<string, unknown>;

export type FormResult = Failure | Success | null | undefined;

const isFailure = (f: NonNullable<FormResult>): f is Failure => 'message' in f;

/** The result of the form with this op (and row id), as { error, fields, done }. */
export function resultOf(
	form: FormResult,
	op: string,
	id?: string
): { error: string | null; fields: Record<string, string>; done: Success | null } {
	const none = { error: null, fields: {}, done: null };
	if (!form) return none;
	const fop = isFailure(form) ? form.values?.op : form.op;
	const fid = isFailure(form) ? form.values?.id : form.id;
	if (fop !== op || (id !== undefined && fid !== id)) return none;
	return isFailure(form)
		? { error: form.message, fields: form.fields ?? {}, done: null }
		: { error: null, fields: {}, done: form };
}

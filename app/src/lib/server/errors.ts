/**
 * The app's one error type. Services throw it; the API wrapper and form helper turn it into the error shape
 * `{ error: { code, message, requestId, fields? } }` or a form failure. The codes are a fixed list.
 */
export const ERROR_STATUS = {
	invalid: 400,
	unauthenticated: 401,
	forbidden: 403,
	not_found: 404,
	conflict: 409,
	rate_limited: 429,
	internal: 500,
	unavailable: 503
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
	readonly status: number;
	constructor(
		readonly code: ErrorCode,
		message: string,
		/** Per-field messages for invalid input. */
		readonly fields?: Record<string, string>,
		/** Seconds before trying again (rate_limited, unavailable). */
		readonly retryAfter?: number
	) {
		super(message);
		this.status = ERROR_STATUS[code];
	}
}

export interface ErrorBody {
	error: { code: ErrorCode; message: string; requestId: string; fields?: Record<string, string> };
}

/** The error shape for any thrown value; unexpected errors become `internal` without details. */
export function errorBody(
	e: unknown,
	requestId: string
): { status: number; body: ErrorBody; retryAfter?: number } {
	if (e instanceof AppError)
		return {
			status: e.status,
			retryAfter: e.retryAfter,
			body: {
				error: {
					code: e.code,
					message: e.message,
					requestId,
					...(e.fields ? { fields: e.fields } : {})
				}
			}
		};
	return {
		status: 500,
		body: {
			error: {
				code: 'internal',
				message: 'Something went wrong. Quote the request id when asking for help.',
				requestId
			}
		}
	};
}

/** zod issues as field messages. */
export function fieldsOf(
	issues: { path: PropertyKey[]; message: string }[]
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const i of issues) {
		const k = i.path.map(String).join('.') || '_';
		out[k] ??= i.message;
	}
	return out;
}

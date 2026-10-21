import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, ERROR_STATUS, errorBody, fieldsOf } from './errors';

describe('AppError', () => {
	it('takes its status from the code', () => {
		expect(new AppError('invalid', 'x').status).toBe(400);
		expect(new AppError('unauthenticated', 'x').status).toBe(401);
		expect(new AppError('forbidden', 'x').status).toBe(403);
		expect(new AppError('not_found', 'x').status).toBe(404);
		expect(new AppError('conflict', 'x').status).toBe(409);
		expect(new AppError('rate_limited', 'x').status).toBe(429);
		expect(new AppError('internal', 'x').status).toBe(500);
		expect(new AppError('unavailable', 'x').status).toBe(503);
	});
	it('has exactly the documented codes', () => {
		expect(Object.keys(ERROR_STATUS).sort()).toEqual([
			'conflict',
			'forbidden',
			'internal',
			'invalid',
			'not_found',
			'rate_limited',
			'unauthenticated',
			'unavailable'
		]);
	});
});

describe('errorBody', () => {
	it('shapes an AppError with fields and the request id', () => {
		const r = errorBody(
			new AppError('invalid', 'Check the highlighted fields.', { username: 'Too short' }),
			'req-1'
		);
		expect(r).toEqual({
			status: 400,
			retryAfter: undefined,
			body: {
				error: {
					code: 'invalid',
					message: 'Check the highlighted fields.',
					requestId: 'req-1',
					fields: { username: 'Too short' }
				}
			}
		});
	});
	it('leaves fields out when there are none and passes retryAfter on', () => {
		const r = errorBody(new AppError('rate_limited', 'Wait.', undefined, 42), 'req-2');
		expect(r.status).toBe(429);
		expect(r.retryAfter).toBe(42);
		expect(r.body.error).not.toHaveProperty('fields');
	});
	it('says unavailable with 503', () => {
		expect(errorBody(new AppError('unavailable', 'Starting.', undefined, 5), 'r').status).toBe(503);
	});
	it('turns anything else into internal without details', () => {
		const r = errorBody(new Error('secret stack detail'), 'req-3');
		expect(r.status).toBe(500);
		expect(r.body.error.code).toBe('internal');
		expect(r.body.error.requestId).toBe('req-3');
		expect(JSON.stringify(r)).not.toContain('secret');
	});
});

describe('fieldsOf', () => {
	it('keeps the first message per field and joins nested paths', () => {
		const schema = z.object({ a: z.string().min(3).regex(/x/), b: z.object({ c: z.number() }) });
		const r = schema.safeParse({ a: '', b: { c: 'no' } });
		const f = fieldsOf(r.error!.issues);
		expect(Object.keys(f)).toEqual(['a', 'b.c']);
		expect(f.a).toBe(r.error!.issues[0]!.message);
	});
	it('puts form-level issues under _', () => {
		expect(fieldsOf([{ path: [], message: 'Whole form' }])).toEqual({ _: 'Whole form' });
	});
});

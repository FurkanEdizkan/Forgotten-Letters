import { describe, expect, it } from 'vitest';
import { resultOf } from './form-result';

describe('form results on a page of many forms', () => {
	it('gives a failure to the form and row that sent it, and to no other', () => {
		const form = {
			message: 'That seat is taken.',
			fields: { seatId: 'Pick another seat.' },
			values: { op: 'approve', id: 'r1' }
		};
		expect(resultOf(form, 'approve', 'r1')).toEqual({
			error: 'That seat is taken.',
			fields: { seatId: 'Pick another seat.' },
			done: null
		});
		expect(resultOf(form, 'approve', 'r2').error).toBeNull();
		expect(resultOf(form, 'decline', 'r1').error).toBeNull();
	});
	it('gives a success to its form, with or without a row', () => {
		const form = { op: 'link', id: 's3', url: '/join/abc' };
		expect(resultOf(form, 'link', 's3').done).toEqual(form);
		expect(resultOf(form, 'link').done).toEqual(form);
		expect(resultOf(form, 'link', 's4').done).toBeNull();
		expect(resultOf(null, 'link')).toEqual({ error: null, fields: {}, done: null });
	});
});

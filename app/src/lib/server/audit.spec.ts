import { describe, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({ db: {} }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { clientAddress } = await import('./audit');

const request = new Request('http://x/');

describe('clientAddress', () => {
	it('uses the address the proxy set-up reports', () => {
		expect(clientAddress({ request, getClientAddress: () => '10.0.0.7' })).toBe('10.0.0.7');
	});

	it('never throws when ADDRESS_HEADER is set but missing', () => {
		const getClientAddress = () => {
			throw new Error('Address header was specified with ADDRESS_HEADER=x-forwarded-for but is absent from request');
		};
		expect(clientAddress({ request, getClientAddress })).toBe('unknown');
	});
});

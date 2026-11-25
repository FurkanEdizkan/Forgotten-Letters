import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PORTS, describePorts, originFor, parsePorts, pickPort } from './ports.js';

/** Servers this file holds open; closed after each test. */
const held: Server[] = [];

/** Listen on `port` (0: any free one); resolves with the port, rejects with the listen error. */
function listenOn(port: number): Promise<number> {
	return new Promise((resolve, reject) => {
		const s = createServer();
		s.once('error', reject);
		s.listen({ host: '0.0.0.0', port }, () => {
			held.push(s);
			resolve((s.address() as { port: number }).port);
		});
	});
}

/** `n` random high ports, held until the test ends; and one that is free (opened and closed again). */
async function heldPorts(n: number) {
	const ports: number[] = [];
	for (let i = 0; i < n; i++) ports.push(await listenOn(0));
	return ports;
}
async function freePort() {
	const p = await listenOn(0);
	await new Promise<void>((r) => held.pop()!.close(() => r()));
	return p;
}

afterEach(async () => {
	await Promise.all(held.splice(0).map((s) => new Promise((r) => s.close(r))));
});

describe('parsePorts', () => {
	it('defaults to 3000 to 3005', () => {
		expect(parsePorts({})).toEqual([3000, 3001, 3002, 3003, 3004, 3005]);
		expect(parsePorts({ PORTS: '' })).toEqual(DEFAULT_PORTS);
	});
	it('reads PORTS in order, with or without spaces', () => {
		expect(parsePorts({ PORTS: '8080,8081' })).toEqual([8080, 8081]);
		expect(parsePorts({ PORTS: ' 4000 , 3000,  5000 ' })).toEqual([4000, 3000, 5000]);
	});
	it('uses the legacy PORT as the only port when PORTS is unset', () => {
		expect(parsePorts({ PORT: '4173' })).toEqual([4173]);
		expect(parsePorts({ PORT: '4173', PORTS: '3000,3001' })).toEqual([3000, 3001]);
	});
	it('refuses bad lists with the reason', () => {
		expect(() => parsePorts({ PORTS: '3000,abc' })).toThrow(/PORTS: "abc" is not a port number/);
		expect(() => parsePorts({ PORTS: '3000,,3001' })).toThrow(/PORTS: an entry is empty/);
		expect(() => parsePorts({ PORTS: '3000,70000' })).toThrow(/PORTS: 70000 is out of range/);
		expect(() => parsePorts({ PORTS: '0' })).toThrow(/out of range \(1 to 65535\)/);
		expect(() => parsePorts({ PORTS: '3000,3001,3000' })).toThrow(/PORTS: 3000 is listed twice/);
		expect(() => parsePorts({ PORTS: '30.5' })).toThrow(/not a port number/);
		expect(() => parsePorts({ PORT: 'x' })).toThrow(/PORT: "x" is not a port number/);
	});
});

describe('describePorts', () => {
	it('names a run of ports as a range, others as a list', () => {
		expect(describePorts([3000, 3001, 3002, 3003, 3004, 3005])).toBe('3000–3005');
		expect(describePorts([8080, 8081])).toBe('8080–8081');
		expect(describePorts([3000, 3005, 8080])).toBe('3000, 3005, 8080');
		expect(describePorts([3000])).toBe('3000');
	});
});

describe('pickPort', () => {
	const tryListen = (p: number) => listenOn(p).then(() => undefined);

	it('opens the first port when it is free', async () => {
		const p = await freePort();
		const warnings: string[] = [];
		expect(await pickPort([p], tryListen, (m) => warnings.push(m))).toEqual({
			port: p,
			wanted: p,
			tried: []
		});
		expect(warnings).toEqual([]);
	});
	it('skips taken ports in order, says so, and reports the ones it tried', async () => {
		const [a, b, c] = await heldPorts(3);
		const free = await freePort();
		const warnings: string[] = [];
		const out = await pickPort([a!, b!, c!, free], tryListen, (m) => warnings.push(m));
		expect(out).toEqual({ port: free, wanted: a, tried: [a, b, c] });
		expect(warnings).toEqual([
			`Port ${a} is in use, trying ${b}`,
			`Port ${b} is in use, trying ${c}`,
			`Port ${c} is in use, trying ${free}`
		]);
	});
	it('fails with every port listed when all are taken', async () => {
		const ports = await heldPorts(3);
		const warnings: string[] = [];
		const e = await pickPort(ports, tryListen, (m) => warnings.push(m)).catch((x) => x);
		expect(e).toMatchObject({ code: 'EALLPORTSTAKEN', ports });
		expect(e.message).toContain(`Ports ${describePorts(ports)} are all in use.`);
		expect(e.message).toContain('set PORTS in .env (for example PORTS=8080,8081)');
		expect(warnings).toHaveLength(2);
	});
	it('names a forbidden port and moves on', async () => {
		const free = await freePort();
		const warnings: string[] = [];
		const denied = (p: number) =>
			p === 80
				? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' }))
				: tryListen(p);
		expect((await pickPort([80, free], denied, (m) => warnings.push(m))).port).toBe(free);
		expect(warnings).toEqual([`Port 80 needs admin rights, trying ${free}`]);
	});
	it('passes other listen errors on unchanged', async () => {
		const odd = () => Promise.reject(Object.assign(new Error('odd'), { code: 'EINVAL' }));
		await expect(pickPort([3000, 3001], odd, () => {})).rejects.toMatchObject({ code: 'EINVAL' });
	});
});

describe('originFor', () => {
	const ports = [3000, 3001, 3002];
	it('points an http ORIGIN on a listed port at the opened port', () => {
		expect(originFor('http://192.168.1.20:3000', ports, 3001)).toBe('http://192.168.1.20:3001');
		expect(originFor('http://localhost:3000/', ports, 3002)).toBe('http://localhost:3002');
	});
	it('leaves it alone when nothing moved, or it is https, has no port or another port', () => {
		expect(originFor('http://192.168.1.20:3000', ports, 3000)).toBe('http://192.168.1.20:3000');
		expect(originFor('https://letters.example.org:3000', ports, 3001)).toBe(
			'https://letters.example.org:3000'
		);
		expect(originFor('http://letters.lan', ports, 3001)).toBe('http://letters.lan');
		expect(originFor('http://192.168.1.20:8080', ports, 3001)).toBe('http://192.168.1.20:8080');
		expect(originFor('not a url', ports, 3001)).toBe('not a url');
		expect(originFor(undefined, ports, 3001)).toBeUndefined();
	});
});

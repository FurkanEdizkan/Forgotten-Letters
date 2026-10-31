import { describe, expect, it } from 'vitest';
import { cardFacts, dateRange, day, dayYear, roleOn, type CardFacts } from './campaign-facts';

const base: CardFacts = {
	stage: 'mustering',
	seatsTaken: 5,
	seatsTotal: 8,
	startsOn: '2026-11-03',
	endsOn: '2026-12-15',
	gamesPerPlayer: 4,
	cmName: 'Edda',
	myRole: 'cm',
	mySeat: false
};

describe('dates', () => {
	it('prints a calendar date the same everywhere, never the day before', () => {
		expect(day('2026-11-03')).toBe('3 Nov');
		expect(dayYear('2026-01-01')).toBe('1 Jan 2026');
		expect(day('2026-10-28T23:30:00.000Z')).toBe('28 Oct');
	});
	it('reads a range with one year when both dates share it', () => {
		expect(dateRange('2026-11-03', '2026-12-15')).toBe('3 Nov to 15 Dec 2026');
		expect(dateRange('2026-12-20', '2027-01-10')).toBe('20 Dec 2026 to 10 Jan 2027');
		expect(dateRange('2026-11-03', null)).toBe('from 3 Nov 2026');
		expect(dateRange(null, '2026-12-15')).toBe('until 15 Dec 2026');
		expect(dateRange(null, null)).toBeNull();
	});
});

describe('card facts', () => {
	it('shows the seats, the date for the stage and the game count', () => {
		expect(cardFacts(base)).toEqual(['5 of 8 seats taken', 'starts 3 Nov', '4 games each']);
		expect(cardFacts({ ...base, stage: 'active' })).toEqual([
			'5 of 8 seats taken',
			'ends 15 Dec',
			'4 games each'
		]);
		expect(cardFacts({ ...base, stage: 'ended', gamesPerPlayer: null })).toEqual([
			'5 of 8 seats taken',
			'ended 15 Dec'
		]);
	});
	it('names the CM on a campaign you are not in, and never shows more than three', () => {
		const stranger = { ...base, myRole: null, mySeat: false };
		expect(cardFacts({ ...stranger, startsOn: null })).toEqual([
			'5 of 8 seats taken',
			'4 games each',
			'CM Edda'
		]);
		expect(cardFacts(stranger)).toHaveLength(3);
		expect(cardFacts({ ...base, gamesPerPlayer: 1, startsOn: null })).toEqual([
			'5 of 8 seats taken',
			'1 game each'
		]);
	});
	it('gives rights first, then a seat, then nothing', () => {
		expect(roleOn({ myRole: 'co_cm', mySeat: true })).toBe('co_cm');
		expect(roleOn({ myRole: null, mySeat: true })).toBe('player');
		expect(roleOn({ myRole: null, mySeat: false })).toBeNull();
	});
});

/**
 * How a campaign's dates and facts read on cards and pages. Pure, so it is unit-tested. Calendar dates
 * (`YYYY-MM-DD`) are formatted in UTC: a date has no time zone, and the server and the browser must print the same
 * text (local formatting would show the day before west of Greenwich).
 */
import { m } from '#lib/messages';
import type { CampaignRole } from '#lib/campaign-rights';
import type { Stage } from '#lib/campaign-stage';

const short = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const long = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC'
});

const at = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

/** "3 Nov". Takes a calendar date or a timestamp. */
export const day = (iso: string) => short.format(at(iso));

/** "3 Nov 2026". */
export const dayYear = (iso: string) => long.format(at(iso));

/** "3 Nov to 15 Dec 2026", "from 3 Nov 2026", "until 15 Dec 2026", or null with neither. */
export function dateRange(startsOn: string | null, endsOn: string | null) {
	if (startsOn && endsOn) {
		const sameYear = startsOn.slice(0, 4) === endsOn.slice(0, 4);
		return m.campaigns.range(sameYear ? day(startsOn) : dayYear(startsOn), dayYear(endsOn));
	}
	if (startsOn) return m.campaigns.from(dayYear(startsOn));
	if (endsOn) return m.campaigns.until(dayYear(endsOn));
	return null;
}

export type CardFacts = {
	stage: Stage;
	seatsTaken: number;
	seatsTotal: number;
	startsOn: string | null;
	endsOn: string | null;
	gamesPerPlayer: number | null;
	cmName: string;
	myRole: CampaignRole | null;
	mySeat: boolean;
};

/**
 * The card's one line of facts, at most three (design review: strips of three): the seats, then the date that
 * matters for the stage, then the game count, and the CM's name on a campaign you are not in.
 */
export function cardFacts(c: CardFacts): string[] {
	const facts = [m.campaigns.seatsTaken(c.seatsTaken, c.seatsTotal)];
	if (c.stage === 'ended' && c.endsOn) facts.push(m.campaigns.endedOn(day(c.endsOn)));
	else if (c.stage === 'mustering' && c.startsOn) facts.push(m.campaigns.startsOn(day(c.startsOn)));
	else if (c.stage === 'active' && c.endsOn) facts.push(m.campaigns.endsOn(day(c.endsOn)));
	if (c.gamesPerPlayer) facts.push(m.campaigns.gamesEach(c.gamesPerPlayer));
	if (!c.myRole && !c.mySeat) facts.push(m.campaigns.cmIs(c.cmName));
	return facts.slice(0, 3);
}

/** The role badge a person gets on a campaign: their rights, else player when they hold a seat, else none. */
export const roleOn = (c: { myRole: CampaignRole | null; mySeat: boolean }) =>
	c.myRole ?? (c.mySeat ? 'player' : null);

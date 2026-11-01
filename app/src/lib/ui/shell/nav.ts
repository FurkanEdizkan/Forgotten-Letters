/**
 * What the app shell shows and how it behaves, kept pure so it is tested without a browser: the owner area's
 * sections, the help and legal links, the panel's default by window width, the remembered panel choice, and the
 * pages that sit outside the shell.
 */
import { areasFor, type Role } from '#lib/roles';
import { m } from '#lib/messages';

/** The owner area's sections, in the order the panel and the owner tabs show them. */
export const OWNER_SECTIONS = [
	{ path: '/owner', label: m.owner.tabs.people },
	{ path: '/owner/invites', label: m.owner.tabs.invites },
	{ path: '/owner/settings', label: m.owner.tabs.settings },
	{ path: '/owner/audit', label: m.owner.tabs.audit },
	{ path: '/owner/backups', label: m.owner.tabs.backups },
	{ path: '/owner/rules', label: m.owner.tabs.rules },
	{ path: '/owner/frames', label: m.owner.tabs.frames }
] as const;

/** The compendium, open to every signed-in role; shown in the panel after the person's own areas. */
export const RULES_LINK = { path: '/rules', label: m.rules.sidePanel } as const;

/** Everyone's own warbands, for every signed-in role; shown in the panel before the compendium. */
export const WARBANDS_LINK = { path: '/warbands', label: m.warbands.sidePanel } as const;

/** Everyone's own homebrew, and what others shared; for every signed-in role, after Warbands. */
export const HOMEBREW_LINK = { path: '/homebrew', label: m.homebrew.sidePanel } as const;

/** Every help and legal page, by its slug under /help. Docs sits in the top bar; the rest at the panel's foot. */
export const HELP_SLUGS = [
	'docs',
	'faq',
	'licence',
	'contact',
	'support',
	'privacy',
	'terms',
	'unofficial'
] as const;
export type HelpSlug = (typeof HELP_SLUGS)[number];

export const isHelpSlug = (s: string): s is HelpSlug =>
	(HELP_SLUGS as readonly string[]).includes(s);

/** The links at the foot of the panel, in the approved order (FAQ first, the unofficial notice last). */
export const HELP_LINKS = HELP_SLUGS.filter((s) => s !== 'docs').map((s) => ({
	path: `/help/${s}`,
	label: m.help.titles[s]
}));

/** The panel starts open on a full-HD window and closed on a laptop (DESIGN.md §5). */
export const PANEL_OPEN_FROM = 1920;
export const panelOpenByDefault = (width: number) => width >= PANEL_OPEN_FROM;

/** Where the person's own panel choice is kept in the browser. */
export const PANEL_KEY = 'fl.panel';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * The remembered choice: true (open), false (closed) or null (none yet, follow the width). Storage can be missing or
 * throw (private windows, blocked site data), which counts as no choice.
 */
export function readPanelChoice(store: () => Store | undefined): boolean | null {
	try {
		const v = store()?.getItem(PANEL_KEY);
		return v === 'open' ? true : v === 'closed' ? false : null;
	} catch {
		return null;
	}
}

/** Remember the choice; a storage that refuses is ignored (the panel still works for this page). */
export function savePanelChoice(store: () => Store | undefined, open: boolean) {
	try {
		store()?.setItem(PANEL_KEY, open ? 'open' : 'closed');
	} catch {
		// Nothing to do: the choice lasts until the page is left.
	}
}

/** Is `path` this link's page or a page under it? */
export const isUnder = (path: string, link: string) => path === link || path.startsWith(link + '/');

/** Welcome, setup, sign-in and the visitor link pages are full-height split pages: no shell, no footer. */
export const isFullHeightPage = (path: string) =>
	/^\/(welcome|setup|login|join|invite)(\/|$)/.test(path);

/** How many of your campaigns the side panel lists before "All campaigns…". */
export const PANEL_CAMPAIGNS = 8;

/**
 * The side panel's Campaigns group: your first campaigns by name, then "All campaigns…" to the full list. The
 * layout loads one more than it shows, so `more` is known without a count query.
 */
export function campaignLinks(cards: { id: string; name: string }[]) {
	return {
		links: cards
			.slice(0, PANEL_CAMPAIGNS)
			.map((c) => ({ path: `/campaigns/${c.id}`, label: c.name })),
		all: { path: '/campaigns', label: m.campaigns.allCampaigns }
	};
}

/** The person as the shell sees them: never the session hash. */
export type ShellUser = {
	id: string;
	username: string;
	displayName: string;
	role: Role;
	mustChangePassword: boolean;
};

/** The shell's data for a signed-in person: who they are and which areas they can use. */
export function shellData(u: ShellUser) {
	return {
		me: {
			id: u.id,
			username: u.username,
			displayName: u.displayName,
			role: u.role,
			mustChangePassword: u.mustChangePassword
		},
		areas: areasFor(u.role)
	};
}

/** The letter in the user button: the display name's first letter, upper case. */
export const initialOf = (name: string) => ([...name.trim()][0] ?? '?').toLocaleUpperCase();

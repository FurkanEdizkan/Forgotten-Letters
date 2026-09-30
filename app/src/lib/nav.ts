/**
 * Every navigation entry in one place. The app used to carry three hard-coded lists — the
 * masthead, the map's chips and the admin bar — which drifted apart; one source keeps them honest.
 */
export interface NavItem {
	href: string;
	label: string;
	/** Matched as a prefix unless 'exact'. The live map is '/' and would otherwise match everything. */
	match?: 'exact' | 'prefix';
}

/** The campaign as everyone reads it, players and Campaign Master alike. */
export const PLAY: NavItem[] = [
	{ href: '/', label: 'Live map', match: 'exact' },
	{ href: '/players', label: 'Standings' },
	{ href: '/zones', label: 'Zones' },
	{ href: '/compendium', label: 'Compendium' },
	{ href: '/history', label: 'Chronicle' }
];

/** Game night: what the Campaign Master does while the group is playing. */
export const OPERATE: NavItem[] = [
	{ href: '/admin', label: 'Campaign', match: 'exact' },
	{ href: '/admin/games', label: 'Games' },
	{ href: '/admin/players', label: 'Players' },
	{ href: '/admin/log', label: 'Log' },
	{ href: '/admin/warbands', label: 'Warbands' },
	{ href: '/admin/adjustments', label: 'Adjustments' },
	{ href: '/admin/visions', label: 'Visions' },
	{ href: '/admin/weather', label: 'Weather' }
];

/** Set up once, or between sessions. Reached through Settings, not the panel. */
export const CONFIGURE: NavItem[] = [
	{ href: '/admin', label: 'Campaign setup', match: 'exact' },
	{ href: '/admin/map', label: 'Map Studio' },
	{ href: '/admin/lore', label: 'Lore' },
	{ href: '/admin/rules', label: 'Rules' },
	{ href: '/admin/studio', label: 'Faction Studio' },
	{ href: '/admin/factions', label: 'Factions' },
	{ href: '/admin/backup', label: 'Backup' }
];

export const isCurrent = (item: NavItem, pathname: string) =>
	item.match === 'exact' ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');

/** The chapter named in the running footer, from whichever entry the path falls under. */
export const chapterOf = (pathname: string) =>
	PLAY.find((i) => i.href !== '/' && isCurrent(i, pathname))?.label ?? '';

/** The panel's state rides a cookie, so the first paint is already the right width. Open by
 *  default everywhere except the live map, which is the one surface the panel covers. */
export const navOpenFrom = (cookie: string | undefined, pathname: string) =>
	cookie ? cookie === '1' : pathname !== '/';

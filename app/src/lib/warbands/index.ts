/**
 * The warband engine: builds and checks warbands against a rules set (app/src/lib/rules/pack.ts). Pure: the
 * builder page, the warband service and the local legal-list runner (scripts/rules-legal.ts) share it.
 */
export {
	resolveFaction,
	dedicationVariant,
	mergeSets,
	patronAllowed,
	nameOf,
	unitKey,
	type Resolved,
	type SetWithBase
} from './resolve.ts';
export {
	canRecruit,
	canEquip,
	canUpgrade,
	canStash,
	availableUnits,
	availableLines,
	upgradeFor,
	capOf,
	limitCount
} from './checks.ts';
export { canCopy } from './copy.ts';
export { canChange } from './change.ts';
export { canRecruitWith, loadoutOptions, type Pick } from './recruit.ts';
export { issues } from './issues.ts';
export { rating, priceOf, fighterCosts, stashCost, type Buy } from './prices.ts';
export {
	bestLine,
	buildModel,
	buildModels,
	armourOf,
	handsOf,
	valueOf,
	type Model,
	type Carried
} from './model.ts';
export { matchItem, matchModel } from './select.ts';
export { limitIssues, loadoutCheck, scopedLimits, weaponCount } from './limits.ts';
export { describeItems, describeModels, describeLimit } from './describe.ts';
export { keywordLabel, explain } from './keywords.ts';
export * as progression from './progression.ts';
export { toText, fromText, parseText, refName, fighterLabel } from './text.ts';
export { toJson, fromJson, fromTcJson, parseTcJson } from './json.ts';
export { matchNamed, factionByName, findByName, skillRef, type Named } from './match.ts';
export * from './types.ts';
export * as campaign from './campaign.ts';

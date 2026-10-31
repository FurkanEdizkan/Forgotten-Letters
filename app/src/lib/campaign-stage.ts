/**
 * The campaign's stages and how it moves between them. Pure: services check every move here, pages use it to show
 * only the moves that are allowed.
 */
export const STAGES = ['mustering', 'active', 'ended'] as const;
export type Stage = (typeof STAGES)[number];

// Active may go back to mustering (a late seat to fill); ended is final and read-only.
const MOVES: Record<Stage, readonly Stage[]> = {
	mustering: ['active'],
	active: ['ended', 'mustering'],
	ended: []
};

export const canMove = (from: Stage, to: Stage) => MOVES[from].includes(to);

export const nextMoves = (from: Stage) => MOVES[from];

/** How someone gets into (or out of) a seat. */
export type JoinWay = 'link' | 'request' | 'by_name' | 'leave';

/** Links, requests and leaving work only while mustering; the CM adds people by name until the campaign ends. */
export const joinOpen = (stage: Stage, way: JoinWay) =>
	way === 'by_name' ? stage !== 'ended' : stage === 'mustering';

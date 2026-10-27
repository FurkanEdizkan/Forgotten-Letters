/**
 * The few movements the first-run screens allow (DESIGN.md §8 exceptions), on anime.js. Rules:
 * - Content is visible by default. Every helper only animates *from* a hidden start to the element's own styles, and
 *   then removes what it set, with a timer as a safety net. If scripts or animation never run, nothing stays hidden.
 * - Under prefers-reduced-motion every helper does nothing and resolves at once.
 * - Ease-out curves; about 250 ms, the hand-off at most 400 ms.
 */
import { animate, stagger } from 'animejs';

const EASE = 'outCubic';
export const DURATION = 250;
export const HANDOFF_DURATION = 380;

/** Whether the person asked for less motion. False on the server. */
export const reducedMotion = () =>
	typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

type Targets = Element | Element[] | NodeListOf<Element>;
const list = (t: Targets): HTMLElement[] =>
	(t instanceof Element ? [t] : Array.from(t)).filter(
		(e): e is HTMLElement => e instanceof HTMLElement || e instanceof SVGElement
	) as HTMLElement[];

/** Remove the inline styles an animation left, so the stylesheet decides again. */
function settle(els: HTMLElement[]) {
	for (const el of els) {
		el.style.removeProperty('opacity');
		el.style.removeProperty('transform');
	}
}

/** Run one anime.js animation and resolve when it ends (or when the safety timer fires). */
function run(els: HTMLElement[], params: Parameters<typeof animate>[1], total: number) {
	if (!els.length || reducedMotion()) return Promise.resolve();
	return new Promise<void>((resolve) => {
		const done = () => {
			clearTimeout(timer);
			settle(els);
			resolve();
		};
		const timer = setTimeout(done, total + 500);
		try {
			animate(els, { ...params, onComplete: done });
		} catch {
			done();
		}
	});
}

/**
 * Entrance: each target fades in and rises a little, one after the other.
 * Use on mount; the first target starts after `delay` ms.
 */
export function entrance(targets: Targets, { delay = 0, gap = 70 } = {}) {
	const els = list(targets);
	return run(
		els,
		{
			opacity: { from: 0 },
			translateY: { from: 10 },
			duration: DURATION,
			delay: stagger(gap, { start: delay }),
			ease: EASE
		},
		delay + gap * els.length + DURATION
	);
}

/** A slow fade for the emblem on load (400 ms), with a slight grow. */
export function emblemIn(target: Element | null) {
	if (!target) return Promise.resolve();
	return run(
		[target as HTMLElement],
		{ opacity: { from: 0 }, scale: { from: 0.96 }, duration: 400, ease: EASE },
		400
	);
}

/**
 * Step change in the wizard: the new step cross-fades in and slides 1.4 em from the side it comes from
 * (`direction` 1 = forward, from the right; -1 = back, from the left).
 */
export function stepIn(target: Element | null, direction: 1 | -1 = 1) {
	if (!target) return Promise.resolve();
	const em = parseFloat(getComputedStyle(target).fontSize) || 16;
	return run(
		[target as HTMLElement],
		{
			opacity: { from: 0 },
			translateX: { from: direction * 1.4 * em },
			duration: DURATION,
			ease: EASE
		},
		DURATION
	);
}

/**
 * The hand-off from the welcome page into setup: the split moves (the left column's share goes from `from` to `to`
 * per cent, through the `--split` custom property the page's grid reads) and the outgoing content fades and slides
 * away. Resolves when done, so the caller can navigate; the next page starts at `to`.
 */
export function handOff(
	root: HTMLElement,
	outgoing: Targets,
	{ from, to }: { from: number; to: number }
) {
	if (reducedMotion()) return Promise.resolve();
	const out = list(outgoing);
	const em = parseFloat(getComputedStyle(root).fontSize) || 16;
	const split = { value: from };
	return new Promise<void>((resolve) => {
		let finished = false;
		const done = () => {
			if (finished) return;
			finished = true;
			clearTimeout(timer);
			resolve();
		};
		// The page navigates away right after, so the outgoing content may stay faded; on any failure we still go.
		const timer = setTimeout(done, HANDOFF_DURATION + 300);
		try {
			animate(split, {
				value: to,
				duration: HANDOFF_DURATION,
				ease: EASE,
				onUpdate: () => root.style.setProperty('--split', `${split.value}%`),
				onComplete: done
			});
			if (out.length)
				animate(out, {
					opacity: 0,
					translateX: -1.4 * em,
					duration: DURATION,
					ease: EASE
				});
		} catch {
			done();
		}
	});
}

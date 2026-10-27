/**
 * The soft highlight on a glass control that follows the pointer (DESIGN.md §6, first-run exceptions). The position
 * goes into two custom properties the control's CSS reads; set through the CSSOM, so the strict CSP allows it.
 */
export function glow(node: HTMLElement) {
	const move = (e: PointerEvent) => {
		const r = node.getBoundingClientRect();
		node.style.setProperty('--glow-x', `${e.clientX - r.left}px`);
		node.style.setProperty('--glow-y', `${e.clientY - r.top}px`);
	};
	node.addEventListener('pointermove', move);
	return { destroy: () => node.removeEventListener('pointermove', move) };
}

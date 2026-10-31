/**
 * A link made on the server is relative when ORIGIN is not set; it gets this page's address so it can be sent as
 * is (as Invites.svelte does for invite links).
 */
export const absoluteLink = (link: string) =>
	link.startsWith('/') && typeof location !== 'undefined' ? location.origin + link : link;

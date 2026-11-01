/**
 * Copy text to the clipboard. The Clipboard API exists only on HTTPS and localhost, so on a plain-HTTP LAN address
 * this falls back to a hidden text area and the old copy command. Call it from a click (browsers allow copying for
 * a few seconds after one). Returns false when neither worked, so the caller can show the text to copy by hand.
 */
export async function copyText(text: string): Promise<boolean> {
	if (navigator.clipboard && window.isSecureContext) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// fall through to the old way
		}
	}
	const area = document.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.opacity = '0';
	document.body.append(area);
	area.select();
	try {
		return document.execCommand('copy');
	} catch {
		return false;
	} finally {
		area.remove();
	}
}

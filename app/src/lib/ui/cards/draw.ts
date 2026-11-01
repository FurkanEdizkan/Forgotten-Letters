/**
 * Draws a fighter card on a canvas (review decision D2): the same canvas is shown and saved as the PNG. The inside
 * is the same for every warband; the faction's frame (an 800×1000 PNG with a transparent window) is laid over it,
 * or the built-in brass frame when there is none. Colours are fixed, not the theme's: the card is a picture that
 * looks the same wherever it is printed or posted. Fonts and images are awaited first, or the first draw would use
 * a fallback serif and miss the frame.
 */
import {
	BAND,
	CARD_HEIGHT as H,
	CARD_WIDTH as W,
	PHOTO,
	TEXT,
	clamp,
	shrink,
	wrap,
	type CardData
} from './layout';

const C = {
	bg: '#17140f',
	panel: '#1f1b15',
	line: '#4a4134',
	bone: '#ece5d3',
	dim: '#b0a791',
	faint: '#857b6c',
	gold: '#c9a24a',
	edge: '#0a0907'
};
// The family names of lib/ui/tokens.css, bundled with @fontsource.
const DISPLAY = "'Pirata One', serif";
const BODY = "'EB Garamond', Georgia, serif";

/** Load the faces the card uses; a failure only means a fallback face. */
export async function fontsReady() {
	await Promise.all(
		["52px 'Pirata One'", "400 23px 'EB Garamond'", "700 23px 'EB Garamond'"].map((f) =>
			document.fonts.load(f).catch(() => [])
		)
	);
}

/** An image ready to draw, or null when it is missing or broken (the card draws without it). */
export async function loadImage(url: string | null): Promise<HTMLImageElement | null> {
	if (!url) return null;
	const img = new Image();
	img.src = url;
	try {
		await img.decode();
		return img;
	} catch {
		return null;
	}
}

/** Fill the photo window with the picture, keeping its upper third in view (review decision D8). */
function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, initials: string) {
	const { x, y, w, h } = PHOTO;
	if (!img) {
		ctx.fillStyle = C.panel;
		ctx.fillRect(x, y, w, h);
		ctx.fillStyle = C.faint;
		ctx.font = `${Math.round(h * 0.42)}px ${DISPLAY}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(initials, x + w / 2, y + h / 2);
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		return;
	}
	const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
	const sw = w / scale;
	const sh = h / scale;
	const sx = (img.naturalWidth - sw) / 2;
	const sy = (img.naturalHeight - sh) * 0.3;
	ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
	// Fade the photo's foot into the card, as the reference does.
	const fade = ctx.createLinearGradient(0, y + h * 0.65, 0, y + h);
	fade.addColorStop(0, 'rgba(23,20,15,0)');
	fade.addColorStop(1, C.bg);
	ctx.fillStyle = fade;
	ctx.fillRect(x, y + h * 0.65, w, h * 0.35 + 1);
}

/** The built-in frame: a dark edge and a brass line. */
function builtInFrame(ctx: CanvasRenderingContext2D) {
	ctx.strokeStyle = C.edge;
	ctx.lineWidth = BAND * 0.9;
	ctx.strokeRect(0, 0, W, H);
	ctx.strokeStyle = C.gold;
	ctx.lineWidth = 5;
	ctx.strokeRect(BAND * 0.55, BAND * 0.55, W - BAND * 1.1, H - BAND * 1.1);
}

const STAT_H = 68;
const GAP = 8;

/** Lay out the text at value size `size`; draws when `draw`, and answers the height it takes. */
function body(ctx: CanvasRenderingContext2D, d: CardData, size: number, draw: boolean) {
	const { x, w } = TEXT;
	let y = TEXT.y + 48;
	const put = (s: string, at: number, font: string, colour: string) => {
		if (!draw) return;
		ctx.font = font;
		ctx.fillStyle = colour;
		ctx.fillText(s, x, at);
	};
	// Name: as large as fits on one line.
	const nameSize = shrink(52, 30, (n) => {
		ctx.font = `${n}px ${DISPLAY}`;
		return ctx.measureText(d.name).width <= w;
	});
	put(d.name, y, `${nameSize}px ${DISPLAY}`, C.gold);
	y += 34;
	ctx.font = `${size}px ${BODY}`;
	const m = (s: string) => ctx.measureText(s).width;
	for (const l of clamp(wrap(d.subtitle, w, m), 2, w, m)) {
		put(l, y, `${size}px ${BODY}`, C.dim);
		y += size * 1.25;
	}
	y += 6;
	const bw = (w - GAP * (d.stats.length - 1)) / d.stats.length;
	if (draw)
		d.stats.forEach((s, i) => {
			const bx = x + i * (bw + GAP);
			ctx.strokeStyle = C.line;
			ctx.lineWidth = 2;
			ctx.strokeRect(bx, y, bw, STAT_H);
			ctx.textAlign = 'center';
			ctx.fillStyle = C.faint;
			ctx.font = `17px ${BODY}`;
			ctx.fillText(s.label, bx + bw / 2, y + 24);
			const vs = shrink(26, 12, (n) => {
				ctx.font = `700 ${n}px ${BODY}`;
				return ctx.measureText(s.value).width <= bw - 10;
			});
			ctx.font = `700 ${vs}px ${BODY}`;
			ctx.fillStyle = C.bone;
			ctx.fillText(s.value, bx + bw / 2, y + 54);
			ctx.textAlign = 'left';
		});
	y += STAT_H + 30;
	for (const r of d.rows) {
		put(r.label, y, `${Math.max(14, size - 6)}px ${BODY}`, C.faint);
		y += size * 1.2;
		ctx.font = `${size}px ${BODY}`;
		for (const l of clamp(wrap(r.value, w, m), 2, w, m)) {
			put(l, y, `${size}px ${BODY}`, C.bone);
			y += size * 1.25;
		}
		y += 8;
	}
	return y;
}

/** Draw the whole card: inside, photo, text at the largest size that fits, footer, then the frame on top. */
export function drawCard(
	ctx: CanvasRenderingContext2D,
	d: CardData,
	img: { photo: HTMLImageElement | null; frame: HTMLImageElement | null }
) {
	ctx.clearRect(0, 0, W, H);
	ctx.fillStyle = C.bg;
	ctx.fillRect(0, 0, W, H);
	drawPhoto(ctx, img.photo, d.initials);
	const footer = TEXT.bottom - 6;
	const size = shrink(23, 15, (n) => body(ctx, d, n, false) <= footer - 24);
	body(ctx, d, size, true);
	ctx.font = `16px ${BODY}`;
	ctx.fillStyle = C.faint;
	ctx.fillText(d.footer, TEXT.x, footer);
	if (img.frame) ctx.drawImage(img.frame, 0, 0, W, H);
	else builtInFrame(ctx);
}

/** The template a group draws its frame over: the frame band, the photo window and the text area. */
export function drawTemplate(
	ctx: CanvasRenderingContext2D,
	t: { band: string; photo: string; text: string }
) {
	ctx.clearRect(0, 0, W, H);
	ctx.fillStyle = 'rgba(163,23,15,0.55)';
	ctx.fillRect(0, 0, W, BAND);
	ctx.fillRect(0, H - BAND, W, BAND);
	ctx.fillRect(0, 0, BAND, H);
	ctx.fillRect(W - BAND, 0, BAND, H);
	ctx.setLineDash([12, 8]);
	ctx.strokeStyle = '#857b6c';
	ctx.lineWidth = 3;
	ctx.strokeRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
	ctx.strokeRect(TEXT.x, TEXT.y, TEXT.w, TEXT.bottom - TEXT.y);
	ctx.setLineDash([]);
	ctx.fillStyle = '#857b6c';
	ctx.textAlign = 'center';
	ctx.font = `600 32px ${BODY}`;
	ctx.fillText(t.photo, W / 2, PHOTO.y + PHOTO.h / 2);
	ctx.fillText(t.text, W / 2, (TEXT.y + TEXT.bottom) / 2);
	ctx.font = `600 22px ${BODY}`;
	ctx.fillStyle = '#ffffff';
	ctx.fillText(t.band, W / 2, BAND * 0.68);
	ctx.textAlign = 'left';
}

/** The canvas as a PNG file. */
export const toPng = (canvas: HTMLCanvasElement) =>
	new Promise<Blob>((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No PNG'))), 'image/png')
	);

/** Hand the browser a file to save, under this name. */
export function save(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

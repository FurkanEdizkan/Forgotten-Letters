/**
 * Browser-side seal compositing: tint the neutral medallion strip with the metal colour, fill the
 * light mask with the foot-to-crest gradient, and add the light over the metal. One canvas per look,
 * cached; pages use it as an image URL, the map as a texture.
 */
import type { SealLook } from './seals';

const canvases = new Map<string, Promise<HTMLCanvasElement>>();
const urls = new Map<string, Promise<string>>();

const key = (l: SealLook) => [l.base, l.light, l.metal, l.low, l.high].join('|');

function load(src: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

async function draw(look: SealLook) {
	const [base, light] = await Promise.all([load(look.base), load(look.light)]);
	const w = base.naturalWidth;
	const h = base.naturalHeight;
	const out = document.createElement('canvas');
	out.width = w;
	out.height = h;
	const c = out.getContext('2d')!;
	// Metal: multiply the silver by the colour, then restore the medallion's own outline.
	c.drawImage(base, 0, 0);
	c.globalCompositeOperation = 'multiply';
	c.fillStyle = look.metal;
	c.fillRect(0, 0, w, h);
	c.globalCompositeOperation = 'destination-in';
	c.drawImage(base, 0, 0);
	// Light: the gradient, cut to the mask, added over the metal.
	const glow = document.createElement('canvas');
	glow.width = w;
	glow.height = h;
	const g = glow.getContext('2d')!;
	const grad = g.createLinearGradient(0, h, 0, 0);
	grad.addColorStop(0, look.low);
	grad.addColorStop(0.15, look.low);
	grad.addColorStop(0.8, look.high);
	grad.addColorStop(1, look.high);
	g.fillStyle = grad;
	g.fillRect(0, 0, w, h);
	g.globalCompositeOperation = 'destination-in';
	g.drawImage(light, 0, 0);
	c.globalCompositeOperation = 'lighter';
	c.drawImage(glow, 0, 0);
	c.globalCompositeOperation = 'source-over';
	return out;
}

/** The composited strip as a canvas (for textures). */
export function sealCanvas(look: SealLook) {
	const k = key(look);
	if (!canvases.has(k)) canvases.set(k, draw(look));
	return canvases.get(k)!;
}

/** The composited strip as an object URL (for CSS backgrounds). */
export function sealUrl(look: SealLook) {
	const k = key(look);
	if (!urls.has(k))
		urls.set(
			k,
			sealCanvas(look).then(
				(cv) => new Promise<string>((resolve) => cv.toBlob((b) => resolve(URL.createObjectURL(b!)), 'image/webp', 0.9))
			)
		);
	return urls.get(k)!;
}

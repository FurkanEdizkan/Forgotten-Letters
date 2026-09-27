import { Assets, Container, Graphics, Particle, ParticleContainer, Sprite, Texture, type Application, type Spritesheet } from 'pixi.js';
import { DEFAULT_PARAMS, TIME_OF_DAY, type FxKind, type FxParams, type FxTrigger, type TimeOfDay } from './types';

/**
 * Weather & atmosphere for the live map.
 *
 * Effects run either in screen space (map-wide, don't zoom) or in world space
 * around a zone (move and zoom with the map). The engine is declarative: each
 * snapshot produces a list of wanted effects and `setWanted` diffs it against
 * what is running.
 */

export type Scope = { type: 'screen' } | { type: 'zone'; id: string; x: number; y: number };
export interface Wanted {
	key: string;
	kind: FxKind;
	scope: Scope;
	intensity: number;
	params?: FxParams;
}

interface Effect {
	update(dt: number, t: number): void;
	setIntensity(i: number): void;
	/** Size multiplier for effects that scale their own pieces (particles). */
	setSize?(k: number): void;
	destroy(): void;
	/** One-shot effects report when they are finished. */
	done?: () => boolean;
}

const ZONE_R = 130;

function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	draw(c.getContext('2d')!);
	return Texture.from(c);
}

function makeTextures() {
	const radial = (inner: string, outer: string, size = 256) =>
		canvasTexture(size, size, (g) => {
			const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
			grd.addColorStop(0, inner);
			grd.addColorStop(1, outer);
			g.fillStyle = grd;
			g.fillRect(0, 0, size, size);
		});
	const bird = (up: boolean) =>
		canvasTexture(48, 28, (g) => {
			g.strokeStyle = '#140d08';
			g.lineWidth = 4;
			g.lineCap = 'round';
			g.beginPath();
			const wing = up ? 4 : 20;
			g.moveTo(4, wing);
			g.quadraticCurveTo(14, up ? 2 : 14, 24, 16);
			g.quadraticCurveTo(34, up ? 2 : 14, 44, wing);
			g.stroke();
			g.fillStyle = '#140d08';
			g.beginPath();
			g.ellipse(24, 17, 4, 3, 0, 0, Math.PI * 2);
			g.fill();
		});
	return {
		streak: canvasTexture(4, 64, (g) => {
			const grd = g.createLinearGradient(0, 0, 0, 64);
			grd.addColorStop(0, 'rgba(255,255,255,0)');
			grd.addColorStop(1, 'rgba(255,255,255,1)');
			g.fillStyle = grd;
			g.fillRect(0, 0, 4, 64);
		}),
		dot: radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 32),
		blob: radial('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)', 256),
		vignette: radial('rgba(255,255,255,0)', 'rgba(255,255,255,1)', 256),
		ray: canvasTexture(64, 256, (g) => {
			const grd = g.createLinearGradient(0, 0, 0, 256);
			grd.addColorStop(0, 'rgba(255,255,255,0.9)');
			grd.addColorStop(1, 'rgba(255,255,255,0)');
			g.fillStyle = grd;
			g.beginPath();
			g.moveTo(24, 0);
			g.lineTo(40, 0);
			g.lineTo(64, 256);
			g.lineTo(0, 256);
			g.closePath();
			g.fill();
		}),
		birdUp: bird(true),
		birdDown: bird(false)
	};
}
type Textures = ReturnType<typeof makeTextures>;

/** Blender-rendered sprite sheets (static/fx/*.json), when loaded. */
export type SheetName = 'lightning' | 'fire' | 'crow' | 'smoke';
type Sheets = Partial<Record<SheetName, Texture[]>>;

interface Ctx {
	app: Application;
	tex: Textures;
	sheets: Sheets;
	/** Particle budget multiplier from quality settings (0 = no particles). */
	q: number;
	wind: () => number;
	/** Shake request for tremors. */
	shake: (seconds: number, strength: number) => void;
}

/** Bounds of a scope, in its own coordinate space. */
function area(ctx: Ctx, scope: Scope) {
	if (scope.type === 'screen') return { x: 0, y: 0, w: ctx.app.screen.width, h: ctx.app.screen.height };
	return { x: scope.x - ZONE_R, y: scope.y - ZONE_R, w: ZONE_R * 2, h: ZONE_R * 2 };
}

// ---------------------------------------------------------------- particles

interface P extends Particle {
	vx: number;
	vy: number;
	life: number;
	age: number;
	base: number;
}

interface ParticleSpec {
	texture: keyof Textures;
	/** Particles at intensity 1 for the full screen (zones get a fraction). */
	count: number;
	tint: () => number;
	alpha: number;
	spawn: (p: P, b: ReturnType<typeof area>, r: () => number, wind: number, initial: boolean) => void;
	step?: (p: P, dt: number, t: number, wind: number) => void;
	scale: (r: () => number) => [number, number];
	/** Align rotation with velocity (rain). */
	align?: boolean;
}

class Particles implements Effect {
	c: ParticleContainer;
	ps: (P & { sx: number; sy: number })[] = [];
	r = Math.random;
	target = 0;
	size = 1;
	constructor(
		private ctx: Ctx,
		private scope: Scope,
		private spec: ParticleSpec,
		parent: Container,
		intensity: number
	) {
		this.c = new ParticleContainer({ dynamicProperties: { position: true, rotation: true, color: true, vertex: true } });
		parent.addChild(this.c);
		this.setIntensity(intensity);
	}
	bounds() {
		return area(this.ctx, this.scope);
	}
	setIntensity(i: number) {
		const share = this.scope.type === 'zone' ? 0.14 : 1;
		this.target = Math.round(this.spec.count * i * share * this.ctx.q);
		while (this.ps.length < this.target) {
			const p = new Particle({ texture: this.ctx.tex[this.spec.texture], anchorX: 0.5, anchorY: 0.5 }) as P & { sx: number; sy: number };
			const [sx, sy] = this.spec.scale(this.r);
			p.sx = sx;
			p.sy = sy;
			p.scaleX = sx * this.size;
			p.scaleY = sy * this.size;
			p.tint = this.spec.tint();
			this.spec.spawn(p, this.bounds(), this.r, this.ctx.wind(), true);
			p.base = this.spec.alpha * (0.6 + 0.4 * this.r());
			p.alpha = p.base;
			this.ps.push(p);
			this.c.addParticle(p);
		}
		while (this.ps.length > this.target) this.c.removeParticle(this.ps.pop()!);
	}
	setSize(k: number) {
		this.size = k;
		for (const p of this.ps) {
			p.scaleX = p.sx * k;
			p.scaleY = p.sy * k;
		}
	}
	update(dt: number, t: number) {
		const b = this.bounds();
		const wind = this.ctx.wind();
		const zone = this.scope.type === 'zone' ? this.scope : null;
		for (const p of this.ps) {
			p.age += dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			this.spec.step?.(p, dt, t, wind);
			if (this.spec.align) p.rotation = Math.atan2(p.vy, p.vx) - Math.PI / 2;
			const fade = p.life > 0 ? Math.min(1, p.age / 0.3, (p.life - p.age) / 0.6) : 1;
			p.alpha = Math.max(0, p.base * fade);
			const outside = zone
				? Math.hypot(p.x - zone.x, p.y - zone.y) > ZONE_R * 1.1
				: p.y > b.h + 40 || p.y < -80 || p.x < -80 || p.x > b.w + 80;
			if (outside || (p.life > 0 && p.age >= p.life)) this.spec.spawn(p, b, this.r, wind, false);
		}
	}
	destroy() {
		this.c.destroy();
	}
}

const inZone = (b: ReturnType<typeof area>, r: () => number) => {
	const a = r() * Math.PI * 2;
	const d = Math.sqrt(r()) * (b.w / 2);
	return { x: b.x + b.w / 2 + Math.cos(a) * d, y: b.y + b.h / 2 + Math.sin(a) * d };
};

function rainSpec(tint: number, alpha: number, heavy = 1): ParticleSpec {
	return {
		texture: 'streak',
		count: 650 * heavy,
		tint: () => tint,
		alpha,
		align: true,
		scale: (r) => [0.5 + r() * 0.4, 0.5 + r() * 0.6],
		spawn: (p, b, r, wind, initial) => {
			const zone = b.w === ZONE_R * 2;
			p.vy = (zone ? 380 : 900) + r() * (zone ? 200 : 500);
			p.vx = wind * p.vy * 0.35;
			if (zone) {
				const q = inZone(b, r);
				p.x = q.x;
				p.y = initial ? q.y : b.y + r() * ZONE_R * 0.6;
			} else {
				p.x = r() * (b.w + 200) - 100 - wind * 150;
				p.y = initial ? r() * b.h : -60 - r() * 60;
			}
			p.life = 0;
			p.age = 0;
		}
	};
}

function embersSpec(): ParticleSpec {
	const colors = [0xffb347, 0xff7a1a, 0xffd27a, 0xe8430f];
	return {
		texture: 'dot',
		count: 260,
		tint: () => colors[Math.floor(Math.random() * colors.length)],
		alpha: 0.95,
		scale: (r) => {
			const s = 0.15 + r() * 0.35;
			return [s, s];
		},
		spawn: (p, b, r, wind, initial) => {
			const zone = b.w === ZONE_R * 2;
			if (zone) {
				const q = inZone(b, r);
				p.x = q.x;
				p.y = q.y + ZONE_R * 0.3;
			} else {
				p.x = r() * b.w;
				p.y = initial ? r() * b.h : b.h + 10;
			}
			p.vy = -(zone ? 30 : 50) - r() * (zone ? 60 : 110);
			p.vx = wind * 30;
			p.life = 2 + r() * 4;
			p.age = initial ? r() * p.life : 0;
		},
		step: (p, dt, t) => {
			p.vx += Math.sin(t * 2 + p.base * 40) * 12 * dt;
			p.alpha *= 0.75 + 0.25 * Math.sin(t * 13 + p.base * 90);
		}
	};
}

function dustSpec(): ParticleSpec {
	return {
		texture: 'dot',
		count: 180,
		tint: () => 0x6b5236,
		alpha: 0.45,
		scale: (r) => {
			const s = 0.3 + r() * 0.8;
			return [s, s];
		},
		spawn: (p, b, r, wind, initial) => {
			const zone = b.w === ZONE_R * 2;
			const q = zone ? inZone(b, r) : { x: r() * b.w, y: r() * b.h };
			p.x = initial || zone ? q.x : wind >= 0 ? -20 : b.w + 20;
			p.y = q.y;
			p.vx = (wind || 0.2) * (40 + r() * 60);
			p.vy = (r() - 0.5) * 10;
			p.life = zone ? 3 + r() * 3 : 0;
			p.age = 0;
		}
	};
}

// ---------------------------------------------------------------- fog & tints

class Fog implements Effect {
	c = new Container();
	blobs: { s: Sprite; vx: number; phase: number }[] = [];
	constructor(
		private ctx: Ctx,
		private scope: Scope,
		private tint: number,
		private alpha: number,
		parent: Container,
		intensity: number
	) {
		parent.addChild(this.c);
		const r = Math.random;
		const n = scope.type === 'zone' ? 5 : 9;
		for (let i = 0; i < n; i++) {
			const s = new Sprite(ctx.tex.blob);
			s.anchor.set(0.5);
			s.tint = tint;
			const b = area(ctx, scope);
			const size = scope.type === 'zone' ? ZONE_R * (1 + r()) : Math.max(b.w, b.h) * (0.35 + r() * 0.35);
			s.width = size * 1.6;
			s.height = size;
			s.x = b.x + r() * b.w;
			s.y = b.y + b.h * (scope.type === 'zone' ? r() : 0.2 + r() * 0.8);
			this.c.addChild(s);
			this.blobs.push({ s, vx: 6 + r() * 14, phase: r() * 10 });
		}
		this.setIntensity(intensity);
	}
	setIntensity(i: number) {
		this.c.alpha = this.alpha * (0.4 + 0.6 * i);
	}
	update(dt: number, t: number) {
		const b = area(this.ctx, this.scope);
		const wind = this.ctx.wind() || 0.15;
		for (const f of this.blobs) {
			f.s.x += f.vx * wind * dt * (this.scope.type === 'zone' ? 0.4 : 1);
			f.s.alpha = 0.7 + 0.3 * Math.sin(t * 0.3 + f.phase);
			const half = f.s.width / 2;
			if (this.scope.type === 'zone') {
				const cx = this.scope.x;
				if (f.s.x > cx + ZONE_R) f.s.x = cx - ZONE_R;
				if (f.s.x < cx - ZONE_R) f.s.x = cx + ZONE_R;
			} else {
				if (f.s.x - half > b.w) f.s.x = -half;
				if (f.s.x + half < 0) f.s.x = b.w + half;
			}
		}
	}
	destroy() {
		this.c.destroy({ children: true });
	}
}

/** Coloured light: vignette on screen, glow disc on a zone. Optional pulse. */
class Glow implements Effect {
	s: Sprite;
	extra = new Container();
	constructor(
		private ctx: Ctx,
		private scope: Scope,
		private tint: number,
		private alpha: number,
		private pulse: number,
		parent: Container,
		intensity: number,
		moon = false
	) {
		this.s = new Sprite(scope.type === 'screen' ? ctx.tex.vignette : ctx.tex.blob);
		this.s.tint = tint;
		parent.addChild(this.s, this.extra);
		if (moon && scope.type === 'screen') {
			const m = new Graphics().circle(0, 0, 38).fill({ color: 0x7a0c0c }).circle(-10, -6, 34).fill({ color: 0x1a0606 });
			this.extra.addChild(m);
		}
		this.layout();
		this.setIntensity(intensity);
	}
	layout() {
		const b = area(this.ctx, this.scope);
		if (this.scope.type === 'screen') {
			this.s.position.set(-b.w * 0.15, -b.h * 0.15);
			this.s.width = b.w * 1.3;
			this.s.height = b.h * 1.3;
			this.extra.position.set(b.w - 90, 130);
		} else {
			this.s.anchor.set(0.5);
			this.s.position.set(this.scope.x, this.scope.y);
			this.s.width = this.s.height = ZONE_R * 2.4;
		}
	}
	private base = 1;
	setIntensity(i: number) {
		this.base = this.alpha * (0.4 + 0.6 * i);
	}
	update(_dt: number, t: number) {
		if (this.scope.type === 'screen') this.layout();
		this.s.alpha = this.base * (1 - this.pulse + this.pulse * (0.5 + 0.5 * Math.sin(t * 2.2)));
	}
	destroy() {
		this.s.destroy();
		this.extra.destroy({ children: true });
	}
}

/** Beams of holy light from above. */
class Rays implements Effect {
	c = new Container();
	rays: { s: Sprite; phase: number; baseRot: number }[] = [];
	constructor(
		private ctx: Ctx,
		private scope: Scope,
		parent: Container,
		intensity: number
	) {
		parent.addChild(this.c);
		const n = scope.type === 'zone' ? 3 : 6;
		for (let i = 0; i < n; i++) {
			const s = new Sprite(ctx.tex.ray);
			s.anchor.set(0.5, 0);
			s.tint = 0xffe6a0;
			s.blendMode = 'add';
			this.c.addChild(s);
			this.rays.push({ s, phase: Math.random() * 10, baseRot: (i - (n - 1) / 2) * 0.12 });
		}
		this.setIntensity(intensity);
	}
	setIntensity(i: number) {
		this.c.alpha = 0.25 + 0.35 * i;
	}
	update(_dt: number, t: number) {
		const b = area(this.ctx, this.scope);
		for (const r of this.rays) {
			if (this.scope.type === 'screen') {
				r.s.position.set(b.w * 0.5 + r.baseRot * b.w * 2.5, -20);
				r.s.width = b.w * 0.12;
				r.s.height = b.h * 1.1;
			} else {
				r.s.position.set(this.scope.x + r.baseRot * 200, this.scope.y - ZONE_R * 2.2);
				r.s.width = ZONE_R * 0.7;
				r.s.height = ZONE_R * 3;
			}
			r.s.rotation = r.baseRot + Math.sin(t * 0.25 + r.phase) * 0.05;
			r.s.alpha = 0.6 + 0.4 * Math.sin(t * 0.6 + r.phase);
		}
	}
	destroy() {
		this.c.destroy({ children: true });
	}
}

// ---------------------------------------------------------------- rendered sequences

/** Plays a Blender-rendered frame sequence once, then reports done. */
class FrameSprite implements Effect {
	s: Sprite;
	age: number;
	constructor(
		private frames: Texture[],
		parent: Container,
		at: { x: number; y: number },
		opts: { scale: number; anchorY?: number; fps?: number; tint?: number; alpha?: number; delay?: number; rotation?: number; drift?: { x: number; y: number } }
	) {
		this.s = new Sprite(frames[0]);
		this.s.anchor.set(0.5, opts.anchorY ?? 0.5);
		this.s.position.set(at.x, at.y);
		this.s.scale.set(opts.scale);
		this.s.rotation = opts.rotation ?? 0;
		if (opts.tint !== undefined) this.s.tint = opts.tint;
		this.baseAlpha = opts.alpha ?? 1;
		this.fps = opts.fps ?? 24;
		this.age = -(opts.delay ?? 0);
		this.drift = opts.drift;
		this.s.visible = this.age >= 0;
		parent.addChild(this.s);
	}
	private baseAlpha: number;
	private fps: number;
	private drift?: { x: number; y: number };
	setIntensity() {}
	update(dt: number) {
		this.age += dt;
		this.s.visible = this.age >= 0;
		if (this.age < 0) return;
		const i = Math.min(this.frames.length - 1, Math.floor(this.age * this.fps));
		this.s.texture = this.frames[i];
		this.s.alpha = this.baseAlpha;
		if (this.drift) {
			this.s.x += this.drift.x * dt;
			this.s.y += this.drift.y * dt;
		}
	}
	done = () => this.age * this.fps >= this.frames.length;
	destroy() {
		this.s.destroy();
	}
}

/** Smoke puffs that bloom and fade at random spots, for smog, miasma and dust. */
class Puffs implements Effect {
	c = new Container();
	live: FrameSprite[] = [];
	next = 0;
	i = 1;
	constructor(
		private ctx: Ctx,
		private scope: Scope,
		private tint: number,
		private alpha: number,
		parent: Container,
		intensity: number
	) {
		parent.addChild(this.c);
		this.setIntensity(intensity);
	}
	setIntensity(i: number) {
		this.i = i;
	}
	update(dt: number) {
		const frames = this.ctx.sheets.smoke;
		this.next -= dt;
		if (frames && this.next <= 0) {
			const zone = this.scope.type === 'zone';
			this.next = (zone ? 1.4 : 0.6) / (0.3 + this.i) / Math.max(0.35, this.ctx.q);
			const b = area(this.ctx, this.scope);
			const at = zone ? inZone(b, Math.random) : { x: Math.random() * b.w, y: b.h * (0.2 + Math.random() * 0.8) };
			const wind = this.ctx.wind() || 0.15;
			this.live.push(
				new FrameSprite(frames, this.c, at, {
					scale: zone ? 0.9 + Math.random() * 0.6 : 1.2 + Math.random() * 1.4,
					fps: 7,
					tint: this.tint,
					alpha: this.alpha,
					rotation: Math.random() * Math.PI * 2,
					drift: { x: wind * 30, y: -8 }
				})
			);
		}
		for (const p of this.live) p.update(dt);
		this.live = this.live.filter((p) => (p.done() ? (p.destroy(), false) : true));
	}
	destroy() {
		for (const p of this.live) p.destroy();
		this.c.destroy({ children: true });
	}
}

// ---------------------------------------------------------------- lightning

function drawBolt(g: Graphics, from: { x: number; y: number }, to: { x: number; y: number }, r: () => number, color: number, width: number) {
	const segs = 14;
	const pts = [from];
	for (let i = 1; i < segs; i++) {
		const t = i / segs;
		const jitter = (1 - Math.abs(0.5 - t)) * Math.hypot(to.x - from.x, to.y - from.y) * 0.06;
		pts.push({ x: from.x + (to.x - from.x) * t + (r() - 0.5) * jitter * 2, y: from.y + (to.y - from.y) * t + (r() - 0.5) * jitter });
	}
	pts.push(to);
	const path = (w: number, c: number, a: number) => {
		g.moveTo(pts[0].x, pts[0].y);
		for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
		g.stroke({ width: w, color: c, alpha: a, cap: 'round', join: 'round' });
	};
	path(width * 5, color, 0.25);
	path(width * 2, color, 0.6);
	path(width, 0xffffff, 1);
	// A branch or two
	for (let k = 0; k < 2; k++) {
		const i = 3 + Math.floor(r() * (segs - 6));
		const a = pts[i];
		const end = { x: a.x + (r() - 0.5) * 160, y: a.y + 60 + r() * 120 };
		g.moveTo(a.x, a.y).lineTo((a.x + end.x) / 2 + (r() - 0.5) * 30, (a.y + end.y) / 2).lineTo(end.x, end.y);
		g.stroke({ width: width * 0.6, color, alpha: 0.7, cap: 'round' });
	}
}

/** One lightning strike: bolt + flash, fades out. */
class Strike implements Effect {
	g = new Graphics();
	bolt: FrameSprite | null = null;
	global = new Graphics();
	flashPeak = 0.35;
	flash = new Graphics();
	age = 0;
	constructor(
		ctx: Ctx,
		scope: Scope,
		parentWorld: Container,
		parentScreen: Container,
		r: () => number,
		private color: number,
		at?: { x: number; y: number },
		portent = false
	) {
		const b = area(ctx, scope);
		const target = at ?? (scope.type === 'zone' ? { x: scope.x, y: scope.y } : { x: b.w * (0.1 + r() * 0.8), y: b.h * (0.4 + r() * 0.5) });
		const top = { x: target.x + (r() - 0.5) * 200, y: target.y - (scope.type === 'screen' && !at ? target.y + 20 : 700) };
		const parent = scope.type === 'screen' && !at ? parentScreen : parentWorld;
		const frames = ctx.sheets.lightning;
		if (frames && color !== 0x5dffa0) {
			// Blender-rendered bolt, striking at the sprite's bottom-centre.
			const height = target.y - top.y;
			this.bolt = new FrameSprite(frames, parent, target, { scale: height / frames[0].height, anchorY: 0.98, fps: 16 });
			this.bolt.s.scale.x *= r() < 0.5 ? -1 : 1;
		} else {
			drawBolt(this.g, top, target, r, color, scope.type === 'screen' && !at ? 3 : 6);
			parent.addChild(this.g);
		}
		// Map-wide storms light up the whole screen; a zone's own storm only lights its zone;
		// a portent struck at a zone gets a gentler global flash.
		if (scope.type === 'screen' && !at) {
			this.flash.rect(0, 0, ctx.app.screen.width, ctx.app.screen.height).fill({ color: 0xffffff });
			this.flashPeak = 0.35;
			parentScreen.addChild(this.flash);
		} else {
			this.flash.circle(target.x, target.y, 260).fill({ color: 0xffffff });
			this.flashPeak = 0.3;
			parentWorld.addChild(this.flash);
			if (portent) {
				this.global.rect(0, 0, ctx.app.screen.width, ctx.app.screen.height).fill({ color: 0xffffff });
				parentScreen.addChild(this.global);
			}
		}
		this.flash.tint = color;
		this.global.tint = color;
	}
	setIntensity() {}
	update(dt: number) {
		this.age += dt;
		const flicker = this.age < 0.08 || (this.age > 0.14 && this.age < 0.2) ? 1 : 0.4;
		this.g.alpha = Math.max(0, 1 - this.age / 0.5) * flicker;
		this.flash.alpha = Math.max(0, this.flashPeak - this.age * 1.2) * flicker;
		this.global.alpha = Math.max(0, 0.12 - this.age * 0.5) * flicker;
		this.bolt?.update(dt);
	}
	done = () => this.age > 0.6 && (!this.bolt || this.bolt.done());
	destroy() {
		this.bolt?.destroy();
		this.global.destroy();
		this.g.destroy();
		this.flash.destroy();
	}
}

/** Periodic lightning (and a darker sky for full storms). */
class Storm implements Effect {
	dark: Graphics | null = null;
	next = 1 + Math.random() * 3;
	strikes: Strike[] = [];
	i = 1;
	constructor(
		private ctx: Ctx,
		private scope: Scope,
		private world: Container,
		private screen: Container,
		private color: number,
		darkSky: boolean,
		intensity: number
	) {
		if (darkSky && scope.type === 'screen') {
			this.dark = new Graphics();
			screen.addChild(this.dark);
		}
		this.setIntensity(intensity);
	}
	setIntensity(i: number) {
		this.i = i;
	}
	update(dt: number, t: number) {
		if (this.dark) {
			this.dark.clear().rect(0, 0, this.ctx.app.screen.width, this.ctx.app.screen.height).fill({ color: 0x0b0a14, alpha: 0.18 + 0.2 * this.i });
		}
		this.next -= dt;
		if (this.next <= 0) {
			this.next = (2 + Math.random() * 7) / (0.4 + this.i);
			this.strikes.push(new Strike(this.ctx, this.scope, this.world, this.screen, Math.random, this.color));
		}
		for (const s of this.strikes) s.update(dt);
		this.strikes = this.strikes.filter((s) => (s.done() ? (s.destroy(), false) : true));
		void t;
	}
	destroy() {
		this.dark?.destroy();
		for (const s of this.strikes) s.destroy();
	}
}

// ---------------------------------------------------------------- crows

class Crows implements Effect {
	c = new Container();
	birds: { s: Sprite; vx: number; vy: number; phase: number; speed: number; orbit: number; life: number }[] = [];
	age = 0;
	constructor(
		private ctx: Ctx,
		private scope: Scope,
		parent: Container,
		intensity: number,
		private burst?: { x: number; y: number; r: () => number }
	) {
		parent.addChild(this.c);
		if (burst) {
			for (let i = 0; i < 14; i++) this.add(burst.r, true);
		} else this.setIntensity(intensity);
	}
	add(r: () => number, burst = false) {
		const s = new Sprite(this.ctx.sheets.crow?.[0] ?? this.ctx.tex.birdUp);
		s.anchor.set(0.5);
		const rendered = this.ctx.sheets.crow ? 0.55 : 1;
		const k = (this.scope.type === 'zone' || this.burst ? 1.1 : 0.7 + r() * 0.5) * rendered;
		s.scale.set(k);
		this.c.addChild(s);
		const b = area(this.ctx, this.scope);
		const bird = { s, vx: 0, vy: 0, phase: r() * 10, speed: 70 + r() * 60, orbit: 50 + r() * 70, life: 0 };
		if (burst && this.burst) {
			const a = -Math.PI / 2 + (r() - 0.5) * 2.4;
			s.position.set(this.burst.x, this.burst.y);
			bird.vx = Math.cos(a) * (140 + r() * 120);
			bird.vy = Math.sin(a) * (140 + r() * 120);
		} else if (this.scope.type === 'screen') {
			s.position.set(-40 - r() * 300, b.h * (0.1 + r() * 0.5));
			bird.vx = bird.speed;
			bird.vy = (r() - 0.5) * 20;
		}
		this.birds.push(bird);
	}
	setIntensity(i: number) {
		const n = Math.max(1, Math.round((this.scope.type === 'zone' ? 5 : 12) * i * Math.max(0.5, this.ctx.q)));
		while (this.birds.length < n) this.add(Math.random);
		while (this.birds.length > n) this.birds.pop()!.s.destroy();
	}
	update(dt: number, t: number) {
		this.age += dt;
		const b = area(this.ctx, this.scope);
		for (const bird of this.birds) {
			const flap = this.ctx.sheets.crow;
			const prev = { x: bird.s.x, y: bird.s.y };
			if (flap) bird.s.texture = flap[Math.floor(t * 12 + bird.phase * 3) % flap.length];
			else bird.s.texture = Math.sin(t * 14 + bird.phase) > 0 ? this.ctx.tex.birdUp : this.ctx.tex.birdDown;
			if (this.burst) {
				bird.s.x += bird.vx * dt;
				bird.s.y += bird.vy * dt;
				bird.vy += 20 * dt;
				bird.s.alpha = Math.max(0, 1 - this.age / 4);
			} else if (this.scope.type === 'zone') {
				const a = t * (bird.speed / bird.orbit) * 0.5 + bird.phase;
				bird.s.position.set(this.scope.x + Math.cos(a) * bird.orbit * 1.4, this.scope.y - 40 + Math.sin(a) * bird.orbit * 0.6);
				if (!flap) bird.s.scale.x = Math.abs(bird.s.scale.x) * (Math.sin(a) > 0 ? -1 : 1);
			} else {
				bird.s.x += (bird.vx + this.ctx.wind() * 40) * dt;
				bird.s.y += (bird.vy + Math.sin(t + bird.phase) * 25) * dt;
				if (bird.s.x > b.w + 60) {
					bird.s.x = -60 - Math.random() * 200;
					bird.s.y = b.h * (0.1 + Math.random() * 0.5);
				}
			}
			// Top-down rendered crows face +X: turn them along their flight path.
			if (flap && (bird.s.x !== prev.x || bird.s.y !== prev.y)) {
				bird.s.rotation = Math.atan2(bird.s.y - prev.y, bird.s.x - prev.x);
			}
		}
	}
	done = () => !!this.burst && this.age > 4;
	destroy() {
		this.c.destroy({ children: true });
	}
}

/** Tremors: shakes the whole stage every few seconds. */
class Quake implements Effect {
	next = 2;
	i = 1;
	constructor(
		private ctx: Ctx,
		intensity: number
	) {
		this.setIntensity(intensity);
	}
	setIntensity(i: number) {
		this.i = i;
	}
	update(dt: number) {
		this.next -= dt;
		if (this.next <= 0) {
			this.next = 4 + Math.random() * 8;
			this.ctx.shake(0.7, 4 + 8 * this.i);
		}
	}
	destroy() {}
}

/** Barbed wire: a dark red ring that tightens and relaxes. */
class Thorns implements Effect {
	g = new Graphics();
	constructor(
		private scope: Scope,
		parent: Container,
		private ctx: Ctx
	) {
		parent.addChild(this.g);
	}
	setIntensity() {}
	update(_dt: number, t: number) {
		const s = this.scope;
		this.g.clear();
		const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
		if (s.type === 'zone') {
			const r = ZONE_R * (0.75 + 0.1 * pulse);
			for (let i = 0; i < 24; i++) {
				const a = (i / 24) * Math.PI * 2 + t * 0.1;
				const a2 = a + 0.2;
				this.g.moveTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r).lineTo(s.x + Math.cos(a2) * (r + 14), s.y + Math.sin(a2) * (r + 14));
			}
			this.g.circle(s.x, s.y, r).stroke({ width: 4, color: 0x3a0a08, alpha: 0.85 });
			this.g.stroke({ width: 3, color: 0x3a0a08, alpha: 0.85 });
		} else {
			const { width: w, height: h } = this.ctx.app.screen;
			this.g.rect(0, 0, w, h).stroke({ width: 18 + 10 * pulse, color: 0x3a0a08, alpha: 0.5 });
		}
	}
	destroy() {
		this.g.destroy();
	}
}

// ---------------------------------------------------------------- engine

interface Running {
	effect: Effect;
	holder: Container;
	scope: Scope;
	params: FxParams;
	/** The effect's own clock, so speed changes don't jump its phase. */
	t: number;
}

export class FxEngine {
	private tex: Textures;
	private running = new Map<string, Running>();
	private grade = new Graphics();
	private oneShots: Effect[] = [];
	private screenLayer = new Container();
	private worldBack = new Container();
	private worldFront = new Container();
	private ctx: Ctx;
	private windValue = 0;
	private shakeLeft = 0;
	private shakeStrength = 0;
	private t = 0;

	constructor(
		private app: Application,
		screen: Container,
		/** World-space parents inside the viewport: behind and in front of the markers. */
		worldBackParent: Container,
		worldFrontParent: Container,
		quality: number
	) {
		this.tex = makeTextures();
		this.worldBack.addChild(this.grade);
		worldBackParent.addChild(this.worldBack);
		worldFrontParent.addChild(this.worldFront);
		screen.addChild(this.screenLayer);
		this.ctx = {
			app,
			tex: this.tex,
			sheets: {},
			q: quality,
			wind: () => this.windValue,
			shake: (s, k) => {
				this.shakeLeft = s;
				this.shakeStrength = k;
			}
		};
		app.ticker.add(this.tick);
		void this.loadSheets();
	}

	/** Load the Blender-rendered sheets; effects fall back to drawn versions until (or if never) loaded. */
	private async loadSheets() {
		const names: SheetName[] = ['lightning', 'fire', 'crow', 'smoke'];
		await Promise.all(
			names.map(async (name) => {
				try {
					const sheet = await Assets.load<Spritesheet>(`/fx/${name}.json`);
					const frames = sheet.animations[name];
					if (frames?.length) this.ctx.sheets[name] = frames;
				} catch (e) {
					console.warn(`fx: ${name} sheet unavailable, using drawn effect`, e);
				}
			})
		);
		// Rebuild running effects so they pick up the new textures.
		this.clearRunning();
		this.onSheets?.();
	}

	/** Called once the sheets have loaded, so the owner can re-apply its wanted effects. */
	onSheets?: () => void;

	set wind(w: number) {
		this.windValue = w;
	}

	set quality(q: number) {
		if (q === this.ctx.q) return;
		this.ctx.q = q;
		this.clearRunning();
	}

	private clearRunning() {
		for (const r of this.running.values()) this.dispose(r);
		this.running.clear();
	}

	private dispose(r: Running) {
		r.effect.destroy();
		r.holder.destroy({ children: true });
	}

	/** Colour grade over the map (under the markers): day, dusk, night, blood moon. */
	setTimeOfDay(tod: TimeOfDay, worldW: number, worldH: number) {
		const g = TIME_OF_DAY[tod] ?? TIME_OF_DAY.day;
		this.grade.clear();
		if (g.alpha > 0) this.grade.rect(0, 0, worldW, worldH).fill({ color: g.color, alpha: g.alpha });
	}

	/** Opacity, tint and size apply to the effect's holder; speed to its clock. */
	private applyParams(r: Running) {
		const p = r.params;
		r.holder.alpha = p.opacity;
		r.holder.tint = p.tint ?? 0xffffff;
		if (r.effect.setSize && r.scope.type === 'screen') {
			r.effect.setSize(p.scale);
			r.holder.scale.set(1);
			return;
		}
		r.holder.scale.set(p.scale);
		if (r.scope.type === 'zone') {
			r.holder.pivot.set(r.scope.x, r.scope.y);
			r.holder.position.set(r.scope.x, r.scope.y);
		}
	}

	/** Effects drawn behind the markers (fog, glows, smoke); the rest go in front. */
	private static BACK = new Set<FxKind>(['fog', 'miasma', 'smog', 'haze', 'eclipse', 'heat']);

	private make(w: Wanted, holder: Container): Effect | null {
		const { ctx } = this;
		const layer = holder;
		const back = holder;
		const i = w.intensity;
		const particles = (spec: ParticleSpec) => (ctx.q > 0 ? new Particles(ctx, w.scope, spec, layer, i) : null);
		switch (w.kind) {
			case 'rain':
				return particles(rainSpec(0xb8c6d8, 0.45));
			case 'bloodRain':
				return particles(rainSpec(0x9e1010, 0.75));
			case 'storm':
				return new Storm(ctx, w.scope, holder, holder, 0xdfe8ff, true, i);
			case 'emeraldStorm':
				return new Storm(ctx, w.scope, holder, holder, 0x5dffa0, false, i);
			case 'fog':
				return new Fog(ctx, w.scope, 0xdcdad0, 0.5, back, i);
			case 'miasma':
				return this.pair(new Fog(ctx, w.scope, 0x7d9a5c, 0.55, back, i), ctx.q > 0 ? new Puffs(ctx, w.scope, 0x9dbb74, 0.55, back, i) : null);
			case 'smog':
				return this.pair(new Fog(ctx, w.scope, 0x2e2822, 0.6, back, i), ctx.q > 0 ? new Puffs(ctx, w.scope, 0x5a5048, 0.8, back, i) : null);
			case 'haze':
				return new Fog(ctx, w.scope, 0xeae5d6, 0.3, back, i);
			case 'dust':
				return this.pair(particles(dustSpec()), ctx.q > 0 && w.scope.type === 'zone' ? new Puffs(ctx, w.scope, 0x8a6a45, 0.5, back, i * 0.5) : null);
			case 'embers':
				return particles(embersSpec());
			case 'crows':
				return new Crows(ctx, w.scope, layer, i);
			case 'eclipse':
				return new Glow(ctx, w.scope, 0x6e0606, 0.75, 0.15, back, i, true);
			case 'heat':
				return new Glow(ctx, w.scope, 0xd9661a, 0.5, 0.35, back, i);
			case 'choir':
				return new Rays(ctx, w.scope, layer, i);
			case 'quake':
				return new Quake(ctx, i);
			case 'thorns':
				return new Thorns(w.scope, layer, ctx);
		}
	}

	/** Run two effects as one (e.g. fog plus smoke puffs). */
	private pair(a: Effect | null, b: Effect | null): Effect | null {
		if (!a || !b) return a ?? b;
		return {
			update: (dt, t) => (a.update(dt, t), b.update(dt, t)),
			setIntensity: (i) => (a.setIntensity(i), b.setIntensity(i)),
			destroy: () => (a.destroy(), b.destroy())
		};
	}

	/** Diff the wanted effects against the running ones. */
	setWanted(wanted: Wanted[]) {
		const keep = new Set<string>();
		for (const w of wanted) {
			keep.add(w.key);
			const params = w.params ?? DEFAULT_PARAMS;
			const r = this.running.get(w.key);
			if (r) {
				r.effect.setIntensity(w.intensity);
				r.params = params;
				this.applyParams(r);
				continue;
			}
			const parent =
				w.scope.type === 'screen' ? this.screenLayer : FxEngine.BACK.has(w.kind) ? this.worldBack : this.worldFront;
			const holder = new Container();
			parent.addChild(holder);
			const effect = this.make(w, holder);
			if (!effect) {
				holder.destroy();
				continue;
			}
			const entry: Running = { effect, holder, scope: w.scope, params, t: 0 };
			this.applyParams(entry);
			this.running.set(w.key, entry);
		}
		for (const [key, r] of this.running) {
			if (!keep.has(key)) {
				this.dispose(r);
				this.running.delete(key);
			}
		}
	}

	/** Play a one-shot effect. `at` is in world coordinates; omit for anywhere on screen. */
	trigger(t: FxTrigger, at?: { x: number; y: number }) {
		if (t.kind === 'dice') return; // drawn by the page as a DOM overlay
		const r = rng(t.seed);
		const zone: Scope = at ? { type: 'zone', id: t.zone ?? '', x: at.x, y: at.y } : { type: 'screen' };
		switch (t.kind) {
			case 'lightning': {
				this.oneShots.push(new Strike(this.ctx, zone, this.worldFront, this.screenLayer, r, 0xdfe8ff, at, true));
				if (this.ctx.q > 0 && at) this.oneShots.push(this.burst(at, r, 30));
				break;
			}
			case 'crows': {
				const b = area(this.ctx, zone);
				const p = at ?? { x: b.w * (0.2 + r() * 0.6), y: b.h * (0.3 + r() * 0.5) };
				this.oneShots.push(new Crows(this.ctx, zone, at ? this.worldFront : this.screenLayer, 1, { ...p, r }));
				break;
			}
			case 'fire': {
				const b = area(this.ctx, zone);
				const p = at ?? { x: b.w * (0.2 + r() * 0.6), y: b.h * (0.4 + r() * 0.4) };
				const scope: Scope = at ? zone : { type: 'zone', id: '', x: p.x, y: p.y };
				const fire = this.ctx.sheets.fire;
				if (fire && this.ctx.q > 0) {
					const parent = at ? this.worldFront : this.screenLayer;
					const k = at ? 1.6 : 1.1;
					this.oneShots.push(new FrameSprite(fire, parent, p, { scale: k, anchorY: 0.72, fps: 18 }));
					const smoke = this.ctx.sheets.smoke;
					if (smoke)
						this.oneShots.push(
							new FrameSprite(smoke, at ? this.worldBack : this.screenLayer, { x: p.x, y: p.y - 40 * k }, {
								scale: k * 1.1, fps: 9, tint: 0x3a3029, alpha: 0.8, delay: 0.35, drift: { x: this.windValue * 25, y: -14 }
							})
						);
					break;
				}
				const glow = new Glow(this.ctx, scope, 0xff5a14, 0.9, 0, at ? this.worldBack : this.screenLayer, 1);
				let age = 0;
				this.oneShots.push({
					update: (dt, tt) => {
						age += dt;
						glow.update(dt, tt);
						glow.s.alpha = Math.max(0, 0.9 - age / 2.5);
					},
					setIntensity() {},
					destroy: () => glow.destroy(),
					done: () => age > 2.5
				});
				if (this.ctx.q > 0) this.oneShots.push(this.burst(p, r, 90, !at));
				break;
			}
			case 'quake':
				this.ctx.shake(1, 12);
				break;
		}
	}

	/** Upward burst of embers from a point. */
	private burst(at: { x: number; y: number }, r: () => number, n: number, screen = false): Effect {
		const c = new ParticleContainer({ dynamicProperties: { position: true, color: true } });
		(screen ? this.screenLayer : this.worldFront).addChild(c);
		const ps: P[] = [];
		const colors = [0xffb347, 0xff7a1a, 0xffd27a, 0xe8430f];
		for (let i = 0; i < n; i++) {
			const p = new Particle({ texture: this.tex.dot, anchorX: 0.5, anchorY: 0.5, x: at.x, y: at.y }) as P;
			const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
			const v = 80 + r() * 260;
			p.vx = Math.cos(a) * v;
			p.vy = Math.sin(a) * v;
			p.scaleX = p.scaleY = 0.2 + r() * 0.4;
			p.tint = colors[Math.floor(r() * colors.length)];
			p.life = 1 + r() * 1.5;
			p.age = 0;
			ps.push(p);
			c.addParticle(p);
		}
		let age = 0;
		return {
			update: (dt) => {
				age += dt;
				for (const p of ps) {
					p.age += dt;
					p.vy += 140 * dt;
					p.vx *= 0.99;
					p.x += p.vx * dt;
					p.y += p.vy * dt;
					p.alpha = Math.max(0, 1 - p.age / p.life);
				}
			},
			setIntensity() {},
			destroy: () => c.destroy(),
			done: () => age > 2.6
		};
	}

	private tick = () => {
		const dt = Math.min(0.05, this.app.ticker.deltaMS / 1000);
		this.t += dt;
		const { width: sw, height: sh } = this.app.screen;
		for (const r of this.running.values()) {
			const d = dt * r.params.speed;
			r.t += d;
			if (r.scope.type === 'screen' && r.params.scale !== 1 && !r.effect.setSize) {
				r.holder.pivot.set(sw / 2, sh / 2);
				r.holder.position.set(sw / 2, sh / 2);
			}
			r.effect.update(d, r.t);
		}
		for (const e of this.oneShots) e.update(dt, this.t);
		this.oneShots = this.oneShots.filter((e) => (e.done?.() ? (e.destroy(), false) : true));
		if (this.shakeLeft > 0) {
			this.shakeLeft -= dt;
			const k = this.shakeStrength * Math.max(0, this.shakeLeft);
			this.app.stage.position.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
			if (this.shakeLeft <= 0) this.app.stage.position.set(0, 0);
		}
	};

	destroy() {
		this.app.ticker.remove(this.tick);
		for (const r of this.running.values()) this.dispose(r);
		for (const e of this.oneShots) e.destroy();
		this.running.clear();
		this.oneShots = [];
	}
}

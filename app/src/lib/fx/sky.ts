import { Container, Particle, ParticleContainer, Sprite, Texture } from 'pixi.js';
import { Strike, rng, type Ctx, type Effect, type Pt } from './engine';
import type { TimeOfDay } from './types';

/**
 * The sky over the live map: the light of the hour, and clouds that drift across the map with the wind,
 * some only passing over, some raining for a while, some thunderheads. Everything is placed from the
 * server's clock, so every screen shows the same sky.
 */

// ---------------------------------------------------------------- light

type Hour = Exclude<TimeOfDay, 'cycle'>;
interface Light {
	/** Multiplied over the map: keeps its colours, dims and warms them. */
	mul: number;
	/** Added over the map: the glow of the sky. */
	glow: number;
	glowA: number;
	/** How brightly lanterns burn at outposts and battles. */
	lamps: number;
}
const LIGHT: Record<Hour, Light> = {
	day: { mul: 0xffffff, glow: 0xffffff, glowA: 0, lamps: 0 },
	dawn: { mul: 0xeed6ca, glow: 0xff9d7e, glowA: 0.07, lamps: 0.35 },
	dusk: { mul: 0xe9bb9c, glow: 0xff8a3c, glowA: 0.07, lamps: 0.6 },
	night: { mul: 0x56648f, glow: 0x16244e, glowA: 0.12, lamps: 1 },
	'blood-moon': { mul: 0xc0625a, glow: 0x8a0a0a, glowA: 0.1, lamps: 0.8 }
};
/** One day of the cycle: long day, a slow dusk, night, a short dawn. */
const DAY: [number, Hour][] = [
	[0, 'day'],
	[0.4, 'day'],
	[0.47, 'dusk'],
	[0.53, 'dusk'],
	[0.6, 'night'],
	[0.86, 'night'],
	[0.92, 'dawn'],
	[0.96, 'dawn'],
	[1, 'day']
];

const mixColour = (a: number, b: number, k: number) => {
	const ch = (s: number) => {
		const x = (a >> s) & 255;
		return Math.round(x + (((b >> s) & 255) - x) * k) << s;
	};
	return ch(16) | ch(8) | ch(0);
};
const mixLight = (a: Light, b: Light, k: number): Light => ({
	mul: mixColour(a.mul, b.mul, k),
	glow: mixColour(a.glow, b.glow, k),
	glowA: a.glowA + (b.glowA - a.glowA) * k,
	lamps: a.lamps + (b.lamps - a.lamps) * k
});
const smooth = (k: number) => k * k * (3 - 2 * k);

/** The light at a point of the day (0–1). */
export function lightAt(phase: number): Light {
	const p = ((phase % 1) + 1) % 1;
	for (let i = 1; i < DAY.length; i++) {
		const [t1, h1] = DAY[i];
		const [t0, h0] = DAY[i - 1];
		if (p <= t1) return mixLight(LIGHT[h0], LIGHT[h1], smooth((p - t0) / (t1 - t0 || 1)));
	}
	return LIGHT.day;
}

/** Light of the hour over the map (under the markers), and lanterns at the given points after dark. */
export class Sky {
	private mul = new Sprite(Texture.WHITE);
	private glow = new Sprite(Texture.WHITE);
	private lamps = new Container();
	private mode: TimeOfDay = 'day';
	private cycleSeconds = 1800;
	constructor(
		private ctx: Ctx,
		parent: Container
	) {
		this.mul.blendMode = 'multiply';
		this.glow.blendMode = 'add';
		this.lamps.blendMode = 'add';
		parent.addChild(this.mul, this.glow, this.lamps);
	}
	set(mode: TimeOfDay, w: number, h: number, cycleMinutes: number) {
		this.mode = mode;
		this.cycleSeconds = Math.max(60, cycleMinutes * 60);
		for (const s of [this.mul, this.glow]) {
			s.width = w;
			s.height = h;
		}
	}
	/** Lantern light at outposts and battles (world coordinates). */
	setLights(points: Pt[]) {
		this.lamps.removeChildren().forEach((c) => c.destroy());
		for (const p of points) {
			const s = new Sprite(this.ctx.tex.blob);
			s.anchor.set(0.5);
			s.position.set(p.x, p.y);
			s.width = s.height = 210;
			s.tint = 0xffa43a;
			this.lamps.addChild(s);
		}
	}
	update(t: number) {
		const l = this.mode === 'cycle' ? lightAt(this.ctx.now() / this.cycleSeconds) : LIGHT[this.mode];
		this.mul.tint = l.mul;
		this.mul.visible = l.mul !== 0xffffff;
		this.glow.tint = l.glow;
		this.glow.alpha = l.glowA;
		this.glow.visible = l.glowA > 0.005;
		this.lamps.visible = l.lamps > 0.02;
		this.lamps.children.forEach((s, i) => (s.alpha = l.lamps * (0.42 + 0.06 * Math.sin(t * 7 + i * 2.3) + 0.04 * Math.sin(t * 13 + i))));
	}
	destroy() {
		this.mul.destroy();
		this.glow.destroy();
		this.lamps.destroy({ children: true });
	}
}

// ---------------------------------------------------------------- clouds

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D) => void) {
	const c = document.createElement('canvas');
	c.width = c.height = size;
	draw(c.getContext('2d')!);
	return Texture.from(c);
}

let textures: { puffs: Texture[]; ring: Texture } | null = null;
/** Soft, lumpy cloud puffs (seeded, so every screen draws the same ones) and a splash ring. */
function cloudTextures() {
	if (textures) return textures;
	const puff = (seed: number) =>
		canvasTexture(256, (g) => {
			const r = rng(seed);
			for (let i = 0; i < 26; i++) {
				const a = r() * Math.PI * 2;
				const d = Math.sqrt(r()) * 70;
				const x = 128 + Math.cos(a) * d;
				const y = 128 + Math.sin(a) * d;
				const rad = 30 + r() * 46;
				const grd = g.createRadialGradient(x, y, 0, x, y, rad);
				grd.addColorStop(0, `rgba(255,255,255,${0.32 + r() * 0.2})`);
				grd.addColorStop(1, 'rgba(255,255,255,0)');
				g.fillStyle = grd;
				g.fillRect(0, 0, 256, 256);
			}
		});
	textures = {
		puffs: [puff(7), puff(19), puff(41)],
		ring: canvasTexture(64, (g) => {
			g.strokeStyle = 'rgba(255,255,255,0.9)';
			g.lineWidth = 3;
			g.beginPath();
			g.ellipse(32, 32, 28, 18, 0, 0, Math.PI * 2);
			g.stroke();
		})
	};
	return textures;
}

export type CloudKind = 'rain' | 'storm' | 'bloodRain';

interface Drop extends Particle {
	vx: number;
	vy: number;
	age: number;
	life: number;
	splash: boolean;
}

interface Cell {
	kind: 'pass' | 'rain' | 'storm';
	birth: number;
	/** Seconds to cross the map. */
	span: number;
	start: Pt;
	/** Travel per second. */
	v: Pt;
	R: number;
	/** Fraction of its crossing during which it rains. */
	rainFrom: number;
	rainTo: number;
	strikes: { at: number; dx: number; dy: number }[];
	c: Container;
	shadow: Container;
	puffs: { s: Sprite; sh: Sprite; x: number; y: number; phase: number }[];
	drops: Drop[];
	pos: Pt;
	amount: number;
}

const MARGIN = 520;
const SEEDS: Record<CloudKind, number> = { rain: 0x5a17, storm: 0x7e0c, bloodRain: 0x2b1d };

/** Cloud cells drifting across the map on the wind, each seeded from its slot on the server's clock. */
export class Clouds implements Effect {
	private cells = new Map<number, Cell>();
	private rain = new ParticleContainer({ dynamicProperties: { position: true, rotation: true, color: true, vertex: true } });
	private splash = new ParticleContainer({ dynamicProperties: { position: true, color: true, vertex: true } });
	private cloudLayer = new Container();
	private shadowLayer = new Container();
	private strikes: Strike[] = [];
	private i = 1;
	private size = 1;
	private lastNow = 0;
	private tex = cloudTextures();
	constructor(
		private ctx: Ctx,
		private kind: CloudKind,
		private front: Container,
		back: Container,
		private world: { w: number; h: number },
		private screen: Container,
		intensity: number
	) {
		front.addChild(this.splash, this.rain);
		back.addChild(this.shadowLayer, this.cloudLayer);
		this.lastNow = ctx.now();
		this.setIntensity(intensity);
	}
	setIntensity(i: number) {
		this.i = Math.max(0.05, i);
	}
	setSize(k: number) {
		this.size = k;
	}
	/** Seconds between cells: sparse drizzle to a sky full of weather. */
	private period() {
		const base = this.kind === 'storm' ? 34 : 26;
		return base - (base - 7) * this.i;
	}
	private speed() {
		return 16 + 38 * Math.min(1, Math.abs(this.ctx.wind()));
	}
	/** Where and when cell `k` crosses, and what it does: cheap, and the same on every screen. */
	private plan(k: number, P: number) {
		const r = rng(SEEDS[this.kind] ^ Math.imul(k, 2654435761));
		const { w, h } = this.world;
		const birth = k * P + r() * P * 0.6;
		const east = this.ctx.wind() >= 0;
		const speed = this.speed() * (0.8 + r() * 0.4);
		const tilt = (r() - 0.5) * 0.5;
		const v = { x: (east ? 1 : -1) * speed * Math.cos(tilt), y: speed * Math.sin(tilt) };
		const span = (w + MARGIN * 2) / Math.abs(v.x);
		const start = { x: east ? -MARGIN : w + MARGIN, y: h * (-0.05 + r() * 1.1) - v.y * span * 0.5 };
		const roll = r();
		const kind: Cell['kind'] =
			this.kind === 'storm' ? (roll < 0.25 ? 'pass' : 'storm') : this.kind === 'bloodRain' ? 'rain' : roll < 0.3 + 0.55 * this.i ? 'rain' : 'pass';
		const R = (kind === 'storm' ? 230 : 150) + r() * 170;
		const rainFrom = 0.12 + r() * 0.35;
		const rainTo = Math.min(0.92, rainFrom + 0.25 + r() * 0.4);
		const strikes: Cell['strikes'] = [];
		if (kind === 'storm') {
			for (let at = birth + span * rainFrom + 2 + r() * 4; at < birth + span * rainTo; at += (5 + r() * 9) / (0.5 + this.i))
				strikes.push({ at, dx: (r() - 0.5) * R * 1.1, dy: (r() - 0.5) * R * 0.7 });
		}
		return { k, kind, birth, span, start, v, R, rainFrom, rainTo, strikes };
	}
	private build(pl: ReturnType<Clouds['plan']>): Cell {
		const r = rng(SEEDS[this.kind] ^ Math.imul(pl.k, 40503) ^ 0x51ed);
		const c = new Container();
		const shadow = new Container();
		const tint = pl.kind === 'storm' ? 0x767c88 : pl.kind === 'rain' ? (this.kind === 'bloodRain' ? 0x9a6a66 : 0xcfd5dc) : 0xf6f4ee;
		const n = 5 + Math.floor(r() * 5);
		const puffs: Cell['puffs'] = [];
		for (let j = 0; j < n; j++) {
			const tex = this.tex.puffs[Math.floor(r() * this.tex.puffs.length)];
			const s = new Sprite(tex);
			const sh = new Sprite(tex);
			const dia = pl.R * (0.75 + r() * 0.7);
			const rot = r() * Math.PI * 2;
			for (const x of [s, sh]) {
				x.anchor.set(0.5);
				x.width = x.height = dia;
				x.rotation = rot;
			}
			s.tint = tint;
			sh.tint = 0x0e1018;
			c.addChild(s);
			shadow.addChild(sh);
			puffs.push({ s, sh, x: (r() - 0.5) * pl.R * 1.3, y: (r() - 0.5) * pl.R * 0.75, phase: r() * 10 });
		}
		this.cloudLayer.addChild(c);
		this.shadowLayer.addChild(shadow);
		return { ...pl, c, shadow, puffs, drops: [], pos: { ...pl.start }, amount: 0 };
	}
	private drop(cell: Cell, d: Drop, initial: boolean) {
		// Rain lands where the cloud's shadow falls: a little behind and below the cloud.
		const a = Math.random() * Math.PI * 2;
		const q = Math.sqrt(Math.random()) * cell.R * this.size * 0.7;
		d.x = cell.pos.x + cell.R * 0.12 + Math.cos(a) * q;
		d.y = cell.pos.y + cell.R * 0.3 + Math.sin(a) * q * 0.65;
		d.vy = 480 + Math.random() * 180;
		d.vx = this.ctx.wind() * 160 + cell.v.x;
		d.life = 0.22 + Math.random() * 0.2;
		d.age = initial ? Math.random() * d.life : 0;
		d.y -= d.vy * d.life;
		d.splash = false;
	}
	update(dt: number, t: number) {
		const now = this.ctx.now();
		const P = this.period();
		const span = (this.world.w + MARGIN * 2) / (this.speed() * 0.7);
		const alive = new Set<number>();
		for (let k = Math.floor((now - span) / P) - 1; k <= Math.floor(now / P); k++) {
			let cell = this.cells.get(k);
			if (!cell) {
				const pl = this.plan(k, P);
				if (now < pl.birth || now > pl.birth + pl.span) continue;
				cell = this.build(pl);
				this.cells.set(k, cell);
			}
			const a = now - cell.birth;
			if (a < 0 || a > cell.span) continue;
			alive.add(k);
			this.step(cell, a, dt, t, now);
		}
		for (const [k, cell] of this.cells) if (!alive.has(k)) this.remove(k, cell);
		this.stepRipples(dt);
		// The console's opacity for this layer reaches the clouds too (they live outside its holder).
		this.cloudLayer.alpha = this.shadowLayer.alpha = this.front.alpha;
		this.strikes.forEach((s) => s.update(dt));
		this.strikes = this.strikes.filter((s) => (s.done() ? (s.destroy(), false) : true));
		this.lastNow = now;
	}
	private step(cell: Cell, a: number, dt: number, t: number, now: number) {
		const f = a / cell.span;
		cell.pos = { x: cell.start.x + cell.v.x * a, y: cell.start.y + cell.v.y * a };
		const fade = Math.min(1, a / 10, (cell.span - a) / 10);
		cell.c.position.set(cell.pos.x, cell.pos.y);
		cell.c.scale.set(this.size);
		cell.shadow.position.set(cell.pos.x + cell.R * 0.25 * this.size, cell.pos.y + cell.R * 0.55 * this.size);
		cell.shadow.scale.set(this.size);
		cell.c.visible = cell.shadow.visible = fade > 0;
		const baseC = cell.kind === 'storm' ? 0.62 : cell.kind === 'rain' ? 0.5 : 0.38;
		const baseS = cell.kind === 'storm' ? 0.26 : cell.kind === 'rain' ? 0.18 : 0.12;
		cell.c.alpha = baseC * fade;
		cell.shadow.alpha = baseS * fade;
		// Puffs billow slowly.
		for (const p of cell.puffs) {
			const x = p.x + Math.sin(t * 0.13 + p.phase) * cell.R * 0.06;
			const y = p.y + Math.cos(t * 0.11 + p.phase) * cell.R * 0.04;
			p.s.position.set(x, y);
			p.sh.position.set(x, y);
			p.s.rotation += dt * 0.01;
			p.sh.rotation = p.s.rotation;
		}
		// Rain: builds up, falls, clears.
		const ramp = 0.05;
		cell.amount = cell.kind === 'pass' ? 0 : Math.max(0, Math.min(1, (f - cell.rainFrom) / ramp, (cell.rainTo - f) / ramp)) * fade;
		const want = Math.round(cell.amount * (cell.kind === 'storm' ? 190 : 120) * (cell.R / 260) * this.size * this.ctx.q * (0.5 + 0.5 * this.i));
		while (cell.drops.length < want) {
			const d = new Particle({ texture: this.ctx.tex.streak, anchorX: 0.5, anchorY: 0.5 }) as Drop;
			d.tint = this.kind === 'bloodRain' ? 0x8e1010 : 0xc8d2de;
			d.scaleX = 0.32;
			d.scaleY = 0.42 + Math.random() * 0.3;
			this.drop(cell, d, true);
			cell.drops.push(d);
			this.rain.addParticle(d);
		}
		while (cell.drops.length > want) this.rain.removeParticle(cell.drops.pop()!);
		for (const d of cell.drops) {
			d.age += dt;
			d.x += d.vx * dt;
			d.y += d.vy * dt;
			d.rotation = Math.atan2(d.vy, d.vx) - Math.PI / 2;
			// Only over the map itself.
			const onMap = d.x > 0 && d.y > 0 && d.x < this.world.w && d.y < this.world.h;
			d.alpha = onMap ? (this.kind === 'bloodRain' ? 0.6 : 0.4) * Math.min(1, d.age / 0.06) : 0;
			if (d.age >= d.life) {
				if (onMap && Math.random() < 0.35) this.ripple(d.x, d.y);
				this.drop(cell, d, false);
			}
		}
		// Thunderheads strike where they are, at the same moment on every screen.
		for (const s of cell.strikes) {
			if (s.at > this.lastNow && s.at <= now && this.ctx.q > 0) {
				const at = { x: cell.pos.x + s.dx * this.size, y: cell.pos.y + cell.R * 0.3 + s.dy * this.size };
				this.strikes.push(new Strike(this.ctx, { type: 'zone', id: '', x: at.x, y: at.y }, this.rain.parent!, this.screen, rng(Math.round(s.at * 1000)), 0xdfe8ff, at));
			}
		}
	}
	private ripples: (Particle & { age: number })[] = [];
	private ripple(x: number, y: number) {
		if (this.ripples.length > 260 * this.ctx.q) return;
		const p = new Particle({ texture: this.tex.ring, anchorX: 0.5, anchorY: 0.5, x, y }) as Particle & { age: number };
		p.tint = this.kind === 'bloodRain' ? 0x9e1a1a : 0xdfe6ee;
		p.age = 0;
		this.ripples.push(p);
		this.splash.addParticle(p);
	}
	private remove(k: number, cell: Cell) {
		for (const d of cell.drops) this.rain.removeParticle(d);
		cell.c.destroy({ children: true });
		cell.shadow.destroy({ children: true });
		this.cells.delete(k);
	}
	/** Splash rings grow and fade. */
	private stepRipples(dt: number) {
		for (const p of this.ripples) {
			p.age += dt;
			const k = p.age / 0.4;
			p.scaleX = p.scaleY = 0.08 + k * 0.32;
			p.alpha = 0.45 * (1 - k);
		}
		const dead = this.ripples.filter((p) => p.age >= 0.4);
		if (dead.length) {
			this.ripples = this.ripples.filter((p) => p.age < 0.4);
			for (const p of dead) this.splash.removeParticle(p);
		}
	}
	destroy() {
		for (const [k, cell] of this.cells) this.remove(k, cell);
		this.strikes.forEach((s) => s.destroy());
		this.rain.destroy();
		this.splash.destroy();
		this.cloudLayer.destroy({ children: true });
		this.shadowLayer.destroy({ children: true });
	}
}

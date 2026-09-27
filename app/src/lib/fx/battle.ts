import { Container, Graphics, Sprite } from 'pixi.js';
import { createTimeline, type Timeline } from 'animejs';
import { FrameSprite, rng, type Ctx, type Effect, type Pt } from './engine';
import type { BattleResultEvent } from './types';
import { factionColours } from '$lib/seals';
import { TIER_SCALE, hexNum, mix, monumentFrame } from '$lib/monuments';

/** Where each side stands on a battlefield: out to either side of the zone, clear of the two warbands'
 * markers (which stand on its centre while they fight). */
const SIDE_OFFSET = 110;
const sides = (at: Pt) => ({ aggressor: { x: at.x - SIDE_OFFSET, y: at.y + 20 }, defender: { x: at.x + SIDE_OFFSET, y: at.y + 8 } });
/** The winner plants the monument on their own side of the field (a draw's cairn goes between). */
const monumentAt = (at: Pt, side: Pt | null) => (side ? { x: side.x + (side.x < at.x ? -20 : 20), y: side.y + 40 } : { x: at.x - 112, y: at.y + 60 });
const near = (p: Pt, r: () => number, rx: number, ry: number) => ({ x: p.x + (r() - 0.5) * 2 * rx, y: p.y + (r() - 0.5) * 2 * ry });

/** Run a set of child effects, dropping each when it reports done. */
class Group {
	live: Effect[] = [];
	add(...e: (Effect | null | undefined)[]) {
		for (const x of e) if (x) this.live.push(x);
	}
	update(dt: number, t: number) {
		for (const e of this.live) e.update(dt, t);
		this.live = this.live.filter((e) => (e.done?.() ? (e.destroy(), false) : true));
	}
	destroy() {
		for (const e of this.live) e.destroy();
		this.live = [];
	}
}

/**
 * A shell coming in: it drops out of the sky on a short arc with a thin grey trail, then lands in a
 * white-hot flash, throws up a plume of earth, rings the ground with a shockwave, and leaves dust, a
 * rising column of smoke and a scorched crater that fades slowly.
 */
export class Shell implements Effect {
	private age = 0;
	private shell = new Graphics().circle(0, 0, 3.5).fill({ color: 0x17110b });
	private trail = new Graphics();
	private path: Pt[] = [];
	private from: Pt;
	private landed = false;
	private kids = new Group();
	private glow?: Sprite;
	private wave?: Graphics;
	private crater?: Graphics;
	private plume?: Sprite;
	private readonly FLIGHT = 0.55;

	constructor(
		private ctx: Ctx,
		private parent: Container,
		private at: Pt,
		private k: number,
		private delay: number,
		r: () => number
	) {
		// In from high on one side, as artillery firing from behind the lines.
		const side = r() < 0.5 ? -1 : 1;
		this.from = { x: at.x + side * (180 + r() * 140) * k, y: at.y - (380 + r() * 120) * k };
		this.shell.visible = false;
		parent.addChild(this.trail, this.shell);
	}
	setIntensity() {}
	update(dt: number, t: number) {
		this.age += dt;
		const f = (this.age - this.delay) / this.FLIGHT;
		if (f < 0) return;
		if (f < 1) {
			// A falling arc: across quickly, down faster (gravity), so it plunges at the end.
			const p = { x: this.from.x + (this.at.x - this.from.x) * f, y: this.from.y + (this.at.y - this.from.y) * f * f };
			this.shell.visible = true;
			this.shell.position.set(p.x, p.y);
			this.path.push(p);
			if (this.path.length > 9) this.path.shift();
			this.trail.clear();
			this.path.forEach((q, i) => (i ? this.trail.lineTo(q.x, q.y) : this.trail.moveTo(q.x, q.y)));
			this.trail.stroke({ width: 2.5 * this.k, color: 0xb9b1a2, alpha: 0.55, cap: 'round' });
			return;
		}
		if (!this.landed) this.impact();
		const since = this.age - this.delay - this.FLIGHT;
		this.trail.alpha = Math.max(0, 1 - since / 0.4);
		if (this.glow) {
			const g = since < 0.07 ? since / 0.07 : Math.max(0, 1 - (since - 0.07) / 0.3);
			this.glow.alpha = g;
			this.glow.scale.set((0.35 + 0.45 * Math.min(1, since / 0.07)) * this.k);
		}
		if (this.wave) {
			const w = Math.min(1, since / 0.5);
			const ease = 1 - Math.pow(1 - w, 3);
			this.wave.scale.set(0.15 + ease * 1.2);
			this.wave.alpha = 0.7 * (1 - w);
		}
		if (this.plume) {
			const frames = this.ctx.sheets.blast!;
			const i = Math.floor(since * 18);
			this.plume.texture = frames[Math.min(frames.length - 1, i)];
			// Hold the last frame a moment, then let the earth settle into the dust.
			const over = since - frames.length / 18;
			this.plume.alpha = over > 0 ? Math.max(0, 1 - over / 0.6) : 1;
		}
		if (this.crater) this.crater.alpha = 0.5 * Math.max(0, 1 - Math.max(0, since - 2) / 6);
		this.kids.update(dt, t);
	}
	private impact() {
		this.landed = true;
		this.shell.visible = false;
		const { ctx, parent, at, k } = this;
		const { blast, smoke } = ctx.sheets;
		// The scorched crater, under everything else.
		this.crater = new Graphics().ellipse(0, 0, 30 * k, 12 * k).fill({ color: 0x1a120b });
		this.crater.position.set(at.x, at.y);
		parent.addChildAt(this.crater, 0);
		// The ground shockwave.
		this.wave = new Graphics().ellipse(0, 0, 90 * k, 34 * k).stroke({ width: 3, color: 0xefe3c8 });
		this.wave.position.set(at.x, at.y);
		parent.addChild(this.wave);
		// Dust thrown out low, and the smoke column that climbs and leans with the wind.
		if (smoke) {
			const wind = ctx.wind() || 0.15;
			this.kids.add(
				new FrameSprite(smoke, parent, { x: at.x, y: at.y - 8 * k }, { scale: 0.9 * k, anchorY: 0.6, fps: 11, tint: 0x7a6650, alpha: 0.85, delay: 0.05, drift: { x: wind * 20, y: -4 } }),
				new FrameSprite(smoke, parent, { x: at.x, y: at.y - 40 * k }, { scale: 1.15 * k, fps: 7, tint: 0x3b332c, alpha: 0.75, delay: 0.45, drift: { x: wind * 30, y: -22 } })
			);
		}
		if (blast) {
			this.plume = new Sprite(blast[0]);
			this.plume.anchor.set(0.5, 0.8);
			this.plume.scale.set(0.95 * k);
			this.plume.position.set(at.x, at.y);
			parent.addChild(this.plume);
		}
		// The flash: brief, white-hot, lighting the ground round it.
		this.glow = new Sprite(ctx.tex.blob);
		this.glow.anchor.set(0.5);
		this.glow.tint = 0xffd29a;
		this.glow.blendMode = 'add';
		this.glow.position.set(at.x, at.y - 10 * k);
		parent.addChild(this.glow);
		ctx.shake(0.3, 2 + 3 * k);
	}
	done = () => this.landed && this.age - this.delay - this.FLIGHT > 8 && !this.kids.live.length;
	destroy() {
		this.kids.destroy();
		for (const d of [this.shell, this.trail, this.glow, this.wave, this.crater, this.plume]) d?.destroy();
	}
}

/**
 * Small-arms fire from one side at the other: a machine-gun burst (a quick run of pinpoint flashes, then
 * dirt kicked up where the rounds land) or a rifle volley along a firing line. Powder smoke hangs after.
 */
export class Burst implements Effect {
	private kids = new Group();
	private age = 0;
	constructor(ctx: Ctx, parent: Container, from: Pt, to: Pt, kind: 'mg' | 'rifles', r: () => number, delay = 0) {
		const { flash, spurt, smoke } = ctx.sheets;
		const rounds = kind === 'mg' ? 5 + Math.floor(r() * 5) : 3 + Math.floor(r() * 3);
		const gun = near(from, r, 26, 18);
		const aim = near(to, r, 30, 20);
		for (let i = 0; i < rounds; i++) {
			const at = kind === 'mg' ? gun : { x: gun.x + (i - rounds / 2) * 14, y: gun.y + (r() - 0.5) * 10 };
			const when = delay + (kind === 'mg' ? i * 0.075 : i * 0.11 + r() * 0.08);
			if (flash) this.kids.add(new FrameSprite(flash, parent, at, { scale: kind === 'mg' ? 0.13 : 0.17, fps: 32, delay: when, rotation: r() * Math.PI }));
			// Rounds land a beat later, walking a little across the target.
			const hit = { x: aim.x + (kind === 'mg' ? (i - rounds / 2) * 7 : (r() - 0.5) * 50), y: aim.y + (r() - 0.5) * 14 };
			if (spurt) this.kids.add(new FrameSprite(spurt, parent, hit, { scale: 0.75, anchorY: 0.8, fps: 20, delay: when + 0.16 }));
		}
		if (smoke && ctx.q > 0)
			this.kids.add(
				new FrameSprite(smoke, parent, { x: gun.x, y: gun.y - 6 }, { scale: 0.32, fps: 8, tint: 0xd8d0c0, alpha: 0.55, delay: delay + 0.1, drift: { x: ctx.wind() * 25 + 6, y: -6 } })
			);
	}
	setIntensity() {}
	update(dt: number, t: number) {
		this.age += dt;
		this.kids.update(dt, t);
	}
	done = () => this.age > 0.3 && !this.kids.live.length;
	destroy() {
		this.kids.destroy();
	}
}

/**
 * A battle being fought: bursts of small-arms fire traded between the two sides and shells landing among
 * them, the dust and smoke drifting over. Quiet while the viewer looks at the whole map; full when they
 * have entered it.
 */
export class BattleField implements Effect {
	private kids = new Group();
	private nextFire = 0.4;
	private nextShell = 1.2;
	private i = 0.35;
	private at: Pt;
	constructor(
		private ctx: Ctx,
		scope: { x: number; y: number },
		private parent: Container,
		intensity: number
	) {
		this.at = { x: scope.x, y: scope.y };
		this.setIntensity(intensity);
	}
	setIntensity(i: number) {
		this.i = i;
	}
	update(dt: number, t: number) {
		const s = sides(this.at);
		const r = Math.random;
		this.nextFire -= dt;
		if (this.nextFire <= 0) {
			this.nextFire = (1.9 - 1.2 * this.i) * (0.5 + r());
			const fromAgg = r() < 0.5;
			this.kids.add(new Burst(this.ctx, this.parent, fromAgg ? s.aggressor : s.defender, fromAgg ? s.defender : s.aggressor, r() < 0.6 ? 'mg' : 'rifles', r));
		}
		this.nextShell -= dt;
		if (this.nextShell <= 0) {
			this.nextShell = (7 - 4.5 * this.i) * (0.6 + r() * 0.8);
			// Shells fall on one side's ground, rarely on the centre.
			const target = r() < 0.5 ? s.aggressor : s.defender;
			this.kids.add(new Shell(this.ctx, this.parent, near(target, r, 60, 34), 0.55 + 0.35 * this.i, 0, r));
		}
		this.kids.update(dt, t);
	}
	destroy() {
		this.kids.destroy();
	}
}

/**
 * A battle's result, played once on every screen: a climax as big as the win, the fallen dropping
 * where their side stood, then the winner's monument rising out of the mud with the loser's broken
 * standard hung on it. Everything fades once it has stood a while; the map's own monument layer
 * (which draws it for good) appears as this one goes.
 */
export class BattleResult implements Effect {
	private c = new Container();
	private under = new Container();
	private live: Effect[] = [];
	private tl: Timeline;
	/** The map's own monument may show (the fade has begun). */
	private revealed = false;
	private complete = false;

	constructor(
		private ctx: Ctx,
		back: Container,
		front: Container,
		at: Pt,
		ev: BattleResultEvent,
		seed: number,
		extra: (kind: 'lightning' | 'crows' | 'fire' | 'quake') => void,
		private onDone?: () => void
	) {
		back.addChild(this.under);
		front.addChild(this.c);
		const r = rng(seed);
		const o = ev.outcome;
		const { smoke, corpses, monuments, trophy } = ctx.sheets;
		const s = sides(at);
		const winnerSide = o.winner === ev.aggressor.id ? 'aggressor' : 'defender';
		const loserSide = winnerSide === 'aggressor' ? 'defender' : 'aggressor';
		const winner = ev[winnerSide];
		const loser = ev[loserSide];

		this.tl = createTimeline({ autoplay: true, onComplete: () => ((this.complete = true), this.reveal()) });

		// 1. The climax, as big as the win: a barrage walks onto the loser's ground while the winner's guns open up.
		this.tl.call(() => {
			const shells = o.tier === 1 ? 2 : o.tier === 2 ? 4 : 7;
			for (let k = 0; k < shells; k++) this.live.push(new Shell(ctx, this.c, near(s[loserSide], r, 70, 38), 0.8 + o.tier * 0.12, k * 0.28, r));
			for (let k = 0; k < 2 + o.tier; k++) this.live.push(new Burst(ctx, this.c, s[winnerSide], s[loserSide], k % 2 ? 'rifles' : 'mg', r, k * 0.35));
			if (o.tier === 3) extra('crows');
		}, 0);

		// 2. The fallen drop where their side stood (the loser's first).
		if (corpses) {
			const bodies: { side: 'aggressor' | 'defender'; n: number }[] = [
				{ side: loserSide, n: loserSide === 'aggressor' ? o.fallen.aggressor : o.fallen.defender },
				{ side: winnerSide, n: winnerSide === 'aggressor' ? o.fallen.aggressor : o.fallen.defender }
			];
			let shown = 0;
			for (const b of bodies) {
				const tint = mix(0xffffff, hexNum(factionColours(ev[b.side].faction).low), 0.18);
				for (let k = 0; k < b.n && shown < o.corpses; k++, shown++) {
					const p = near(s[b.side], r, 60, 40);
					const body = new Sprite(corpses[Math.floor(r() * corpses.length)]);
					body.anchor.set(0.5, 0.6);
					body.scale.set(0.42 * (r() < 0.5 ? -1 : 1), 0.42);
					body.tint = tint;
					body.position.set(p.x, p.y - 22);
					body.alpha = 0;
					body.rotation = (r() - 0.5) * 0.6;
					this.under.addChild(body);
					this.tl.add(body, { y: p.y, alpha: 1, rotation: body.rotation * 0.3, duration: 420, ease: 'outBounce' }, 900 + shown * 70);
				}
			}
		}

		// 3. The monument rises out of the mud (a draw leaves a cairn), shaking the ground as it comes.
		if (monuments) {
			const k = TIER_SCALE[o.tier] * 0.7;
			const stand = new Container();
			const base = monumentAt(at, o.draw ? null : s[winnerSide]);
			stand.position.set(base.x, base.y);
			const mon = new Sprite(monuments[monumentFrame(o.draw ? null : winner.faction)]);
			mon.anchor.set(0.5, 0.86);
			mon.scale.set(k);
			const depth = mon.height;
			// Only what has risen above the ground line shows.
			const mask = new Graphics().rect(-mon.width, -depth * 1.4, mon.width * 2, depth * 1.4 + 26 * k).fill({ color: 0xffffff });
			mon.mask = mask;
			mon.y = depth;
			stand.addChild(mask, mon);
			if (o.tier === 3) {
				const glow = new Graphics().ellipse(0, 0, 90 * k, 34 * k).fill({ color: hexNum(factionColours(winner.faction).low), alpha: 0.55 });
				glow.blendMode = 'add';
				glow.alpha = 0;
				stand.addChildAt(glow, 0);
				this.tl.add(glow, { alpha: [0, 0.6, 0.25], duration: 1800, ease: 'inOutSine' }, 2400);
			}
			this.c.addChild(stand);
			this.tl.call(() => {
				ctx.shake(1.3, 3 + o.tier * 2);
				if (smoke)
					for (let d = 0; d < 3; d++)
						this.live.push(new FrameSprite(smoke, this.c, { x: base.x + (d - 1) * 40 * k, y: base.y - 4 }, { scale: 0.7 * k, fps: 9, tint: 0x8a6a45, alpha: 0.8, delay: d * 0.15, drift: { x: (d - 1) * 14, y: -8 } }));
			}, 2000);
			this.tl.add(mon, { y: 0, duration: 1400, ease: 'outQuad' }, 2000);

			// 4. The loser's broken standard, dyed in their colours, drops onto it.
			if (!o.draw && trophy && trophy.length >= 2) {
				const flag = new Container();
				const pole = new Sprite(trophy[0]);
				const cloth = new Sprite(trophy[1]);
				for (const sp of [pole, cloth]) {
					sp.anchor.set(0.5, 0.9);
					flag.addChild(sp);
				}
				cloth.tint = hexNum(factionColours(loser.faction).low);
				flag.scale.set(0.5 * k);
				flag.position.set(34 * k, -12 * k);
				flag.rotation = 0.35;
				flag.alpha = 0;
				stand.addChild(flag);
				this.tl.add(flag, { y: [-80 * k, -12 * k], alpha: [0, 1], rotation: [0.9, 0.3], duration: 700, ease: 'outBounce' }, 3500);
			}
		}

		// 5. It stands a while, then gives way to the map's own monument.
		this.tl.call(() => this.reveal(), 9000);
		this.tl.add(this.c, { alpha: [1, 0], duration: 900, ease: 'inQuad' }, 9000);
		this.tl.add(this.under, { alpha: [1, 0], duration: 900, ease: 'inQuad' }, 9000);
	}
	setIntensity() {}
	update(dt: number, t: number) {
		for (const e of this.live) e.update(dt, t);
		this.live = this.live.filter((e) => (e.done?.() ? (e.destroy(), false) : true));
	}
	private reveal() {
		if (this.revealed) return;
		this.revealed = true;
		this.onDone?.();
	}
	done = () => this.complete && !this.live.length;
	destroy() {
		this.tl.pause();
		this.reveal();
		for (const e of this.live) e.destroy();
		this.c.destroy({ children: true });
		this.under.destroy({ children: true });
	}
}

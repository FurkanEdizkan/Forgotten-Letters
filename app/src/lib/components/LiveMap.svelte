<script lang="ts">
	import { onMount } from 'svelte';
	import type { Container, Graphics, Spritesheet, Texture } from 'pixi.js';
	import { buildGraph } from '$lib/rules/zones';
	import type { Zone } from '$lib/rules/types';
	import type { PublicSnapshot, PublicWarband } from '$lib/snapshot';
	import type { FxTrigger } from '$lib/fx/types';
	import { deviceQuality, wantedEffects } from '$lib/fx/wanted';
	import { outpostFrame } from '$lib/models';
	import { hexToNumber, sigilFor } from '$lib/sigils';
	import { SEAL_FRAME, SEAL_FRAMES, SEAL_PERIOD, factionColours, type SealLook } from '$lib/seals';
	import { CAIRN_FRAME, TIER_SCALE, hexNum, monumentFrame } from '$lib/monuments';
	import type { Monument } from '$lib/snapshot';

	let {
		snapshot,
		selected = null,
		onzone,
		onwarband,
		fxEnabled = true,
		subscribeTriggers,
		focus = null,
		project = $bindable()
	}: {
		snapshot: PublicSnapshot;
		selected?: string | null;
		onzone?: (id: string) => void;
		onwarband?: (id: string) => void;
		/** Viewer's own switch for weather effects. */
		fxEnabled?: boolean;
		/** Live one-shot effects (lightning, crows…). */
		subscribeTriggers?: (fn: (t: FxTrigger) => void) => () => void;
		/** A battle's zone the viewer has entered: the camera flies in and its field burns at full intensity. */
		focus?: string | null;
		/** Set by the map: a zone's position on screen (relative to the map), for DOM overlays. */
		project?: (zoneId: string) => { x: number; y: number } | null;
	} = $props();

	const MAP_URL = '/map/carcass-map.webp';
	const W = 2398;
	const H = 1604;
	const RES_COLORS = { F: 0xc8741e, R: 0x9b2a1c, S: 0x5f7f2a, T: 0x2f6770 } as const;

	let host: HTMLDivElement;
	let redraw: (() => void) | null = null;
	let refx: (() => void) | null = null;
	let fly: ((zoneId: string | null) => void) | null = null;

	// Re-draw dynamic layers whenever the snapshot or selection changes.
	$effect(() => {
		void snapshot;
		void selected;
		redraw?.();
	});
	$effect(() => {
		void snapshot;
		void fxEnabled;
		void focus;
		refx?.();
	});
	$effect(() => {
		fly?.(focus);
	});

	onMount(() => {
		let destroyed = false;
		let cleanup = () => {};

		(async () => {
			const PIXI = await import('pixi.js');
			const { Viewport } = await import('pixi-viewport');
			await document.fonts?.ready;
			if (destroyed) return;

			const app = new PIXI.Application();
			await app.init({
				resizeTo: host,
				antialias: true,
				backgroundColor: 0x231a12,
				resolution: Math.min(window.devicePixelRatio || 1, 1.5),
				autoDensity: true
			});
			if (destroyed) {
				app.destroy(true);
				return;
			}
			host.appendChild(app.canvas);

			const viewport = new Viewport({
				screenWidth: host.clientWidth,
				screenHeight: host.clientHeight,
				worldWidth: W,
				worldHeight: H,
				events: app.renderer.events
			});
			app.stage.addChild(viewport);
			const fitScale = () => Math.min(host.clientWidth / W, host.clientHeight / H);
			viewport
				.drag()
				.pinch()
				.wheel({ smooth: 4 })
				.decelerate({ friction: 0.92 })
				.clampZoom({ minScale: fitScale() * 0.9, maxScale: 2.5 })
				.clamp({ direction: 'all', underflow: 'center' });
			// Landscape: show the whole map. Portrait (phones): fill the height and centre on the
			// battlefield; the right third of the image is the manual's text panel.
			if (host.clientHeight > host.clientWidth) {
				viewport.setZoom(host.clientHeight / H, true);
				viewport.moveCenter(W * 0.36, H / 2);
			} else {
				viewport.fit(true, W, H);
				viewport.moveCenter(W / 2, H / 2);
			}

			let dragging = false;
			viewport.on('drag-start', () => (dragging = true));
			viewport.on('drag-end', () => setTimeout(() => (dragging = false), 0));
			viewport.on('pinch-start', () => (dragging = true));
			viewport.on('pinch-end', () => setTimeout(() => (dragging = false), 0));

			const onResize = () => {
				viewport.resize(host.clientWidth, host.clientHeight, W, H);
				viewport.clampZoom({ minScale: fitScale() * 0.9, maxScale: 2.5 });
			};
			const ro = new ResizeObserver(onResize);
			ro.observe(host);

			const mapTexture = await PIXI.Assets.load<Texture>(MAP_URL);
			const map = new PIXI.Sprite(mapTexture);
			map.width = W;
			map.height = H;
			viewport.addChild(map);

			const graph = buildGraph(snapshot.campaign.houseZones);
			const world = (z: Zone) => ({ x: (z.pos?.x ?? 0.5) * W, y: (z.pos?.y ?? 0.5) * H });

			// Static: house zones are not printed on the map, so draw them like the Player's Guide.
			const house = new PIXI.Container();
			viewport.addChild(house);
			const dashed = (g: Graphics, a: { x: number; y: number }, b: { x: number; y: number }, r1: number, r2: number) => {
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const len = Math.hypot(dx, dy);
				const ux = dx / len;
				const uy = dy / len;
				for (let t = r1; t < len - r2; t += 24) {
					const e = Math.min(t + 14, len - r2);
					g.moveTo(a.x + ux * t, a.y + uy * t).lineTo(a.x + ux * e, a.y + uy * e);
				}
			};
			const links = new PIXI.Graphics();
			for (const z of graph.zones.values()) {
				if (!z.house) continue;
				for (const l of z.links) {
					const other = graph.zones.get(l);
					if (other) dashed(links, world(z), world(other), 46, other.house ? 46 : 60);
				}
			}
			links.stroke({ width: 6, color: 0x8b2a1d, cap: 'round' });
			house.addChild(links);
			for (const z of graph.zones.values()) {
				if (!z.house) continue;
				const p = world(z);
				const c = new PIXI.Container();
				c.position.set(p.x, p.y);
				const entry = z.type === 'entry';
				c.addChild(
					new PIXI.Graphics()
						.circle(0, 0, 42)
						.fill({ color: entry ? 0x231a12 : 0xf1e6cb })
						.stroke({ width: 6, color: 0x8b2a1d })
				);
				const label = entry ? z.id : String(['rudolfs-folly', 'hermits-stair', 'amoudet-seawall', 'stylite-row', 'corpse-rail-terminus', 'melessin-causeway'].indexOf(z.id) + 1);
				const num = new PIXI.Text({
					text: label,
					style: { fontFamily: 'EB Garamond', fontWeight: '700', fontSize: 50, fill: entry ? 0xf1e6cb : 0x8b2a1d }
				});
				num.anchor.set(0.5, 0.55);
				c.addChild(num);
				const name = new PIXI.Text({
					text: z.name.toUpperCase(),
					style: {
						fontFamily: 'EB Garamond',
						fontWeight: '700',
						fontSize: 22,
						fill: 0xf1e6cb,
						stroke: { color: 0x231a12, width: 6 },
						letterSpacing: 1
					}
				});
				name.anchor.set(0.5, 0);
				name.y = 48;
				c.addChild(name);
				z.resources.forEach((r, i) => {
					const chip = new PIXI.Graphics()
						.circle((i - (z.resources.length - 1) / 2) * 30, 92, 13)
						.fill({ color: RES_COLORS[r] })
						.stroke({ width: 3, color: 0x231a12 });
					c.addChild(chip);
				});
				house.addChild(c);
			}

			// Dynamic layers
			const highlight = new PIXI.Container();
			const battles = new PIXI.Container();
			const monumentLayer = new PIXI.Container();
			const outposts = new PIXI.Container();
			const markers = new PIXI.Container();
			const hits = new PIXI.Container();
			const fxBack = new PIXI.Container();
			const fxFront = new PIXI.Container();
			viewport.addChild(fxBack, highlight, battles, monumentLayer, outposts, hits, markers, fxFront);
			monumentLayer.eventMode = 'none';

			// Screen-space overlay above the map, for weather.
			const overlay = new PIXI.Container();
			overlay.eventMode = 'none';
			fxBack.eventMode = fxFront.eventMode = 'none';
			app.stage.addChild(overlay);

			// Tap targets for every zone.
			for (const z of graph.zones.values()) {
				const p = world(z);
				const hit = new PIXI.Container();
				hit.position.set(p.x, p.y);
				hit.hitArea = new PIXI.Circle(0, 0, 70);
				hit.eventMode = 'static';
				hit.cursor = 'pointer';
				hit.on('pointertap', () => !dragging && onzone?.(z.id));
				hits.addChild(hit);
			}

			const textures = new Map<string, Promise<Texture>>();
			const tex = (url: string) => {
				if (!textures.has(url)) textures.set(url, PIXI.Assets.load<Texture>(url));
				return textures.get(url)!;
			};
			// Default outpost tokens (Blender-rendered, one per faction): map content, so loaded even without effects.
			const outpostSheet = PIXI.Assets.load<Spritesheet>('/fx/outposts.json').catch(() => null);
			// Victory monuments, broken standards and the fallen: map content too.
			let battleSheets: { monuments?: Texture[]; trophy?: Texture[]; corpses?: Texture[] } = {};
			Promise.all(['monuments', 'trophy', 'corpses'].map((n) => PIXI.Assets.load<Spritesheet>(`/fx/${n}.json`).catch(() => null))).then(
				([m, t, c]) => {
					battleSheets = { monuments: m?.animations.monuments, trophy: t?.animations.trophy, corpses: c?.animations.corpses };
					redraw?.();
				}
			);
			/** Battles whose result is still playing: their monument waits for the animation to raise it. */
			const pending = new Set<string>();
			/** Same scatter on every screen for a zone. */
			const scatter = (key: string) => {
				let a = [...key].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
				return () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296);
			};

			/** A winner's monument with the loser's broken standard hung on it, at the container origin. */
			function monumentSprite(m: Monument, scale: number, tint: number) {
				const c = new PIXI.Container();
				const mon = new PIXI.Sprite(battleSheets.monuments![monumentFrame(m.winnerFaction)]);
				mon.anchor.set(0.5, 0.86);
				mon.scale.set(scale);
				mon.tint = tint;
				c.addChild(mon);
				const tr = battleSheets.trophy;
				if (m.winnerFaction && m.loserFaction && tr && tr.length >= 2) {
					const flag = new PIXI.Container();
					for (const [i, t] of [tr[0], tr[1]].entries()) {
						const sp = new PIXI.Sprite(t);
						sp.anchor.set(0.5, 0.9);
						if (i === 1) sp.tint = hexNum(factionColours(m.loserFaction).low);
						flag.addChild(sp);
					}
					flag.scale.set(scale * 0.55);
					flag.position.set(scale * 36, -scale * 14);
					flag.rotation = 0.3;
					c.addChild(flag);
				}
				return c;
			}

			/** Each zone's victories: the newest five as a cluster below the zone (older ones smaller and
			 * darker, the rest heaped into a cairn), over a field of the fallen that grows with every battle. */
			function drawMonuments(list: Monument[], k: number) {
				if (!battleSheets.monuments) return;
				const byZone = new Map<string, Monument[]>();
				for (const m of list) if (!pending.has(m.gameId)) byZone.set(m.zone, [...(byZone.get(m.zone) ?? []), m]);
				const SLOTS = [
					[0, 10],
					[-44, 0],
					[44, 0],
					[-80, -10],
					[80, -10]
				];
				for (const [zid, ms] of byZone) {
					const z = graph.zones.get(zid);
					if (!z) continue;
					// Anchored on the zone and scaled with the markers, so the offset keeps it clear of them at any zoom.
					const g = new PIXI.Container();
					g.position.set(world(z).x, world(z).y);
					const row = new PIXI.Container();
					row.position.set(-112, 44);
					g.addChild(row);
					const r = scatter(zid);
					const fallen = ms.reduce((n, m) => n + m.fallen, 0);
					if (battleSheets.corpses)
						for (let i = 0; i < Math.min(10, Math.ceil(fallen / 2)); i++) {
							const b = new PIXI.Sprite(battleSheets.corpses[Math.floor(r() * battleSheets.corpses.length)]);
							b.anchor.set(0.5);
							b.scale.set(0.3 * (r() < 0.5 ? -1 : 1), 0.3);
							b.position.set((r() - 0.5) * 150, 8 + (r() - 0.5) * 30);
							b.alpha = 0.75;
							row.addChild(b);
						}
					const shown = ms.slice(-SLOTS.length);
					const heaped = ms.length - shown.length;
					if (heaped > 0) {
						const cairn = new PIXI.Sprite(battleSheets.monuments[CAIRN_FRAME]);
						cairn.anchor.set(0.5, 0.86);
						cairn.scale.set(0.4);
						cairn.position.set(0, -22);
						cairn.tint = 0xa8a090;
						row.addChild(cairn);
						const n = new PIXI.Text({
							text: `+${heaped}`,
							style: { fontFamily: 'EB Garamond', fontWeight: '700', fontSize: 16, fill: 0xf1e6cb, stroke: { color: 0x231a12, width: 4 } }
						});
						n.anchor.set(0.5);
						n.position.set(0, -86);
						row.addChild(n);
					}
					// Oldest first, so the newest stands in front.
					const newest = [...shown].reverse();
					for (let j = newest.length - 1; j >= 0; j--) {
						const m = newest[j];
						const sp = monumentSprite(m, 0.5 * TIER_SCALE[m.tier] * (j === 0 ? 1 : 0.78), j === 0 ? 0xffffff : 0xb8b0a0);
						sp.position.set(SLOTS[j][0], SLOTS[j][1]);
						row.addChild(sp);
					}
					g.scale.set(k);
					groups.push(g);
					monumentLayer.addChild(g);
				}
			}

			/** A sprite that fills in once its texture arrives, sized to `width` and anchored at its feet. */
			function tokenSprite(parent: Container, source: Promise<Texture | null | undefined>, width: number, at = 0, y = 0) {
				source.then((t) => {
					if (!t || parent.destroyed) return;
					const s = new PIXI.Sprite(t);
					s.anchor.set(0.5, 0.85);
					s.scale.set(width / t.width);
					s.y = y;
					parent.addChildAt(s, Math.min(at, parent.children.length));
				});
			}

			/** Small round badge with an image (symbol or portrait), at (x, y). */
			function badge(url: string | null, r: number, x: number, y: number, ring = 0x231a12, faction?: string, bright = false) {
				const b = new PIXI.Container();
				b.position.set(x, y);
				b.addChild(new PIXI.Graphics().circle(0, 0, r + 2.5).fill({ color: ring }));
				b.addChild(new PIXI.Graphics().circle(0, 0, r).fill({ color: 0xefe6d0 }));
				if (url)
					tex(url).then((t) => {
						if (b.destroyed) return;
						const s = new PIXI.Sprite(t);
						s.anchor.set(0.5);
						s.width = s.height = r * 2;
						const mask = new PIXI.Graphics().circle(0, 0, r).fill({ color: 0xffffff });
						s.mask = mask;
						b.addChild(mask, s);
						if (faction) sigilLight(b, r, faction, bright);
					});
				return b;
			}

			/*
			 * Faction sigils: a band of the faction's light climbs through each symbol badge,
			 * bottom to top. One gradient texture per faction; the ticker moves the bands.
			 */
			const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
			const lightTextures = new Map<string, Texture>();
			function lightTexture(faction: string) {
				let t = lightTextures.get(faction);
				if (!t) {
					const { low, high } = sigilFor(faction);
					const cv = document.createElement('canvas');
					cv.width = 4;
					cv.height = 128;
					const g = cv.getContext('2d')!;
					const grad = g.createLinearGradient(0, 128, 0, 0);
					grad.addColorStop(0, 'rgba(0,0,0,0)');
					grad.addColorStop(0.22, low);
					grad.addColorStop(0.38, high);
					grad.addColorStop(0.54, 'rgba(0,0,0,0)');
					g.fillStyle = grad;
					g.fillRect(0, 0, 4, 128);
					t = PIXI.Texture.from(cv);
					lightTextures.set(faction, t);
				}
				return t;
			}
			const sigils: { band: Container; R: number; phase: number; period: number }[] = [];
			const studs: Container[] = [];
			/** Light the badge whose disc (radius R) sits at the container origin. */
			function sigilLight(b: Container, R: number, faction: string, bright: boolean) {
				const sg = sigilFor(faction);
				const band = new PIXI.Sprite(lightTexture(faction));
				band.anchor.set(0.5, 0);
				band.width = R * 2;
				band.height = R * 4;
				band.blendMode = 'add';
				band.alpha = bright ? 0.95 : 0.7;
				const mask = new PIXI.Graphics().circle(0, 0, R).fill({ color: 0xffffff });
				band.mask = mask;
				b.addChild(mask, band);
				const phase = Math.random();
				sigils.push({ band, R, phase, period: bright ? 2.6 : 4.2 });
				band.y = reduceMotion ? -R * 1.5 : R;
				if (sg.filigree) {
					// The Sultanate's gold: a ring of studs turning slowly about the sigil.
					const ring = new PIXI.Graphics();
					const n = 12;
					for (let i = 0; i < n; i++) {
						const a = (i / n) * Math.PI * 2;
						ring.circle(Math.cos(a) * (R + 5), Math.sin(a) * (R + 5), Math.max(1.2, R * 0.12));
					}
					ring.fill({ color: hexToNumber(sg.rim) });
					b.addChild(ring);
					studs.push(ring);
				}
			}

			/* Seals: each look is composited once (metal tint + coloured light) and cut into frames. */
			const sealFrames = new Map<string, Promise<Texture[]>>();
			function sealTextures(look: SealLook) {
				const k = [look.base, look.light, look.metal, look.low, look.high].join('|');
				if (!sealFrames.has(k))
					sealFrames.set(
						k,
						import('$lib/seal-compose')
							.then(({ sealCanvas }) => sealCanvas(look))
							.then((cv) => {
								const source = PIXI.Texture.from(cv).source;
								return Array.from({ length: SEAL_FRAMES }, (_, i) =>
									new PIXI.Texture({ source, frame: new PIXI.Rectangle(i * SEAL_FRAME, 0, SEAL_FRAME, SEAL_FRAME) })
								);
							})
					);
				return sealFrames.get(k)!;
			}
			/** The warband's seal, radius R, at the container origin; burns faster while its warband fights. */
			function sealBadge(parent: Container, look: SealLook, R: number, bright: boolean) {
				sealTextures(look).then((frames) => {
					if (parent.destroyed) return;
					const a = new PIXI.AnimatedSprite(frames);
					a.anchor.set(0.5);
					a.width = a.height = R * 2;
					a.animationSpeed = (SEAL_FRAMES / (SEAL_PERIOD * 60)) * (bright ? 1.6 : 1);
					if (reduceMotion) a.gotoAndStop(SEAL_FRAMES / 2);
					else a.gotoAndPlay(Math.floor(Math.random() * SEAL_FRAMES));
					parent.addChild(a);
				});
			}

			/** Outpost token: uploaded model, else the faction's default redoubt; supply shown by the base ring. */
			function outpostMarker(w: PublicWarband, supplied: boolean) {
				const c = new PIXI.Container();
				c.addChild(
					new PIXI.Graphics()
						.ellipse(0, 0, 24, 9)
						.fill({ color: 0x231a12, alpha: 0.35 })
						.stroke({ width: 3, color: supplied ? 0x5f7f2a : 0x231a12, alpha: supplied ? 1 : 0.6 })
				);
				tokenSprite(
					c,
					w.outpostToken
						? tex(w.outpostToken)
						: outpostSheet.then((sheet) => sheet?.textures[outpostFrame(w.faction)]),
					60,
					1
				);
				if (w.seal) {
					const b = new PIXI.Container();
					b.position.set(22, -4);
					b.addChild(new PIXI.Graphics().circle(0, 0, 11).fill({ color: supplied ? 0x5f7f2a : 0x15130e }));
					sealBadge(b, w.seal, 10, false);
					c.addChild(b);
				} else if (w.symbol) c.addChild(badge(w.symbol, 8, 22, -4, supplied ? 0x5f7f2a : hexToNumber(sigilFor(w.faction).rim), w.faction));
				return c;
			}

			/** Warband shown as its figure token standing on a coloured base, with the portrait as a badge. */
			function figureMarker(w: PublicWarband, r: number, ring: number) {
				const c = new PIXI.Container();
				c.addChild(new PIXI.Graphics().ellipse(0, r * 0.55, r * 0.95, r * 0.38).fill({ color: ring }).stroke({ width: 3, color: 0x231a12 }));
				// Feet of the token sit on the base.
				tokenSprite(c, tex(w.figureToken!), r * 2.3, 1, r * 0.55);
				c.addChild(badge(w.portrait, r * 0.36, -r * 0.8, r * 0.55, ring));
				if (w.seal) {
					const b = new PIXI.Container();
					b.position.set(r * 0.8, r * 0.55);
					sealBadge(b, w.seal, r * 0.36, w.playing);
					c.addChild(b);
				} else if (w.symbol) c.addChild(badge(w.symbol, r * 0.3, r * 0.8, r * 0.55, hexToNumber(sigilFor(w.faction).rim), w.faction, w.playing));
				c.eventMode = 'static';
				c.cursor = 'pointer';
				c.hitArea = new PIXI.Rectangle(-r, -r * 1.6, r * 2, r * 2.6);
				c.on('pointertap', (e) => {
					e.stopPropagation();
					if (!dragging) onwarband?.(w.id);
				});
				return c;
			}

			/** Portrait disc with faction badge, radius r, drawn at the container origin. */
			function portraitMarker(w: PublicWarband, r: number, ring: number) {
				const c = new PIXI.Container();
				c.addChild(new PIXI.Graphics().circle(0, 0, r + 5).fill({ color: ring }));
				c.addChild(new PIXI.Graphics().circle(0, 0, r).fill({ color: 0xefe6d0 }));
				if (w.portrait) {
					tex(w.portrait).then((t) => {
						if (c.destroyed) return;
						const s = new PIXI.Sprite(t);
						s.anchor.set(0.5);
						s.width = s.height = r * 2;
						const mask = new PIXI.Graphics().circle(0, 0, r).fill({ color: 0xffffff });
						s.mask = mask;
						c.addChildAt(mask, 2);
						c.addChildAt(s, 2);
					});
				} else {
					const initials = new PIXI.Text({
						text: w.player.slice(0, 2).toUpperCase(),
						style: { fontFamily: 'UnifrakturMaguntia', fontSize: r, fill: 0x8b2a1d }
					});
					initials.anchor.set(0.5);
					c.addChild(initials);
				}
				if (w.seal) {
					// The faction's struck seal, a little proud of the portrait.
					const badge = new PIXI.Container();
					badge.position.set(r * 0.78, r * 0.78);
					badge.addChild(new PIXI.Graphics().circle(1, 2, r * 0.6).fill({ color: 0x15130e, alpha: 0.45 }));
					sealBadge(badge, w.seal, r * 0.6, w.playing);
					c.addChild(badge);
				} else if (w.symbol) {
					const badge = new PIXI.Container();
					badge.position.set(r * 0.72, r * 0.72);
					badge.addChild(new PIXI.Graphics().circle(0, 0, r * 0.42 + 3).fill({ color: hexToNumber(sigilFor(w.faction).rim) }));
					tex(w.symbol).then((t) => {
						if (badge.destroyed) return;
						const s = new PIXI.Sprite(t);
						s.anchor.set(0.5);
						s.width = s.height = r * 0.84;
						const mask = new PIXI.Graphics().circle(0, 0, r * 0.42).fill({ color: 0xffffff });
						s.mask = mask;
						badge.addChild(mask, s);
						sigilLight(badge, r * 0.42, w.faction, w.playing);
					});
					c.addChild(badge);
				}
				c.eventMode = 'static';
				c.cursor = 'pointer';
				c.on('pointertap', (e) => {
					e.stopPropagation();
					if (!dragging) onwarband?.(w.id);
				});
				return c;
			}

			const markerScale = () => Math.min(3.5, Math.max(1, 0.7 / viewport.scale.x));
			const groups: Container[] = [];

			function draw() {
				for (const layer of [highlight, battles, monumentLayer, outposts, markers]) {
					for (const child of layer.removeChildren()) child.destroy({ children: true });
				}
				groups.length = 0;
				sigils.length = 0;
				studs.length = 0;
				const s = snapshot;
				const k = markerScale();

				// Selected warband: scouted zones and supply chain.
				const sel = s.warbands.find((w) => w.id === selected);
				if (sel) {
					const g = new PIXI.Graphics();
					for (const id of sel.scouted) {
						const z = graph.zones.get(id);
						if (z) g.circle(world(z).x, world(z).y, 64).fill({ color: 0xf1e6cb, alpha: 0.28 });
					}
					for (const id of sel.supplied) {
						const z = graph.zones.get(id);
						if (z) g.circle(world(z).x, world(z).y, 64).stroke({ width: 8, color: 0x5f7f2a, alpha: 0.9 });
					}
					highlight.addChild(g);
				}

				// Battles: a pulsing ring while fought; a dashed ring with crossed swords while planned.
				for (const game of s.active) {
					const z = graph.zones.get(game.zone);
					if (!z) continue;
					const ring = new PIXI.Graphics();
					if (game.status === 'scheduled') {
						for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
							ring.arc(0, 0, 80, a, a + Math.PI / 18).stroke({ width: 8, color: 0xa3170f });
						}
						// Crossed swords, drawn in ink on a bone ground (a planned battle).
						const swords = new PIXI.Graphics()
							.circle(0, 0, 24)
							.fill({ color: 0xece5d3 })
							.stroke({ width: 4, color: 0x151210 })
							.moveTo(-13, -13).lineTo(10, 10)
							.moveTo(13, -13).lineTo(-10, 10)
							.stroke({ width: 5, color: 0x151210, cap: 'square' })
							.moveTo(3, 12).lineTo(12, 3)
							.moveTo(-3, 12).lineTo(-12, 3)
							.stroke({ width: 4, color: 0xa3170f, cap: 'square' });
						swords.y = -96;
						ring.addChild(swords);
						ring.label = 'planned';
					} else {
						ring.circle(0, 0, 80).stroke({ width: 10, color: 0xc8231a });
					}
					ring.position.set(world(z).x, world(z).y);
					battles.addChild(ring);
				}

				if (s.fx.monuments) drawMonuments(s.monuments, k);

				// Outposts: a redoubt token per holder above the zone, supplied ones on a green base.
				const holders = new Map<string, PublicWarband[]>();
				for (const w of s.warbands) for (const z of w.outposts) holders.set(z, [...(holders.get(z) ?? []), w]);
				for (const [zid, ws] of holders) {
					const z = graph.zones.get(zid);
					if (!z) continue;
					const g = new PIXI.Container();
					g.position.set(world(z).x, world(z).y);
					ws.forEach((w, i) => {
						const m = outpostMarker(w, w.supplied.includes(zid));
						m.position.set((i - (ws.length - 1) / 2) * 56, -50);
						g.addChild(m);
					});
					g.scale.set(k);
					groups.push(g);
					outposts.addChild(g);
				}

				// Warband markers, fanned around their zone.
				const byZone = new Map<string, PublicWarband[]>();
				for (const w of s.warbands) byZone.set(w.position, [...(byZone.get(w.position) ?? []), w]);
				for (const [zid, ws] of byZone) {
					const z = graph.zones.get(zid);
					if (!z) continue;
					const g = new PIXI.Container();
					g.position.set(world(z).x, world(z).y);
					const n = ws.length;
					const radius = n === 1 ? 0 : 34 + n * 7;
					ws.forEach((w, i) => {
						const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
						const ring = w.id === selected ? 0xf1e6cb : w.playing ? 0xb8321f : 0x231a12;
						const m = w.figureToken ? figureMarker(w, 30, ring) : portraitMarker(w, 30, ring);
						m.position.set(Math.cos(a) * radius, Math.sin(a) * radius);
						g.addChild(m);
					});
					g.scale.set(k);
					groups.push(g);
					markers.addChild(g);
				}
			}

			viewport.on('zoomed', () => {
				const k = markerScale();
				for (const g of groups) g.scale.set(k);
			});

			let t = 0;
			app.ticker.add((ticker) => {
				if (!reduceMotion) {
					const now = performance.now() / 1000;
					for (const g of sigils) {
						if (g.band.destroyed) continue;
						// Eased climb: from below the disc, through it, out over the top.
						const p = (now / g.period + g.phase) % 1;
						const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
						g.band.y = g.R - e * g.R * 4;
					}
					for (const r of studs) if (!r.destroyed) r.rotation = now * 0.17;
				}
				t += ticker.deltaMS / 1000;
				const pulse = 1 + 0.08 * Math.sin(t * 4);
				for (const r of battles.children) {
					if (r.label === 'planned') {
						r.scale.set(markerScale() * 0.6 + 0.4);
						r.rotation = t * 0.15;
						const swords = r.children[0];
						if (swords) swords.rotation = -t * 0.15; // keep the swords upright while the ring turns
						continue;
					}
					r.scale.set(pulse * markerScale() * 0.6 + 0.4);
					r.alpha = 0.55 + 0.35 * Math.sin(t * 4);
				}
			});

			redraw = draw;
			draw();

			// Entering a battle: fly the camera in; leaving: fly back to where the viewer was.
			let home: { x: number; y: number; scale: number } | null = null;
			let flownTo: string | null = null;
			fly = (zoneId) => {
				if (zoneId === flownTo) return;
				flownTo = zoneId;
				const z = zoneId ? graph.zones.get(zoneId) : undefined;
				const time = reduceMotion ? 0 : 1400;
				if (z) {
					home ??= { x: viewport.center.x, y: viewport.center.y, scale: viewport.scale.x };
					viewport.animate({ position: world(z), scale: 2.2, time, ease: 'easeInOutSine', removeOnInterrupt: true });
				} else if (home) {
					viewport.animate({ position: { x: home.x, y: home.y }, scale: home.scale, time, ease: 'easeInOutSine', removeOnInterrupt: true });
					home = null;
				}
			};
			viewport.on('moved', () => {
				const k = markerScale();
				for (const g of groups) g.scale.set(k);
			});
			fly(focus);
			project = (zoneId: string) => {
				const z = graph.zones.get(zoneId);
				if (!z) return null;
				const p = viewport.toScreen(world(z).x, world(z).y);
				return { x: p.x, y: p.y };
			};

			const { FxEngine } = await import('$lib/fx/engine');
			if (destroyed) return;
			const fx = new FxEngine(app, overlay, fxBack, fxFront, deviceQuality(snapshot.fx.quality));
			fx.worldSize = { w: W, h: H };
			refx = () => {
				fx.quality = fxEnabled ? deviceQuality(snapshot.fx.quality) : 0;
				fx.wind = snapshot.fx.wind;
				fx.setTimeOfDay(snapshot.fx.timeOfDay, W, H);
				fx.setWanted(fxEnabled ? wantedEffects(snapshot, graph.zones, world, focus) : []);
			};
			refx();
			fx.onSheets = () => refx?.();
			// Opt-in handle for inspecting effects: add ?debugfx to the URL.
			if (new URLSearchParams(location.search).has('debugfx')) (window as unknown as { __fx: unknown }).__fx = fx;
			const unsubscribe = subscribeTriggers?.((t) => {
				if (!fxEnabled) return;
				const z = t.zone ? graph.zones.get(t.zone) : undefined;
				if (t.kind === 'battle-result' && t.battle && z) {
					// Hold the new monument back until the animation has raised its own.
					const id = t.battle.gameId;
					pending.add(id);
					draw();
					fx.trigger(t, world(z), () => {
						pending.delete(id);
						redraw?.();
					});
					return;
				}
				fx.trigger(t, z ? world(z) : undefined);
			});

			cleanup = () => {
				ro.disconnect();
				redraw = null;
				refx = null;
				fly = null;
				unsubscribe?.();
				fx.destroy();
				app.destroy(true, { children: true });
			};
		})();

		return () => {
			destroyed = true;
			cleanup();
		};
	});
</script>

<div class="map" bind:this={host}></div>

<style>
	.map {
		position: absolute;
		inset: 0;
		overflow: hidden;
		touch-action: none;
	}
</style>

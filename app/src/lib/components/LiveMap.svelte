<script lang="ts">
	import { onMount } from 'svelte';
	import type { Container, Graphics, Texture } from 'pixi.js';
	import { buildGraph } from '$lib/rules/zones';
	import type { Zone } from '$lib/rules/types';
	import type { PublicSnapshot, PublicWarband } from '$lib/snapshot';
	import type { FxTrigger } from '$lib/fx/types';
	import { deviceQuality, wantedEffects } from '$lib/fx/wanted';

	let {
		snapshot,
		selected = null,
		onzone,
		onwarband,
		fxEnabled = true,
		subscribeTriggers
	}: {
		snapshot: PublicSnapshot;
		selected?: string | null;
		onzone?: (id: string) => void;
		onwarband?: (id: string) => void;
		/** Viewer's own switch for weather effects. */
		fxEnabled?: boolean;
		/** Live one-shot effects (lightning, crows…). */
		subscribeTriggers?: (fn: (t: FxTrigger) => void) => () => void;
	} = $props();

	const MAP_URL = '/map/carcass-map.webp';
	const W = 2398;
	const H = 1604;
	const RES_COLORS = { F: 0xc8741e, R: 0x9b2a1c, S: 0x5f7f2a, T: 0x2f6770 } as const;

	let host: HTMLDivElement;
	let redraw: (() => void) | null = null;
	let refx: (() => void) | null = null;

	// Re-draw dynamic layers whenever the snapshot or selection changes.
	$effect(() => {
		void snapshot;
		void selected;
		redraw?.();
	});
	$effect(() => {
		void snapshot;
		void fxEnabled;
		refx?.();
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
			const outposts = new PIXI.Container();
			const markers = new PIXI.Container();
			const hits = new PIXI.Container();
			const fxBack = new PIXI.Container();
			const fxFront = new PIXI.Container();
			viewport.addChild(fxBack, highlight, battles, outposts, hits, markers, fxFront);

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
				if (w.symbol) {
					const badge = new PIXI.Container();
					badge.position.set(r * 0.72, r * 0.72);
					badge.addChild(new PIXI.Graphics().circle(0, 0, r * 0.42 + 3).fill({ color: 0x231a12 }));
					tex(w.symbol).then((t) => {
						if (badge.destroyed) return;
						const s = new PIXI.Sprite(t);
						s.anchor.set(0.5);
						s.width = s.height = r * 0.84;
						const mask = new PIXI.Graphics().circle(0, 0, r * 0.42).fill({ color: 0xffffff });
						s.mask = mask;
						badge.addChild(mask, s);
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
				for (const layer of [highlight, battles, outposts, markers]) {
					for (const child of layer.removeChildren()) child.destroy({ children: true });
				}
				groups.length = 0;
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

				// Battles in progress: pulsing rings.
				for (const game of s.active) {
					const z = graph.zones.get(game.zone);
					if (!z) continue;
					const ring = new PIXI.Graphics().circle(0, 0, 80).stroke({ width: 10, color: 0xb8321f });
					ring.position.set(world(z).x, world(z).y);
					battles.addChild(ring);
				}

				// Outposts: small faction flags under each zone.
				const holders = new Map<string, PublicWarband[]>();
				for (const w of s.warbands) for (const z of w.outposts) holders.set(z, [...(holders.get(z) ?? []), w]);
				for (const [zid, ws] of holders) {
					const z = graph.zones.get(zid);
					if (!z) continue;
					const g = new PIXI.Container();
					g.position.set(world(z).x, world(z).y);
					ws.forEach((w, i) => {
						const flag = portraitMarker({ ...w, portrait: w.symbol ?? w.portrait, symbol: null }, 11, w.supplied.includes(zid) ? 0x5f7f2a : 0x231a12);
						flag.position.set((i - (ws.length - 1) / 2) * 30, -62);
						g.addChild(flag);
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
						const m = portraitMarker(w, 30, w.id === selected ? 0xf1e6cb : w.playing ? 0xb8321f : 0x231a12);
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
				t += ticker.deltaMS / 1000;
				const pulse = 1 + 0.08 * Math.sin(t * 4);
				for (const r of battles.children) {
					r.scale.set(pulse * markerScale() * 0.6 + 0.4);
					r.alpha = 0.55 + 0.35 * Math.sin(t * 4);
				}
			});

			redraw = draw;
			draw();

			const { FxEngine } = await import('$lib/fx/engine');
			if (destroyed) return;
			const fx = new FxEngine(app, overlay, fxBack, fxFront, deviceQuality(snapshot.fx.quality));
			refx = () => {
				fx.quality = fxEnabled ? deviceQuality(snapshot.fx.quality) : 0;
				fx.wind = snapshot.fx.wind;
				fx.setWanted(fxEnabled ? wantedEffects(snapshot, graph.zones, world) : []);
			};
			refx();
			const unsubscribe = subscribeTriggers?.((t) => {
				if (!fxEnabled) return;
				const z = t.zone ? graph.zones.get(t.zone) : undefined;
				fx.trigger(t, z ? world(z) : undefined);
			});

			cleanup = () => {
				ro.disconnect();
				redraw = null;
				refx = null;
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

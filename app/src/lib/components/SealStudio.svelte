<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SEAL_FRAME, SEAL_FRAMES } from '$lib/seals';

	/**
	 * Strike a player's own symbol into a seal, in the browser: the image becomes line art, the line
	 * art a relief medallion (three.js), and the medallion the same two strips the Blender pipeline
	 * makes for the factions: a neutral silver pass and a light mask. three.js loads only here.
	 */
	let { onstruck }: { onstruck: (strips: { base: Blob; light: Blob; source: File }) => void } = $props();

	const MASK = 512;
	let file = $state<File | null>(null);
	let threshold = $state(0.5);
	let invert = $state(false);
	let busy = $state(false);
	let message = $state('');
	let maskCanvas = $state<HTMLCanvasElement>();
	let img: HTMLImageElement | null = null;

	async function pick(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!f) return;
		if (f.size > 10 * 1024 * 1024) {
			message = 'That image is larger than 10 MB.';
			return;
		}
		message = '';
		const url = URL.createObjectURL(f);
		img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const i = new Image();
			i.onload = () => resolve(i);
			i.onerror = reject;
			i.src = url;
		}).catch(() => null);
		if (!img) {
			message = 'Could not read that image.';
			return;
		}
		file = f;
		// Dark lines on a light ground are more common than the reverse: guess, and let the player flip it.
		invert = meanLuminance(img) > 0.5;
		drawMask();
	}

	function meanLuminance(i: HTMLImageElement) {
		const c = document.createElement('canvas');
		c.width = c.height = 32;
		const g = c.getContext('2d')!;
		g.drawImage(i, 0, 0, 32, 32);
		const d = g.getImageData(0, 0, 32, 32).data;
		let sum = 0;
		for (let p = 0; p < d.length; p += 4) sum += ((0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) / 255) * (d[p + 3] / 255) + (1 - d[p + 3] / 255);
		return sum / (d.length / 4);
	}

	/** The symbol as line art: white where it will be struck, black field, cut to the seal's circle. */
	function drawMask() {
		if (!img || !maskCanvas) return;
		const c = maskCanvas;
		c.width = c.height = MASK;
		const g = c.getContext('2d')!;
		g.fillStyle = invert ? '#fff' : '#000';
		g.fillRect(0, 0, MASK, MASK);
		const inner = MASK * 0.84;
		const k = Math.min(inner / img.naturalWidth, inner / img.naturalHeight);
		const w = img.naturalWidth * k;
		const h = img.naturalHeight * k;
		g.drawImage(img, (MASK - w) / 2, (MASK - h) / 2, w, h);
		const data = g.getImageData(0, 0, MASK, MASK);
		const d = data.data;
		const r = MASK / 2;
		for (let y = 0; y < MASK; y++)
			for (let x = 0; x < MASK; x++) {
				const p = (y * MASK + x) * 4;
				let l = (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) / 255;
				l = d[p + 3] < 128 ? (invert ? 1 : 0) : l;
				if (invert) l = 1 - l;
				// Soft threshold keeps the edges from stair-stepping in the relief.
				let v = Math.min(1, Math.max(0, (l - threshold) / 0.12 + 0.5));
				if (Math.hypot(x - r, y - r) > r * 0.9) v = 0;
				d[p] = d[p + 1] = d[p + 2] = v * 255;
				d[p + 3] = 255;
			}
		g.putImageData(data, 0, 0);
	}

	$effect(() => {
		void [threshold, invert];
		drawMask();
	});

	type Three = typeof import('three');
	let disposeAll: (() => void) | null = null;

	async function strike() {
		if (!file || !maskCanvas) return;
		busy = true;
		message = 'Striking the seal…';
		try {
			const THREE: Three = await import('three');
			const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
			const size = SEAL_FRAME * 2;
			const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
			renderer.setPixelRatio(1);
			renderer.setSize(size, size, false);
			renderer.outputColorSpace = THREE.SRGBColorSpace;
			const scene = new THREE.Scene();
			const pmrem = new THREE.PMREMGenerator(renderer);
			scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

			// Line art: sharp for colour, softened for the relief.
			const lines = new THREE.CanvasTexture(maskCanvas);
			const soft = document.createElement('canvas');
			soft.width = soft.height = MASK;
			const sg = soft.getContext('2d')!;
			sg.filter = 'blur(3px)';
			sg.drawImage(maskCanvas, 0, 0);
			const relief = new THREE.CanvasTexture(soft);
			// Silver where struck, dark enamel in the field.
			const colour = document.createElement('canvas');
			colour.width = colour.height = MASK;
			const cg = colour.getContext('2d')!;
			cg.fillStyle = '#0b0a0d';
			cg.fillRect(0, 0, MASK, MASK);
			cg.globalCompositeOperation = 'lighter';
			cg.filter = 'brightness(0.8)';
			cg.drawImage(maskCanvas, 0, 0);
			const colourTex = new THREE.CanvasTexture(colour);
			colourTex.colorSpace = THREE.SRGBColorSpace;
			const round = document.createElement('canvas');
			round.width = round.height = MASK;
			const rg = round.getContext('2d')!;
			rg.fillStyle = '#000';
			rg.fillRect(0, 0, MASK, MASK);
			rg.fillStyle = '#fff';
			rg.beginPath();
			rg.arc(MASK / 2, MASK / 2, MASK * 0.47, 0, Math.PI * 2);
			rg.fill();
			const roundTex = new THREE.CanvasTexture(round);

			const face = new THREE.Mesh<import('three').PlaneGeometry, import('three').Material>(
				new THREE.PlaneGeometry(2, 2, 256, 256),
				new THREE.MeshStandardMaterial({
					map: colourTex,
					metalnessMap: lines,
					metalness: 1,
					roughness: 0.3,
					displacementMap: relief,
					displacementScale: 0.06,
					alphaMap: roundTex,
					transparent: true
				})
			);
			scene.add(face);
			const rim = new THREE.Mesh(
				new THREE.TorusGeometry(0.94, 0.045, 16, 128),
				new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.22 })
			);
			rim.position.z = 0.02;
			scene.add(rim);
			scene.add(new THREE.AmbientLight(0xffffff, 0.15));
			const key = new THREE.DirectionalLight(0xffffff, 2.2);
			scene.add(key);
			const camera = new THREE.OrthographicCamera(-1.02, 1.02, 1.02, -1.02, 0.1, 10);
			camera.position.set(0, 0, 5);
			camera.lookAt(0, 0, 0);

			const strip = (fill: (i: number) => void) => {
				const out = document.createElement('canvas');
				out.width = SEAL_FRAME * SEAL_FRAMES;
				out.height = SEAL_FRAME;
				const og = out.getContext('2d')!;
				for (let i = 0; i < SEAL_FRAMES; i++) {
					fill(i);
					renderer.render(scene, camera);
					og.drawImage(renderer.domElement, i * SEAL_FRAME, 0, SEAL_FRAME, SEAL_FRAME);
				}
				return out;
			};

			// Base pass: a glint circling the relief once per loop.
			const base = strip((i) => {
				const a = (i / SEAL_FRAMES) * Math.PI * 2 + 2.2;
				key.position.set(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 1.4);
			});

			// Light pass: the band climbing the line art, as a grey mask on black.
			renderer.setClearColor(0x000000, 1);
			rim.visible = false;
			const band = { value: -0.3 };
			face.material = new THREE.ShaderMaterial({
				uniforms: { uLines: { value: lines }, uRound: { value: roundTex }, uBand: band },
				vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
				fragmentShader: `
					uniform sampler2D uLines; uniform sampler2D uRound; uniform float uBand; varying vec2 vUv;
					void main(){
						float m = texture2D(uLines, vUv).r * texture2D(uRound, vUv).r;
						float nearB = clamp(1.0 - abs(vUv.y - uBand) / 0.2, 0.0, 1.0) * 0.8;
						float foot = clamp(1.0 - vUv.y / 0.5, 0.0, 1.0) * 0.5;
						float v = clamp((nearB + foot) * m * 0.75, 0.0, 1.0);
						gl_FragColor = vec4(vec3(v), 1.0);
					}`
			});
			const lightCanvas = strip((i) => (band.value = -0.3 + (1.6 * i) / SEAL_FRAMES));
			// Grey mask -> white with the brightness as alpha, like the packed faction strips.
			const lg = lightCanvas.getContext('2d')!;
			const px = lg.getImageData(0, 0, lightCanvas.width, lightCanvas.height);
			for (let p = 0; p < px.data.length; p += 4) {
				px.data[p + 3] = px.data[p];
				px.data[p] = px.data[p + 1] = px.data[p + 2] = 255;
			}
			lg.putImageData(px, 0, 0);

			disposeAll = () => {
				renderer.dispose();
				pmrem.dispose();
			};
			const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
			onstruck({ base: await toBlob(base), light: await toBlob(lightCanvas), source: file });
			message = 'Struck. Check the preview, then save.';
			disposeAll();
			disposeAll = null;
		} catch (e) {
			console.error(e);
			message = 'Striking failed on this device.';
		} finally {
			busy = false;
		}
	}

	onDestroy(() => disposeAll?.());
</script>

<div class="studio">
	<label class="file">
		Your symbol <small>(PNG, JPG or WebP; simple, high-contrast art works best)</small>
		<input type="file" accept="image/png,image/jpeg,image/webp" onchange={pick} />
	</label>
	<div class="work" hidden={!file}>
		<canvas bind:this={maskCanvas} class="mask" title="What will be struck in metal"></canvas>
		<div class="controls">
			<label>Line strength <input type="range" min="0.15" max="0.85" step="0.01" bind:value={threshold} /></label>
			<label class="row"><input type="checkbox" bind:checked={invert} /> Swap light and dark</label>
			<button type="button" onclick={strike} disabled={busy}>{busy ? 'Striking…' : 'Strike the seal'}</button>
		</div>
	</div>
	{#if message}<p class="msg">{message}</p>{/if}
</div>

<style>
	.studio {
		display: grid;
		gap: 10px;
	}
	.file {
		display: grid;
		gap: 4px;
	}
	.work {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: center;
	}
	.work[hidden] {
		display: none;
	}
	.mask {
		width: 132px;
		height: 132px;
		border-radius: 50%;
		border: 1px solid var(--ink);
		background: #000;
	}
	.controls {
		display: grid;
		gap: 8px;
	}
	.controls label {
		display: grid;
		gap: 2px;
	}
	.controls .row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.msg {
		margin: 0;
		color: var(--ink-soft);
	}
</style>

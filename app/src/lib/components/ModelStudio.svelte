<script lang="ts">
	import { onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { ModelKind, ModelOwner } from '$lib/models';

	/**
	 * Admin only: load an STL, pose it, and render a transparent map token in the browser.
	 * three.js is imported on demand so it never reaches the public bundle.
	 */
	interface Current {
		id: string;
		token: string;
		hasStl: boolean;
		params: { yaw?: number; pitch?: number; scale?: number; tint?: string; zUp?: boolean };
	}
	let {
		kind,
		ownerType,
		ownerId,
		title,
		current = null,
		fallback = 'the default token'
	}: {
		kind: ModelKind;
		ownerType: ModelOwner;
		ownerId: string;
		title: string;
		current?: Current | null;
		fallback?: string;
	} = $props();

	const SIZE = 256;
	const SAVED = 'Token saved.';
	// svelte-ignore state_referenced_locally
	const start = current?.params ?? {};
	let yaw = $state(start.yaw ?? 20);
	// Elevation of the camera above the horizon; 44° matches the Blender outpost renders.
	let pitch = $state(start.pitch ?? 44);
	let scale = $state(start.scale ?? 1);
	// svelte-ignore state_referenced_locally
	let tint = $state(start.tint ?? (kind === 'outpost' ? '#a89572' : '#9a9486'));
	let zUp = $state(start.zUp ?? true);

	let canvas = $state<HTMLCanvasElement>();
	let open = $state(false);
	let loading = $state(false);
	let saving = $state(false);
	let message = $state('');
	let stlFile: File | null = null;
	let loaded = $state(false);

	type Three = typeof import('three');
	let THREE: Three | null = null;
	let renderer: import('three').WebGLRenderer | null = null;
	let scene: import('three').Scene | null = null;
	let camera: import('three').OrthographicCamera | null = null;
	let mesh: import('three').Mesh | null = null;
	let pivot: import('three').Group | null = null;

	async function ensureThree() {
		if (THREE && renderer) return;
		THREE = await import('three');
		renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
		renderer.setPixelRatio(1);
		renderer.setSize(SIZE, SIZE, false);
		renderer.setClearColor(0x000000, 0);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		scene = new THREE.Scene();
		scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a2e22, 1.1));
		// A warm key light from the upper left, like the sun in render_fx.py.
		const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
		sun.position.set(-2.5, 4, 3);
		scene.add(sun);
		camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
	}

	async function loadStl(buffer: ArrayBuffer) {
		await ensureThree();
		const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
		const geometry = new STLLoader().parse(buffer);
		geometry.computeVertexNormals();
		geometry.center();
		if (pivot) scene!.remove(pivot);
		mesh?.geometry.dispose();
		mesh = new THREE!.Mesh(geometry, new THREE!.MeshStandardMaterial({ color: tint, roughness: 0.8, metalness: 0.05 }));
		pivot = new THREE!.Group();
		pivot.add(mesh);
		scene!.add(pivot);
		loaded = true;
		pose();
	}

	/** Orient, stand the model on the ground at the origin, and frame it. */
	function pose() {
		if (!THREE || !mesh || !pivot || !camera || !renderer || !scene) return;
		// Measure from a clean state each time, so repeated poses don't compound.
		pivot.rotation.set(0, 0, 0);
		mesh.position.set(0, 0, 0);
		mesh.scale.setScalar(1);
		mesh.rotation.set(zUp ? -Math.PI / 2 : 0, 0, 0);
		pivot.updateMatrixWorld(true);
		const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
		mesh.scale.setScalar(2 / Math.max(size.x, size.y, size.z, 1e-6));
		pivot.updateMatrixWorld(true);
		mesh.position.y -= new THREE.Box3().setFromObject(mesh).min.y;
		pivot.rotation.y = (yaw * Math.PI) / 180;
		pivot.updateMatrixWorld(true);

		(mesh.material as import('three').MeshStandardMaterial).color.set(tint);
		const bounds = new THREE.Box3().setFromObject(pivot);
		const centre = bounds.getCenter(new THREE.Vector3());
		const half = (bounds.getBoundingSphere(new THREE.Sphere()).radius * 1.02) / scale;
		Object.assign(camera, { left: -half, right: half, top: half, bottom: -half });
		const el = (pitch * Math.PI) / 180;
		camera.position.set(centre.x, centre.y + Math.sin(el) * 10, centre.z + Math.cos(el) * 10);
		camera.lookAt(centre);
		camera.updateProjectionMatrix();
		renderer.render(scene, camera);
	}

	$effect(() => {
		// Re-render whenever a control changes.
		void [yaw, pitch, scale, tint, zUp];
		if (loaded) pose();
	});

	async function begin() {
		open = true;
		message = '';
		if (current?.hasStl && !loaded) {
			loading = true;
			try {
				const res = await fetch(`/admin/api/models/${current.id}/stl`);
				if (res.ok) await loadStl(await res.arrayBuffer());
			} finally {
				loading = false;
			}
		}
	}

	async function pick(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 25 * 1024 * 1024) {
			message = 'STL is larger than 25 MB.';
			return;
		}
		loading = true;
		message = '';
		try {
			await loadStl(await file.arrayBuffer());
			stlFile = file;
		} catch {
			message = 'Could not read that STL.';
		} finally {
			loading = false;
		}
	}

	async function save() {
		if (!canvas || !loaded) return;
		saving = true;
		message = '';
		pose();
		const blob = await new Promise<Blob | null>((r) => canvas!.toBlob(r, 'image/png'));
		if (!blob) {
			saving = false;
			message = 'Rendering failed.';
			return;
		}
		const body = new FormData();
		body.set('kind', kind);
		body.set('ownerType', ownerType);
		body.set('ownerId', ownerId);
		body.set('token', blob, 'token.png');
		if (stlFile) body.set('stl', stlFile);
		body.set('params', JSON.stringify({ yaw, pitch, scale, tint, zUp }));
		const res = await fetch('/admin/api/models', { method: 'POST', body });
		saving = false;
		if (!res.ok) {
			message = (await res.json().catch(() => null))?.message ?? `Save failed (${res.status}).`;
			return;
		}
		stlFile = null;
		message = SAVED;
		await invalidateAll();
	}

	async function remove() {
		if (!current) return;
		const res = await fetch(`/admin/api/models/${current.id}`, { method: 'DELETE' });
		if (res.ok) {
			loaded = false;
			open = false;
			await invalidateAll();
		}
	}

	onDestroy(() => {
		mesh?.geometry.dispose();
		renderer?.dispose();
	});
</script>

<div class="studio">
	<div class="head">
		<div class="thumb" class:empty={!current}>
			{#if current}<img src={current.token} alt="{title} token" />{:else}<span>—</span>{/if}
		</div>
		<div>
			<strong>{title}</strong>
			<div class="sub">{current ? 'Custom token' : `Uses ${fallback}`}</div>
			<div class="actions">
				{#if !open}<button type="button" class="ghost" onclick={begin}>{current ? 'Re-render' : 'Upload STL'}</button>{/if}
				{#if current}<button type="button" class="ghost danger" onclick={remove}>Remove</button>{/if}
			</div>
		</div>
	</div>

	<div class="bench" hidden={!open}>
		<canvas bind:this={canvas} width={SIZE} height={SIZE} class:blank={!loaded}></canvas>
		<div class="controls">
			<label>
				STL file <small>(up to 25 MB)</small>
				<input type="file" accept=".stl,model/stl,application/sla" onchange={pick} />
			</label>
			{#if loading}<small>Loading model…</small>{/if}
			<label>Turn <input type="range" min="-180" max="180" step="1" bind:value={yaw} /> {yaw}°</label>
			<label>View height <input type="range" min="10" max="89" step="1" bind:value={pitch} /> {pitch}°</label>
			<label>Zoom <input type="range" min="0.5" max="1.8" step="0.05" bind:value={scale} /> {scale.toFixed(2)}×</label>
			<label class="row">Tint <input type="color" bind:value={tint} /></label>
			<label class="row"><input type="checkbox" bind:checked={zUp} /> Z-up file (most miniature STLs)</label>
			<div class="actions">
				<button type="button" onclick={save} disabled={!loaded || saving}>{saving ? 'Saving…' : 'Save token'}</button>
				<button type="button" class="ghost" onclick={() => (open = false)}>Close</button>
			</div>
		</div>
	</div>
	{#if message}<p class="msg" class:ok={message === SAVED}>{message}</p>{/if}
</div>

<style>
	.studio {
		display: grid;
		gap: 10px;
		padding: 10px 0;
		border-top: 1px dotted var(--rule);
	}
	.head {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.thumb {
		width: 72px;
		height: 72px;
		display: grid;
		place-items: center;
		background: repeating-conic-gradient(#e6dcc4 0 25%, #efe6d0 0 50%) 0 0 / 12px 12px;
		border: 1px solid var(--rule);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.thumb.empty span {
		color: var(--muted);
	}
	.sub {
		color: var(--muted);
		font-size: 0.9em;
	}
	.actions {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}
	.bench {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: flex-start;
	}
	.bench[hidden] {
		display: none;
	}
	canvas {
		width: 256px;
		height: 256px;
		max-width: 100%;
		background: repeating-conic-gradient(#e6dcc4 0 25%, #efe6d0 0 50%) 0 0 / 16px 16px;
		border: 1px solid var(--rule);
	}
	.controls {
		display: grid;
		gap: 8px;
		min-width: 240px;
	}
	.controls label {
		display: grid;
		gap: 2px;
	}
	.controls label.row {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.danger {
		color: var(--blood);
	}
	.msg {
		margin: 0;
		color: var(--blood);
	}
	.msg.ok {
		color: var(--supplies);
	}
</style>

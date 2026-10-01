import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** atlas.config.json, at the root of the project it describes. All paths in it are relative to that root. */
export interface Config {
	/** The LikeC4 workspace: curated .c4 files, plus generated/ written by `atlas update`. */
	model: string;
	/** The site's title. */
	title?: string;
	/** The branch a feature branch is compared with by `atlas status`. */
	base: string;
	extract: {
		/** Source files whose imports and env settings are read (globs; .ts, .js and Svelte <script> blocks). */
		imports?: string[];
		/** Import aliases, e.g. { "$lib": "app/src/lib" }. */
		alias?: Record<string, string>;
		/** A SvelteKit routes folder: pages, layouts, endpoints and form actions. */
		sveltekit?: string;
		/** A Drizzle schema file: its tables. */
		drizzle?: string;
		/** A compose file: its services and volumes. */
		compose?: string;
	};
}

export interface Project {
	root: string;
	config: Config;
	/** Absolute path of the model folder. */
	modelDir: string;
}

/** Finds atlas.config.json from `from` upwards. */
export function loadProject(from = process.cwd()): Project {
	let dir = resolve(from);
	while (!existsSync(join(dir, 'atlas.config.json'))) {
		const up = dirname(dir);
		if (up === dir) throw new Error('No atlas.config.json here or in any folder above.');
		dir = up;
	}
	const config = { base: 'main', ...JSON.parse(readFileSync(join(dir, 'atlas.config.json'), 'utf8')) } as Config;
	return { root: dir, config, modelDir: join(dir, config.model) };
}

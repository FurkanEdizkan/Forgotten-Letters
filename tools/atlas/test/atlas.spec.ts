import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { check } from '../src/check.ts';
import type { Config } from '../src/config.ts';
import { extract, routeOf, type Facts } from '../src/extract.ts';
import { generate } from '../src/generate.ts';
import { shortIds } from '../src/map.ts';
import { loadModel, ownerOf, type El, type Model } from '../src/model.ts';
import { behind, changedFiles } from '../src/status.ts';
import { execFileSync } from 'node:child_process';

/** A tiny SvelteKit-shaped project with a model that describes it, written to a temp folder. */
const files: Record<string, string> = {
	'src/lib/server/auth.ts': `import { db } from './db';\nimport { env } from '$env/dynamic/private';\nexport const x = env.SECRET;`,
	'src/lib/server/db.ts': `export const db = {};`,
	'src/lib/server/new-thing.ts': `import { db } from './db';`,
	'src/lib/Widget.svelte': `<script lang="ts">\n  import { x } from '$lib/server/auth';\n</script>\n<p>{x}</p>`,
	'src/routes/(app)/login/+page.server.ts': `import { x } from '$lib/server/auth';\nexport const actions = {\n\tsignin: async () => {},\n\treset: async () => {}\n};`,
	'src/routes/(app)/login/+page.svelte': `<script>import W from '$lib/Widget.svelte';</script>`,
	'src/routes/api/items/[id]/+server.ts': `export async function GET() {}\nexport const DELETE = () => {};`,
	'src/schema.ts': `export const user = pgTable('user', {});\nexport const session = pgTable(\n  'session', {});`,
	'compose.yaml': `services:\n  app:\n    image: x\n  db:\n    image: postgres\nvolumes:\n  pgdata:\n`,
	'arch/spec.c4': `specification {\n  element system\n  element module\n  element layer\n  element page\n  element endpoint\n  element table\n  relationship imports\n}`,
	'arch/model.c4': `model {
  sys = system 'Sys' {
    metadata { services ['app', 'db'] }
    auth = module 'Auth' {
      description 'Signing in. Second sentence.'
      metadata { code 'src/lib/server/auth.ts' }
    }
    store = module 'Store' {
      metadata { code ['src/lib/server/db.ts', 'src/schema.ts'] }
    }
    ui = module 'UI' {
      metadata { code 'src/lib/*.svelte' }
    }
    web = layer 'Web' {
      metadata { code 'src/routes/**' }
    }
    gone = module 'Gone' {
      metadata { code 'src/lib/server/removed.ts' }
    }
    accounts = layer 'Accounts' {
      metadata { tables ['user'] }
    }
  }
  sys.auth -> sys.store 'reads'
}
views {
  dynamic view signin {
    title 'Sign in'
    sys.web -> sys.auth 'signs in'
  }
}`
};

let root: string;
let config: Config;
let facts: Facts;
let model: Model;

beforeAll(async () => {
	root = mkdtempSync(join(tmpdir(), 'atlas-'));
	for (const [p, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, p)), { recursive: true });
		writeFileSync(join(root, p), text);
	}
	config = {
		model: 'arch',
		base: 'main',
		extract: { imports: ['src/**/*.ts', 'src/**/*.svelte'], alias: { $lib: 'src/lib' }, sveltekit: 'src/routes', drizzle: 'src/schema.ts', compose: 'compose.yaml' }
	};
	facts = extract(root, config);
	model = await loadModel(join(root, 'arch'));
}, 60_000);

describe('extract', () => {
	it('reads imports (relative, aliased, from Svelte scripts) and env settings', () => {
		const auth = facts.modules.find((m) => m.path === 'src/lib/server/auth.ts')!;
		expect(auth.imports).toEqual(['src/lib/server/db.ts']);
		expect(auth.env).toEqual(['SECRET']);
		expect(facts.modules.find((m) => m.path === 'src/lib/Widget.svelte')!.imports).toEqual(['src/lib/server/auth.ts']);
	});

	it('reads routes: groups drop out, params stay; actions and methods', () => {
		expect(routeOf('(app)/login')).toBe('/login');
		const login = facts.routes.find((r) => r.route === '/login')!;
		expect(login.actions).toEqual(['reset', 'signin']);
		expect(facts.routes.find((r) => r.route === '/api/items/[id]')!.methods).toEqual(['DELETE', 'GET']);
	});

	it('reads tables and compose services and volumes', () => {
		expect(facts.tables.map((t) => t.name)).toEqual(['user', 'session']);
		expect(facts.services.map((s) => s.name)).toEqual(['app', 'db']);
		expect(facts.volumes.map((s) => s.name)).toEqual(['pgdata']);
	});
});

describe('the model', () => {
	it('loads elements with their code, tables and services', () => {
		const auth = model.elements.find((e) => e.id === 'sys.auth')!;
		expect(auth.code).toEqual(['src/lib/server/auth.ts']);
		expect(model.elements.find((e) => e.id === 'sys.accounts')!.tables).toEqual(['user']);
		expect(model.views.find((v) => v.id === 'signin')!.steps).toEqual([{ from: 'sys.web', to: 'sys.auth', label: 'signs in' }]);
	});

	it('a file belongs to the most specific pattern', () => {
		const el = (id: string, code: string[], generated = false) => ({ id, code, generated }) as El;
		const els = [el('a', ['src/**']), el('a.b', ['src/lib/**']), el('c', ['src/lib/x.ts'])];
		expect(ownerOf('src/lib/x.ts', els)!.id).toBe('c');
		expect(ownerOf('src/lib/y.ts', els)!.id).toBe('a.b');
		expect(ownerOf('src/z.ts', els)!.id).toBe('a');
		expect(ownerOf('other/z.ts', els)).toBeNull();
	});
});

describe('check', () => {
	it('finds every kind of drift', () => {
		const issues = check(root, facts, model);
		const kinds = (k: string) => issues.filter((i) => i.kind === k).map((i) => i.message);
		expect(kinds('unowned-file')).toEqual(['src/lib/server/new-thing.ts belongs to no element']);
		expect(kinds('missing-code')).toEqual(['sys.gone: `src/lib/server/removed.ts` matches no file']);
		// The UI imports auth with no relationship; routes are covered by generated relationships instead.
		expect(kinds('unmodelled-import')).toEqual(['sys.ui -> sys.auth has no relationship (src/lib/Widget.svelte imports src/lib/server/auth.ts)']);
		expect(kinds('unmodelled-table')).toEqual(['table session is in no group']);
		expect(kinds('unmodelled-service')).toEqual(['compose.yaml: pgdata is in no element']);
	});
});

describe('generate', () => {
	it('hangs each route under its owner, with its imports', () => {
		const { 'routes.c4': routes, 'tables.c4': tables } = generate(facts, model, 'src/routes');
		expect(routes).toContain('extend sys.web {');
		expect(routes).toContain("route_app_login = page '/login'");
		expect(routes).toContain("description 'actions: reset, signin'");
		expect(routes).toContain("route_api_items_id = endpoint '/api/items/[id]'");
		expect(routes).toContain('sys.web.route_app_login -[imports]-> sys.auth');
		expect(routes).toContain('sys.web.route_app_login -[imports]-> sys.ui');
		expect(tables).toContain("extend sys.accounts {\n    table_user = table 'user'");
		expect(tables).not.toContain('session');
	});
});

describe('status', () => {
	const code = () => new Set(facts.modules.map((m) => m.path));
	it('code changed without the model: names the elements and the feature views through them', () => {
		const b = behind(['src/lib/server/auth.ts', 'src/lib/server/new-thing.ts', 'README.md'], code(), 'arch', model)!;
		expect(b.elements).toEqual([{ id: 'sys.auth', title: 'Auth', files: ['src/lib/server/auth.ts'] }]);
		expect(b.unowned).toEqual(['src/lib/server/new-thing.ts']);
		expect(b.features).toEqual(['signin']);
	});

	it('a curated .c4 change counts as updating the model; a generated one does not', () => {
		expect(behind(['src/lib/server/auth.ts', 'arch/model.c4'], code(), 'arch', model)).toBeNull();
		expect(behind(['src/lib/server/auth.ts', 'arch/generated/routes.c4'], code(), 'arch', model)).not.toBeNull();
		expect(behind(['README.md'], code(), 'arch', model)).toBeNull();
	});
});

describe('changed files', () => {
	it('reads every git status line whole, the first one too', () => {
		const git = (...a: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: root });
		git('init', '-q', '-b', 'main');
		git('add', '-A');
		git('commit', '-qm', 'base');
		git('switch', '-qc', 'feat/x');
		writeFileSync(join(root, 'src/lib/server/auth.ts'), '// changed');
		writeFileSync(join(root, 'src/lib/server/added.ts'), '');
		expect(changedFiles(root, 'main')).toEqual({ branch: 'feat/x', files: ['src/lib/server/added.ts', 'src/lib/server/auth.ts'] });
	});
});

describe('map', () => {
	it('short ids: the shortest unique tail', () => {
		const short = shortIds(['cf.app.server.live', 'cf.app.ui.live', 'cf.app.server.auth']);
		expect(short('cf.app.server.live')).toBe('server.live');
		expect(short('cf.app.ui.live')).toBe('ui.live');
		expect(short('cf.app.server.auth')).toBe('auth');
	});
});

// Owner recovery (F11), run inside the app container:
//   docker compose exec app node scripts/owner-recovery.js <username>
//     gives that owner a temporary password (to change at the next sign-in), ends their sessions, re-enables the
//     account and writes an audit entry. The temporary password is printed once.
//   docker compose exec app node scripts/owner-recovery.js
//     with no owner yet: says that setup is open in the browser (there is no link to make). Otherwise lists the owners.
// Keep the hash format in step with src/lib/server/services/passwords.ts.
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import postgres from 'postgres';
import { databaseUrl } from './db-url.js';

const N = 2 ** 17;
const R = 8;
const P = 1;
const MAXMEM = 256 * 1024 * 1024;

async function hashPassword(password) {
	const salt = randomBytes(16);
	const hash = await promisify(scrypt)(password.normalize('NFKC'), salt, 64, {
		N,
		r: R,
		p: P,
		maxmem: MAXMEM
	});
	return ['scrypt', 'v1', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join(
		'$'
	);
}

function temporaryPassword() {
	const words = [
		'ash',
		'bell',
		'bone',
		'crow',
		'dirge',
		'ember',
		'flag',
		'grail',
		'iron',
		'lamp',
		'mire',
		'nail',
		'relic',
		'salt',
		'shroud',
		'thorn',
		'vigil',
		'wick',
		'hymn',
		'spade'
	];
	const pick = () => words[randomBytes(1)[0] % words.length];
	return `${pick()}-${pick()}-${pick()}-${1000 + (randomBytes(2).readUInt16BE() % 9000)}`;
}

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
const username = process.argv[2]?.trim().toLowerCase();
let code = 0;

try {
	if (!username) {
		const owners =
			await sql`select username from auth.users where role = 'owner' order by username`;
		if (owners.length) {
			console.log(`Owners: ${owners.map((o) => o.username).join(', ')}`);
			console.log(
				'Reset one with: docker compose exec app node scripts/owner-recovery.js <username>'
			);
		} else {
			const base = (process.env.ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
			console.log(`No owner yet. Setup is open: open ${base} in a browser to create the owner.`);
		}
	} else {
		const temporary = temporaryPassword();
		const passwordHash = await hashPassword(temporary);
		const done = await sql.begin(async (tx) => {
			const [u] = await tx`select id, role from auth.users where username = ${username} for update`;
			if (!u || u.role !== 'owner') return false;
			await tx`update auth.users set password_hash = ${passwordHash}, must_change_password = true, disabled_at = null, version = version + 1 where id = ${u.id}`;
			await tx`delete from auth.sessions where user_id = ${u.id}`;
			await tx`insert into auth.audit_log (action, target_type, target_id, detail) values ('password.reset', 'user', ${u.id}, ${tx.json({ via: 'recovery' })})`;
			return true;
		});
		if (done) {
			console.log(`Temporary password for ${username}: ${temporary}`);
			console.log(
				'Sign in with it; the app asks for a new password first. Every session of this account was ended.'
			);
		} else {
			console.error(`No owner named "${username}". Run without a username to list the owners.`);
			code = 1;
		}
	}
} finally {
	await sql.end();
}
process.exit(code);

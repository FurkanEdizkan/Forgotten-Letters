import { describe, expect, it } from 'vitest';
import { db } from '.';
import * as usersRepo from '../repos/users';
import { person, sql, useTestDatabase } from '../testing/db';

useTestDatabase();

describe('auth.users in the database', () => {
	it('the updated_at trigger moves updated_at on every update', async () => {
		const { row } = await person('user');
		await sql()`update auth.users set updated_at = '2000-01-01' where id = ${row.id}`;
		const [forced] = await sql()`select updated_at::text as t from auth.users where id = ${row.id}`;
		expect(forced!.t.startsWith('2000')).toBe(false);
		await usersRepo.update(db(), row.id, { displayName: 'Renamed' });
		const [after] =
			await sql()`select updated_at > ${forced!.t}::timestamptz as moved from auth.users where id = ${row.id}`;
		expect(after!.moved).toBe(true);
	});
	it('ids are uuidv7', async () => {
		const { row } = await person('user');
		expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});
	it('usernames are unique ignoring case', async () => {
		await person('user', { username: 'same.name' });
		expect(
			await usersRepo.insert(db(), {
				username: 'SAME.name',
				displayName: 'x',
				passwordHash: 'x',
				role: 'user'
			})
		).toBeNull();
	});
	it('the database itself refuses a bad username or display name', async () => {
		await expect(
			sql()`insert into auth.users (username, display_name, password_hash) values ('Bad Name', 'x', 'x')`
		).rejects.toMatchObject({ constraint_name: 'users_username_form' });
		await expect(
			sql()`insert into auth.users (username, display_name, password_hash) values ('good', '', 'x')`
		).rejects.toMatchObject({ constraint_name: 'users_display_name_length' });
	});
});

<!--
  The Co-CMs tab: who runs the campaign, with their site role and campaign role. The CM removes co-CMs and hands
  the CM role to one (both confirm in place) and adds Admins or Owners by name. Co-CMs see the list only.
-->
<script lang="ts">
	import { enhance } from '#lib/ui/enhance';
	import { m } from '#lib/messages';
	import type { ApiCampaign } from '#lib/api-types';
	import { resultOf, type FormResult } from '#lib/ui/form-result';
	import CampaignRoleBadge from '#lib/ui/CampaignRoleBadge.svelte';
	import ConfirmButton from '#lib/ui/ConfirmButton.svelte';
	import Message from '#lib/ui/Message.svelte';
	import PersonPicker from '#lib/ui/PersonPicker.svelte';
	import RoleBadge from '#lib/ui/RoleBadge.svelte';

	type Candidate = { id: string; displayName: string; username: string };
	type Props = {
		members: ApiCampaign['members'];
		canManage: boolean;
		canTransfer: boolean;
		readOnly: boolean;
		cmFind: string;
		candidates: Candidate[];
		form: FormResult;
	};
	let { members, canManage, canTransfer, readOnly, cmFind, candidates, form }: Props = $props();
	const c = m.campaigns.manage.cocms;

	const sorted = $derived(
		[...members].sort((a, b) => (a.role === b.role ? 0 : a.role === 'cm' ? -1 : 1))
	);
	const errorFor = (id: string) =>
		resultOf(form, 'removeCoCm', id).error ?? resultOf(form, 'transfer', id).error;
</script>

<table class="table">
	<thead>
		<tr>
			<th scope="col">{c.person}</th>
			<th scope="col">{c.siteRole}</th>
			<th scope="col">{c.role}</th>
			<th scope="col"><span class="visually-hidden">{c.actions}</span></th>
		</tr>
	</thead>
	<tbody>
		{#each sorted as p (p.userId)}
			{@const error = errorFor(p.userId)}
			<tr>
				<td>{p.displayName}</td>
				<td><RoleBadge role={p.siteRole} /></td>
				<td><CampaignRoleBadge role={p.role} /></td>
				<td>
					{#if p.role === 'co_cm' && !readOnly}
						<div class="actions">
							{#if canManage}
								<form method="POST" action="?/removeCoCm" use:enhance>
									<input type="hidden" name="op" value="removeCoCm" />
									<input type="hidden" name="id" value={p.userId} />
									<ConfirmButton label={c.remove} confirm={c.removeConfirm} />
								</form>
							{/if}
							{#if canTransfer}
								<form method="POST" action="?/transfer" use:enhance>
									<input type="hidden" name="op" value="transfer" />
									<input type="hidden" name="id" value={p.userId} />
									<ConfirmButton label={c.transfer} confirm={c.transferConfirm} />
								</form>
							{/if}
						</div>
					{:else}<span class="dim" aria-hidden="true">—</span>{/if}
					{#if error}<Message kind="danger">{error}</Message>{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

{#if canManage && !readOnly}
	<PersonPicker
		label={c.add}
		placeholder={c.addPlaceholder}
		findLabel={c.find}
		param="cmfind"
		tab="cocms"
		query={cmFind}
		people={candidates}
		peopleLabel={c.people}
		noMatch={c.noMatch}
		action="?/addCoCm"
		op="addCoCm"
		submit={c.addButton}
		error={resultOf(form, 'addCoCm').error}
	/>
{:else if !canManage}
	<p class="dim">{c.onlyCm}</p>
{/if}

<style>
	.actions {
		display: flex;
		gap: var(--space-2);
		justify-content: flex-end;
	}
	.actions form {
		display: contents;
	}
</style>

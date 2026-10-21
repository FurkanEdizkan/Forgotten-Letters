<script lang="ts">
	import { m } from '#lib/messages';
	import Invites from '#lib/ui/Invites.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const result = $derived(
		form
			? 'message' in form
				? { ...form, op: String(form.values?.op ?? ''), id: String(form.values?.id ?? '') }
				: form
			: null
	);
</script>

<svelte:head><title>{m.invites.heading} · {m.app.name}</title></svelte:head>

<h2>{m.invites.heading}</h2>
<Invites invites={data.invites} roles={['admin', 'user']} names={data.names} {result} />

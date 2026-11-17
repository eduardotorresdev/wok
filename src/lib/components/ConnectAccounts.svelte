<!-- Folha "Conectar contas": o usuário entra no LinkedIn/Glassdoor pelo browser remoto. -->
<script lang="ts">
	import { useQueryClient } from '@tanstack/svelte-query';
	import { api } from '#lib/client/api.ts';
	import { keys } from '#lib/client/queries.ts';
	import type { BrowserState } from '#lib/client/types.ts';
	import BrowserView from './BrowserView.svelte';
	import Sheet from './Sheet.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const client = useQueryClient();
	let last = $state<BrowserState | null>(null);

	// Ao fechar a folha, o browser é liberado, a menos que uma inscrição esteja usando.
	let wasOpen = false;
	$effect(() => {
		if (wasOpen && !open) {
			if (last?.open && !last.applicationId) {
				api.browser
					.close()
					.then((state) => client.setQueryData(keys.browser, state))
					.catch(() => {});
			} else if (last) client.setQueryData(keys.browser, last);
		}
		wasOpen = open;
	});
</script>

<Sheet
	bind:open
	title="Conectar contas"
	description="As candidaturas saem da sua conta: entre uma vez neste browser e o agente reaproveita a sessão nas próximas inscrições."
	tall
	compact={!!last?.open}
>
	{#if open}
		<BrowserView mode="control" shortcuts fit onstate={(state) => (last = state)} />
	{/if}
	{#snippet footer()}
		<button type="button" class="btn w-full" onclick={() => (open = false)}>Pronto</button>
	{/snippet}
</Sheet>

<!-- Folha "Conectar contas": o usuário entra no LinkedIn/Glassdoor pelo browser remoto. -->
<script lang="ts">
	import { useQueryClient } from '@tanstack/svelte-query';
	import { api } from '#lib/client/api.ts';
	import { keys } from '#lib/client/queries.ts';
	import type { BrowserState, Provider } from '#lib/client/types.ts';
	import BrowserView from './BrowserView.svelte';
	import Sheet from './Sheet.svelte';

	let {
		open = $bindable(false),
		provider = null,
		onconnected
	}: {
		open?: boolean;
		/** Abre a folha já no login deste site. */
		provider?: Provider | null;
		/** Uma conta passou a estar conectada enquanto a folha estava aberta. */
		onconnected?: (provider: Provider) => void;
	} = $props();

	const client = useQueryClient();
	let last = $state<BrowserState | null>(null);

	// Só avisa na virada de "não conectada" para "conectada", uma vez por conta.
	let seen: BrowserState['accounts'] | null = null;
	function watch(state: BrowserState) {
		last = state;
		for (const name of ['linkedin', 'glassdoor'] as const) {
			if (seen && !seen[name] && state.accounts[name]) {
				client.invalidateQueries({ queryKey: keys.feed });
				onconnected?.(name);
			}
		}
		seen = state.accounts;
	}

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
		if (!open) seen = null;
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
		<BrowserView mode="control" shortcuts fit start={provider} onstate={watch} />
	{/if}
	{#snippet footer()}
		<button type="button" class="btn w-full" onclick={() => (open = false)}>Pronto</button>
	{/snippet}
</Sheet>

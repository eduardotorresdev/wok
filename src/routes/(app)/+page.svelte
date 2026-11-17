<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ApiError } from '#lib/client/api.ts';
	import {
		feedQuery,
		keys,
		searchMutation,
		searchRunQuery,
		swipeMutation
	} from '#lib/client/queries.ts';
	import type { Job, SwipeDirection } from '#lib/client/types.ts';
	import Brush from '#lib/components/Brush.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import SwipeDeck from '#lib/components/SwipeDeck.svelte';
	import { toast } from '#lib/components/Toast.svelte';

	const client = useQueryClient();

	const run = createQuery(() => searchRunQuery());
	const search = createMutation(() => searchMutation(client));
	const collecting = $derived(search.isPending || run.data?.status === 'running');
	const feed = createQuery(() => feedQuery(collecting));
	const swipe = createMutation(() => swipeMutation(client));

	// Durante a busca só entram vagas já avaliadas: card sem nota nem resumo não ajuda a decidir.
	const fresh = $derived((feed.data ?? []).filter((job) => !collecting || job.matchScore !== null));
	// A ordem do servidor muda conforme as notas chegam; o card que a pessoa
	// está vendo fica no topo até ela decidir.
	let topId: string | null = null;
	const jobs = $derived.by(() => {
		const top = fresh.find((job) => job.id === topId);
		const list = top ? [top, ...fresh.filter((job) => job !== top)] : fresh;
		topId = list[0]?.id ?? null;
		return list;
	});

	// Quando a coleta termina, o feed é relido uma última vez.
	let wasCollecting = false;
	$effect(() => {
		if (wasCollecting && !collecting) client.invalidateQueries({ queryKey: keys.feed });
		wasCollecting = collecting;
	});

	let deck = $state<ReturnType<typeof SwipeDeck>>();

	// Aviso único antes da primeira inscrição.
	const WARNED = 'wok:aviso-inscricao';
	let warnOpen = $state(false);
	let warnJob = $state<Job | null>(null);

	function warned() {
		try {
			return localStorage.getItem(WARNED) === '1';
		} catch {
			return false;
		}
	}

	function allow(job: Job, direction: SwipeDirection) {
		if (direction !== 'apply' || warned()) return true;
		warnJob = job;
		warnOpen = true;
		return false;
	}

	function confirmFirstApply() {
		try {
			localStorage.setItem(WARNED, '1');
		} catch {
			// segue sem lembrar
		}
		const job = warnJob;
		warnOpen = false;
		warnJob = null;
		if (job) deck?.swipe('apply', job);
	}

	function onswipe(job: Job, direction: SwipeDirection) {
		swipe.mutate(
			{ job, direction },
			{
				onSuccess: () => {
					if (direction === 'apply') {
						toast({ text: 'Na fila do agente.', href: '/(app)/inscricoes', action: 'Acompanhar' });
					}
				},
				onError: () => {
					toast({ text: 'Não deu para registrar. A vaga voltou para a pilha.', tone: 'danger' });
				}
			}
		);
	}

	function searchMore() {
		search.mutate(undefined, {
			onError: (error) => {
				if (error instanceof ApiError && error.code === 'preferences_empty') {
					goto(resolve('/(app)/ajustes'));
					toast({ text: 'Diga o que procurar: adicione termos de busca.' });
					return;
				}
				toast({ text: 'Não deu para iniciar a busca. Tente de novo.', tone: 'danger' });
			}
		});
	}

	const runFailed = $derived(run.data?.status === 'failed' ? run.data.message : null);

	const phase = $derived.by(() => {
		if (jobs.length > 0) return 'ready';
		if (collecting) return 'collecting';
		if (feed.isPending) return 'loading';
		if (feed.isError) return 'error';
		return 'empty';
	});
</script>

<svelte:head><title>Vagas · Wok</title></svelte:head>

<div class="flex h-full flex-col">
	<header class="flex shrink-0 items-center justify-between pt-2 pr-2 pb-1 pl-5">
		<div class="flex items-baseline gap-2.5">
			<h1 class="t-headline">Vagas</h1>
			{#if phase === 'ready'}
				<p class="t-caption" aria-live="polite">
					{jobs.length}
					para ver
				</p>
			{/if}
		</div>
		<a href={resolve('/(app)/ajustes')} class="btn-icon" aria-label="Ajustar busca">
			<Icon name="sliders" />
		</a>
	</header>

	<!-- A pilha cruza a fronteira entre o papel e a faixa, sobre a pincelada. -->
	<div class="stage relative flex min-h-0 flex-1 flex-col">
		<Brush
			class="pointer-events-none absolute inset-x-[-10px] top-[16%] h-[46%] w-[calc(100%+20px)]"
		/>

		<div class="relative mx-auto min-h-0 w-full max-w-md flex-1 px-4 pt-2 pb-7">
			{#if phase === 'ready'}
				<SwipeDeck bind:this={deck} {jobs} {onswipe} {allow} />
			{:else}
				<section class="paper flex h-full flex-col justify-center px-6 py-8" aria-live="polite">
					{#if phase === 'loading'}
						<div class="space-y-3" aria-hidden="true">
							<div class="skeleton h-3 w-24"></div>
							<div class="skeleton h-8 w-full"></div>
							<div class="skeleton h-8 w-3/4"></div>
							<div class="skeleton mt-6 h-3 w-full"></div>
							<div class="skeleton h-3 w-full"></div>
							<div class="skeleton h-3 w-2/3"></div>
						</div>
						<p class="sr-only">Carregando vagas</p>
					{:else if phase === 'collecting'}
						<div class="ink-dots" aria-hidden="true"><span></span><span></span><span></span></div>
						<h2 class="t-headline mt-5 text-balance">
							{(feed.data?.length ?? 0) > 0
								? 'Avaliando as vagas encontradas'
								: 'Coletando vagas para você'}
						</h2>
						<p class="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
							O agente está lendo o LinkedIn e o Glassdoor com seus termos de busca. Costuma levar
							cerca de um minuto; pode deixar esta tela aberta.
						</p>
						{#if run.data?.status === 'running' && run.data.message}
							<p class="t-caption mt-4">{run.data.message}</p>
						{/if}
					{:else if phase === 'error'}
						<span class="text-danger"><Icon name="alert" size={28} /></span>
						<h2 class="t-headline mt-4 text-balance">Não deu para carregar as vagas</h2>
						<p class="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
							Pode ser a conexão. Suas inscrições em andamento não são afetadas.
						</p>
						<button type="button" class="btn mt-6 self-start" onclick={() => feed.refetch()}>
							<Icon name="refresh" size={20} />
							{feed.isFetching ? 'Tentando…' : 'Tentar de novo'}
						</button>
					{:else}
						<h2 class="t-headline text-balance">Você viu todas as vagas por enquanto</h2>
						<p class="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
							Peça uma nova busca ou ajuste os termos para encontrar outras.
						</p>
						{#if runFailed}
							<p class="mt-3 text-sm text-danger" role="alert">
								A última busca falhou: {runFailed}
							</p>
						{/if}
						<div class="mt-6 flex flex-col items-start gap-1">
							<button type="button" class="btn" onclick={searchMore} disabled={search.isPending}>
								<Icon name="refresh" size={20} />
								Buscar mais vagas
							</button>
							<a href={resolve('/(app)/ajustes')} class="btn btn-text -ml-3"
								>Ajustar termos de busca</a
							>
						</div>
					{/if}
				</section>
			{/if}
		</div>

		{#if phase === 'ready'}
			<div class="relative mx-auto grid w-full max-w-md shrink-0 grid-cols-2 gap-3 px-4 pb-3">
				<button type="button" class="btn btn-quiet min-h-13" onclick={() => deck?.swipe('skip')}>
					<Icon name="x" size={20} />
					Deixar pra lá
				</button>
				<button type="button" class="btn min-h-13" onclick={() => deck?.swipe('apply')}>
					Inscrever
					<Icon name="send" size={20} />
				</button>
			</div>
		{/if}
	</div>
</div>

<Sheet
	bind:open={warnOpen}
	title="Inscrever é pra valer"
	description="A candidatura é enviada em seu nome, com seu currículo adaptado para a vaga, e não pode ser desfeita."
>
	<p class="text-[0.9375rem] leading-relaxed text-ink-soft">Este aviso aparece só desta vez.</p>
	{#snippet footer()}
		<div class="grid grid-cols-2 gap-3">
			<button type="button" class="btn btn-quiet" onclick={() => (warnOpen = false)}
				>Agora não</button
			>
			<button type="button" class="btn" onclick={confirmFirstApply}>Inscrever</button>
		</div>
	{/snippet}
</Sheet>

<style>
	.stage {
		background: linear-gradient(to bottom, var(--color-paper) 0 42%, var(--color-band) 42% 100%);
	}
	.skeleton {
		border-radius: 2px;
		background: var(--color-band);
		animation: breathe 1.4s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			opacity: 0.45;
		}
	}
	.ink-dots {
		display: flex;
		gap: 8px;
	}
	.ink-dots span {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--color-primary);
		animation: ink 1.2s ease-in-out infinite;
	}
	.ink-dots span:nth-child(2) {
		animation-delay: 0.15s;
	}
	.ink-dots span:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes ink {
		0%,
		80%,
		100% {
			transform: scale(0.6);
			opacity: 0.35;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>

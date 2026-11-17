<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { relativeTime } from '#lib/client/format.ts';
	import { applicationsQuery } from '#lib/client/queries.ts';
	import type { Application } from '#lib/client/types.ts';
	import ApplicationDetail from '#lib/components/ApplicationDetail.svelte';
	import CompanyAvatar from '#lib/components/CompanyAvatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import SourceIcon from '#lib/components/SourceIcon.svelte';
	import StatusMark from '#lib/components/StatusMark.svelte';

	const applications = createQuery(() => applicationsQuery());
	const list = $derived(applications.data ?? []);

	// A seleção segue a vaga: a inscrição otimista troca de id quando o servidor responde.
	let selectedJob = $state<string | null>(null);
	let open = $state(false);
	const selected = $derived(list.find((a) => a.job.id === selectedJob) ?? null);

	const waiting = $derived(list.filter((a) => a.status === 'needs_user').length);
	const order: Record<Application['status'], number> = {
		needs_user: 0,
		applying: 1,
		tailoring: 1,
		queued: 1,
		failed: 2,
		submitted: 2
	};
	const sorted = $derived(
		[...list].sort(
			(a, b) => order[a.status] - order[b.status] || b.updatedAt.localeCompare(a.updatedAt)
		)
	);

	// /inscricoes?open=<id> (link do email e da faixa da home) abre o detalhe direto.
	let opened: string | null = null;
	$effect(() => {
		const wanted = page.url.searchParams.get('open');
		if (!wanted || wanted === opened) return;
		const target = list.find((a) => a.id === wanted);
		if (!target) return;
		opened = wanted;
		selectedJob = target.job.id;
		open = true;
	});

	function show(app: Application) {
		selectedJob = app.job.id;
		open = true;
	}
</script>

<svelte:head><title>Inscrições · Wok</title></svelte:head>

<header class="px-5 pt-2 pb-1">
	<div class="flex items-baseline gap-2.5">
		<h1 class="t-headline">Inscrições</h1>
		{#if waiting > 0}
			<p class="t-caption text-primary-deep" aria-live="polite">
				{waiting === 1 ? '1 precisa de você' : `${waiting} precisam de você`}
			</p>
		{/if}
	</div>
</header>

<div class="mx-auto max-w-md px-4 pt-2 pb-8">
	{#if applications.isPending}
		<ul class="space-y-3" aria-label="Carregando inscrições">
			{#each { length: 3 }, index (index)}
				<li class="paper h-[5.5rem] animate-pulse bg-band shadow-none"></li>
			{/each}
		</ul>
	{:else if applications.isError}
		<section class="px-1 pt-10">
			<span class="text-danger"><Icon name="alert" size={28} /></span>
			<h2 class="t-headline mt-3 text-balance">Não deu para carregar suas inscrições</h2>
			<p class="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
				O agente continua trabalhando; é só a lista que não chegou.
			</p>
			<button type="button" class="btn mt-5" onclick={() => applications.refetch()}>
				<Icon name="refresh" size={20} />
				Tentar de novo
			</button>
		</section>
	{:else if sorted.length === 0}
		<section class="px-1 pt-10">
			<h2 class="t-headline text-balance">Nenhuma inscrição ainda</h2>
			<p class="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
				Arraste uma vaga para a direita e o agente adapta seu currículo e se inscreve por você. O
				andamento aparece aqui, ao vivo.
			</p>
			<a href={resolve('/(app)')} class="btn mt-5">
				<Icon name="cards" size={20} />
				Ver vagas
			</a>
		</section>
	{:else}
		<ul class="space-y-3">
			{#each sorted as app (app.job.id)}
				<li>
					<button
						type="button"
						class="paper flex w-full items-start gap-3 p-3.5 text-left transition-transform duration-100 active:scale-[0.985]"
						onclick={() => show(app)}
					>
						<CompanyAvatar name={app.job.company} logo={app.job.companyLogo} />
						<span class="min-w-0 flex-1">
							<span class="flex items-center gap-1.5 text-[0.8125rem] text-ink-soft">
								<SourceIcon source={app.job.source} size={13} />
								<span class="truncate">{app.job.company}</span>
							</span>
							<span class="t-title mt-0.5 line-clamp-2 leading-tight">{app.job.title}</span>
							<span class="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
								<StatusMark status={app.status} />
								<span class="t-caption">{relativeTime(app.updatedAt)}</span>
							</span>
							{#if app.status === 'needs_user'}
								<span class="mt-1.5 block text-sm leading-snug">
									{app.pendingQuestion ?? app.lastMessage ?? 'Abra para ver o que falta.'}
								</span>
							{:else if app.lastMessage && app.status !== 'submitted'}
								<!-- Na fila a mensagem explica a espera (nova tentativa em 30 s): vai inteira. -->
								<span
									class="mt-1.5 block text-sm leading-snug text-ink-soft"
									class:line-clamp-1={app.status !== 'queued'}
								>
									{app.lastMessage}
								</span>
							{/if}
						</span>
						<span class="mt-2 shrink-0 text-ink-soft"><Icon name="chevron" size={18} /></span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<ApplicationDetail application={selected} bind:open />

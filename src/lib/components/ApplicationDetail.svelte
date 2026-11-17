<!--
	Detalhe de uma inscrição: status ao vivo (SSE), o browser do agente
	(assistir ou controlar), a pergunta pendente, o log de passos e o PDF adaptado.
-->
<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/env';
	import { ApiError } from '#lib/client/api.ts';
	import { clockTime, sourceLabel } from '#lib/client/format.ts';
	import {
		answerMutation,
		applicationQuery,
		putApplication,
		putStep,
		resumeApplicationMutation
	} from '#lib/client/queries.ts';
	import type { Application, Step } from '#lib/client/types.ts';
	import BrowserView from './BrowserView.svelte';
	import Icon from './Icon.svelte';
	import PdfPreview from './PdfPreview.svelte';
	import Sheet from './Sheet.svelte';
	import SourceIcon from './SourceIcon.svelte';
	import StatusMark from './StatusMark.svelte';
	import { toast } from './Toast.svelte';

	let {
		application,
		open = $bindable(false)
	}: { application: Application | null; open?: boolean } = $props();

	const client = useQueryClient();
	const id = $derived(application?.id ?? '');
	const real = $derived(!!id && !id.startsWith('optimistic-'));

	let streaming = $state(false);
	const detail = createQuery(() => applicationQuery(open ? id : '', streaming));
	const app = $derived(detail.data && detail.data.id === id ? detail.data : application);
	const all = $derived(detail.data?.id === id ? (detail.data.steps ?? []) : []);
	// A nota do ajustador (atende / lacunas / o que mudou) sai do log e ganha destaque.
	const note = $derived(all.findLast((step) => step.kind === 'tailor_note') ?? null);
	const steps = $derived(all.filter((step) => step.kind !== 'tailor_note').reverse());

	const answer = createMutation(() => answerMutation(client));
	const resume = createMutation(() => resumeApplicationMutation(client));
	let reply = $state('');

	// Status e passos chegam por SSE enquanto a folha está aberta; sem SSE, o polling cobre.
	$effect(() => {
		if (!browser || !open || !real) return;
		const target = id;
		const source = new EventSource(`/api/applications/${encodeURIComponent(target)}/events`);
		source.onopen = () => (streaming = true);
		source.onerror = () => (streaming = false);
		source.addEventListener('application', (event) => {
			putApplication(client, JSON.parse((event as MessageEvent).data) as Application);
		});
		source.addEventListener('step', (event) => {
			putStep(client, target, JSON.parse((event as MessageEvent).data) as Step);
		});
		return () => {
			source.close();
			streaming = false;
		};
	});

	const needsBrowser = $derived(app?.status === 'needs_user' && app.needsKind !== 'question');
	const needsAnswer = $derived(app?.status === 'needs_user' && app.needsKind === 'question');

	function failed(error: unknown) {
		toast({
			text:
				error instanceof ApiError && error.status === 409
					? 'Esta inscrição já saiu da pausa.'
					: 'Não deu para enviar. Tente de novo.',
			tone: 'danger'
		});
	}

	function sendAnswer() {
		const text = reply.trim();
		if (!text || !app) return;
		answer.mutate({ id: app.id, answer: text }, { onSuccess: () => (reply = ''), onError: failed });
	}

	function carryOn() {
		if (app) resume.mutate({ id: app.id }, { onError: failed });
	}

	const NOTE: Partial<Record<Application['status'], string>> = {
		queued: 'O agente pega esta inscrição assim que terminar a anterior.',
		tailoring: 'O agente está reescrevendo seu currículo para esta vaga, sempre em uma página.',
		submitted: 'Candidatura enviada em seu nome. A resposta da empresa chega no seu email.'
	};
</script>

{#if app}
	<Sheet bind:open title={app.job.title} description={app.job.company} tall>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
			<StatusMark status={app.status} />
			<a
				href={app.job.url}
				target="_blank"
				rel="noopener noreferrer external"
				class="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-soft underline decoration-line underline-offset-4"
			>
				<SourceIcon source={app.job.source} size={14} />
				Vaga no {sourceLabel(app.job.source)}
				<Icon name="external" size={14} />
			</a>
		</div>
		{#if app.lastMessage && app.status !== 'needs_user'}
			<p class="text-[0.9375rem] leading-snug" aria-live="polite">{app.lastMessage}</p>
		{/if}
		{#if NOTE[app.status]}
			<p class="mt-1 text-sm leading-snug text-ink-soft">{NOTE[app.status]}</p>
		{/if}

		{#if needsAnswer}
			<section class="mt-3 rounded-sm bg-primary-tint p-4">
				<p class="t-caption text-primary-deep">O formulário pergunta</p>
				<p class="t-title mt-1">{app.pendingQuestion}</p>
				<label for="reply" class="sr-only">Sua resposta</label>
				<textarea
					id="reply"
					class="field mt-3"
					rows="3"
					maxlength="2000"
					placeholder="Sua resposta"
					bind:value={reply}></textarea>
				<p class="t-caption mt-2">
					A resposta fica salva e o agente reutiliza nas próximas inscrições.
				</p>
			</section>
		{:else if needsBrowser}
			<section class="mt-3">
				<p class="rounded-sm bg-primary-tint p-3 text-[0.9375rem] leading-snug">
					{app.lastMessage ?? 'O site pediu login ou uma verificação.'}
					<span class="text-ink-soft">
						Resolva na tela abaixo e toque em "Continuar inscrição".
					</span>
				</p>
				<div class="mt-3"><BrowserView mode="control" takeover maxHeight={0.5} /></div>
			</section>
		{:else if app.status === 'applying'}
			<section class="mt-4">
				<h3 class="t-title">Ao vivo</h3>
				<div class="mt-2"><BrowserView mode="watch" maxHeight={0.42} /></div>
			</section>
		{:else if app.status === 'failed'}
			<p class="mt-3 rounded-sm bg-danger-tint p-3 text-[0.9375rem] leading-snug text-danger">
				A inscrição não foi enviada. Você pode tentar de novo ou abrir a vaga e se inscrever por
				conta própria.
			</p>
		{/if}

		{#if note}
			<section class="mt-5 border-l-2 border-primary pl-3.5">
				<h3 class="t-caption text-primary-deep">O que o agente fez no seu currículo</h3>
				<p class="mt-1 text-[0.9375rem] leading-relaxed whitespace-pre-line">{note.message}</p>
			</section>
		{/if}

		{#if app.tailoredPdfUrl}
			<details class="fold mt-5 border-t border-line">
				<summary class="flex min-h-12 cursor-pointer items-center justify-between font-medium">
					Currículo adaptado para esta vaga
					<span class="chev text-ink-soft"><Icon name="down" size={20} /></span>
				</summary>
				<div class="px-1 pt-1 pb-3">
					<PdfPreview url={app.tailoredPdfUrl} label="Currículo adaptado" />
					<a
						href={app.tailoredPdfUrl}
						target="_blank"
						rel="noopener external"
						class="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-deep underline decoration-primary/40 underline-offset-4"
					>
						Abrir PDF em tela cheia <Icon name="external" size={16} />
					</a>
				</div>
			</details>
		{/if}

		<section class="mt-5 border-t border-line pt-4">
			<h3 class="t-title">Passos do agente</h3>
			{#if steps.length}
				<ol class="mt-2" reversed>
					{#each steps as step, index (step.id)}
						<li class="flex gap-3 py-1.5 text-sm leading-snug">
							<span class="w-10 shrink-0 text-ink-soft tabular-nums"
								>{clockTime(step.createdAt)}</span
							>
							<span class={index === 0 ? '' : 'text-ink-soft'}>{step.message}</span>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="t-caption mt-2">
					{detail.isFetching
						? 'Carregando…'
						: 'Nenhum passo ainda. Eles aparecem aqui conforme o agente trabalha.'}
				</p>
			{/if}
		</section>

		{#snippet footer()}
			{#if needsAnswer}
				<button
					type="button"
					class="btn w-full"
					disabled={!reply.trim() || answer.isPending}
					onclick={sendAnswer}
				>
					Responder e continuar
				</button>
			{:else if needsBrowser}
				<button type="button" class="btn w-full" disabled={resume.isPending} onclick={carryOn}>
					Continuar inscrição
				</button>
			{:else if app.status === 'failed'}
				<button type="button" class="btn w-full" disabled={resume.isPending} onclick={carryOn}>
					<Icon name="refresh" size={20} />
					Tentar de novo
				</button>
			{:else}
				<button type="button" class="btn btn-quiet w-full" onclick={() => (open = false)}>
					Fechar
				</button>
			{/if}
		{/snippet}
	</Sheet>
{/if}

<style>
	.fold summary {
		list-style: none;
	}
	.fold summary::-webkit-details-marker {
		display: none;
	}
	.fold[open] .chev {
		transform: rotate(180deg);
	}
</style>

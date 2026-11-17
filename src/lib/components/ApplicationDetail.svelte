<!--
	Detalhe de uma inscrição: status ao vivo (SSE), o browser do agente
	(assistir ou controlar), a pergunta pendente, o log de passos e o PDF adaptado.
-->
<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { browser } from '$app/env';
	import { resolve } from '$app/paths';
	import { ApiError } from '#lib/client/api.ts';
	import { applyViaLabel, clockTime, sourceLabel } from '#lib/client/format.ts';
	import {
		doNotClaimMutation,
		answerMutation,
		markSubmittedMutation,
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
	const markSubmitted = createMutation(() => markSubmittedMutation(client));

	// "Isso não é verdade": a frase vai para "O que não afirmar" do perfil profissional.
	const doNotClaim = createMutation(() => doNotClaimMutation(client));
	let claimOpen = $state(false);
	let claim = $state('');
	let claimNoted = $state(false);

	function sendClaim(event: SubmitEvent) {
		event.preventDefault();
		const statement = claim.trim();
		if (!statement || doNotClaim.isPending) return;
		doNotClaim.mutate(statement, {
			onSuccess: () => {
				claim = '';
				claimOpen = false;
				claimNoted = true;
			},
			onError: () => toast({ text: 'Não deu para anotar. Tente de novo.', tone: 'danger' })
		});
	}
	const via = $derived(app ? applyViaLabel(app.job) : null);
	let offsite = $state<HTMLElement>();

	function markDone() {
		if (!app) return;
		markSubmitted.mutate(
			{ id: app.id },
			{
				onSuccess: () => toast({ text: 'Marcada como enviada.' }),
				onError: () =>
					toast({ text: 'Não deu para marcar como enviada. Tente de novo.', tone: 'danger' })
			}
		);
	}
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

	const waiting = $derived(app?.status === 'needs_user');
	const needsAnswer = $derived(waiting && app?.needsKind === 'question' && !!app.pendingQuestion);
	// Currículo base não compila ou o ajuste não coube em uma página: conserta-se no editor.
	const needsResume = $derived(
		waiting &&
			(app?.needsKind === 'resume' || (app?.needsKind === 'question' && !app.pendingQuestion))
	);
	const needsBrowser = $derived(waiting && !needsAnswer && !needsResume);

	// Retomada automática: a verificação sumiu da tela e o agente seguiu sozinho.
	let resumedAlone = $state(false);
	let before: { id: string; waiting: boolean } | null = null;
	$effect(() => {
		const now = { id, waiting: needsBrowser };
		if (
			before?.id === now.id &&
			before.waiting &&
			!now.waiting &&
			!resume.isPending &&
			!markSubmitted.isPending
		) {
			resumedAlone = app?.status === 'applying' || app?.status === 'submitted';
		} else if (before?.id !== now.id || now.waiting) {
			resumedAlone = false;
		}
		before = now;
	});

	function failed(error: unknown) {
		toast({
			text:
				error instanceof ApiError && error.status === 409
					? 'Esta inscrição já saiu da pausa.'
					: 'Não deu para enviar. Tente de novo.',
			tone: 'danger'
		});
	}

	// O tipo da pergunta escolhe o teclado e, para sim/não, oferece as respostas prontas.
	const ask = $derived.by(() => {
		const q = (app?.pendingQuestion ?? '').toLowerCase();
		if (/telefone|celular|whatsapp|phone|\bddd\b/.test(q)) return 'tel';
		if (
			/sal[aá]ri|pretens|remunera|salary|compensation|quantos anos|anos de experi|how many years/.test(
				q
			)
		)
			return 'number';
		if (
			/\(sim\s*\/\s*n[aã]o\)|yes\s*\/\s*no|^(você|voce)\s+(tem|possui|é|está|esta|aceita|pode|já|ja|precisa|concorda|mora|trabalha|fala|gostaria)\b|^(tem|possui|aceita|pode|está|é|há|existe)\b|^(do|are|have|is|will|can|would|did)\s+you\b/.test(
				q
			)
		)
			return 'yesno';
		return 'text';
	});

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
	<Sheet bind:open title={app.job.title} description={app.job.company} tall compact={needsBrowser}>
		<!-- Com o visor aberto, o cabeçalho encolhe: a altura é da página remota. -->
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1" class:hidden={needsBrowser}>
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
		{#if via && !needsBrowser}
			<p class="t-caption mb-2 flex items-center gap-1.5"><Icon name="send" size={14} />{via}</p>
		{/if}
		{#if app.lastMessage && app.status !== 'needs_user'}
			<p class="text-[0.9375rem] leading-snug" aria-live="polite">{app.lastMessage}</p>
		{/if}
		{#if NOTE[app.status]}
			<p class="mt-1 text-sm leading-snug text-ink-soft">{NOTE[app.status]}</p>
		{/if}

		{#if resumedAlone}
			<p
				class="mt-3 flex items-center gap-2 rounded-sm bg-primary-tint p-3 text-[0.9375rem] font-medium"
				role="status"
			>
				<span class="text-primary"><Icon name="check" size={18} stroke={2.4} /></span>
				Pronto, o agente continuou.
			</p>
		{/if}

		{#if needsAnswer}
			<section class="mt-3 rounded-sm bg-primary-tint p-4">
				<p class="t-caption text-primary-deep">O formulário pergunta</p>
				<p class="t-title mt-1">{app.pendingQuestion}</p>
				<form
					onsubmit={(event) => {
						event.preventDefault();
						sendAnswer();
					}}
				>
					{#if ask === 'yesno'}
						<div class="mt-3 flex gap-2">
							{#each ['Sim', 'Não'] as option (option)}
								<button
									type="button"
									class="chip flex-1 justify-center"
									aria-pressed={reply.trim() === option}
									onclick={() => (reply = option)}
								>
									{option}
								</button>
							{/each}
						</div>
					{/if}
					<label for="reply" class="sr-only">Sua resposta</label>
					{#if ask === 'tel' || ask === 'number'}
						<input
							id="reply"
							class="field mt-3"
							type={ask === 'tel' ? 'tel' : 'text'}
							inputmode={ask === 'tel' ? 'tel' : 'decimal'}
							autocomplete={ask === 'tel' ? 'tel' : 'off'}
							enterkeyhint="send"
							maxlength="200"
							placeholder={ask === 'tel' ? '(11) 91234-5678' : 'Sua resposta'}
							bind:value={reply}
						/>
					{:else}
						<textarea
							id="reply"
							class="field mt-3"
							rows={ask === 'yesno' ? 2 : 3}
							maxlength="2000"
							enterkeyhint="send"
							placeholder={ask === 'yesno' ? 'Ou escreva sua resposta' : 'Sua resposta'}
							bind:value={reply}
							onkeydown={(event) => {
								// Enter envia; Shift+Enter quebra a linha.
								if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
									event.preventDefault();
									sendAnswer();
								}
							}}></textarea>
					{/if}
				</form>
				<p class="t-caption mt-2">
					A resposta fica salva e o agente reutiliza nas próximas inscrições.
				</p>
			</section>
		{:else if needsResume}
			<section class="mt-3 rounded-sm bg-primary-tint p-4">
				<p class="text-[0.9375rem] leading-snug">
					{app.lastMessage ?? 'O currículo precisa de um ajuste antes de seguir.'}
				</p>
				<a href={resolve('/(app)/curriculo')} class="btn btn-quiet mt-3">
					<Icon name="doc" size={20} />
					Abrir currículo
				</a>
			</section>
		{:else if needsBrowser}
			<section>
				<p class="line-clamp-3 rounded-sm bg-primary-tint px-3 py-2 text-sm leading-snug">
					{app.lastMessage ?? 'O site pediu login ou uma verificação.'}
					<span class="text-ink-soft">Resolva abaixo e toque em "Continuar inscrição".</span>
				</p>
				<div class="mt-2">
					<BrowserView
						mode="control"
						takeover
						fit
						applicationId={app.id}
						fallbackUrl={app.job.url}
					/>
				</div>
				<!-- Saída sem o visor: a pessoa se inscreve no site e avisa aqui. -->
				<div class="mt-5 border-t border-line pt-4" bind:this={offsite}>
					<h3 class="t-title">Prefere fazer pelo site?</h3>
					<p class="mt-1 text-sm leading-snug text-ink-soft">
						Abra a vaga, envie o currículo adaptado e marque aqui quando terminar.
					</p>
					<div class="mt-3 flex flex-col gap-2">
						<a
							href={app.job.url}
							target="_blank"
							rel="noopener noreferrer external"
							class="btn btn-quiet"
						>
							<Icon name="external" size={20} />
							Abrir a vaga no site
						</a>
						{#if app.tailoredPdfUrl}
							<a
								href={app.tailoredPdfUrl}
								download="curriculo.pdf"
								rel="external"
								class="btn btn-quiet"
							>
								<Icon name="doc" size={20} />
								Baixar currículo adaptado
							</a>
						{/if}
						<button
							type="button"
							class="btn btn-quiet"
							disabled={markSubmitted.isPending}
							onclick={markDone}
						>
							<Icon name="check" size={20} />
							Já me inscrevi por lá
						</button>
					</div>
				</div>
			</section>
		{:else if app.status === 'applying'}
			<section class="mt-4">
				<h3 class="t-title">Ao vivo</h3>
				<div class="mt-2"><BrowserView mode="watch" maxHeight={0.42} applicationId={app.id} /></div>
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
				{#if claimNoted}
					<p class="t-caption mt-2 flex items-center gap-1.5" role="status">
						<span class="text-primary"><Icon name="check" size={16} stroke={2.4} /></span>
						Anotado no seu perfil. O agente não vai mais afirmar isso.
					</p>
				{/if}
				{#if claimOpen}
					<form class="mt-2" onsubmit={sendClaim}>
						<label for="claim-{app.id}" class="t-label block"
							>O que o agente não deve afirmar?</label
						>
						<div class="mt-2 flex gap-2">
							<input
								id="claim-{app.id}"
								class="field min-w-0 flex-1"
								autocomplete="off"
								enterkeyhint="send"
								maxlength={300}
								placeholder="ex.: não liderei esse time"
								bind:value={claim}
							/>
							<button
								type="submit"
								class="btn shrink-0"
								disabled={!claim.trim() || doNotClaim.isPending}
							>
								{doNotClaim.isPending ? 'Anotando…' : 'Anotar'}
							</button>
						</div>
					</form>
				{:else}
					<button
						type="button"
						class="mt-1 min-h-11 text-sm font-medium text-primary-deep underline decoration-primary/40 underline-offset-4"
						onclick={() => {
							claimOpen = true;
							claimNoted = false;
						}}
					>
						{claimNoted ? 'Anotar outra coisa' : 'Isso não é verdade / não quero que afirme'}
					</button>
				{/if}
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
			{:else if needsResume}
				<button type="button" class="btn w-full" disabled={resume.isPending} onclick={carryOn}>
					<Icon name="refresh" size={20} />
					Tentar de novo
				</button>
			{:else if needsBrowser}
				<div class="flex gap-2">
					<button
						type="button"
						class="btn btn-quiet shrink-0 px-4"
						onclick={() => offsite?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
					>
						Fazer pelo site
					</button>
					<button
						type="button"
						class="btn min-w-0 flex-1 px-3"
						disabled={resume.isPending}
						onclick={carryOn}
					>
						Continuar inscrição
					</button>
				</div>
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

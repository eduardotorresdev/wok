<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		answerProfileDocMutation,
		draftProblem,
		draftProfileDocMutation,
		profileDocQuery,
		saveProfileDocMutation
	} from '#lib/client/queries.ts';
	import type { ProfileQuestion } from '#lib/client/types.ts';
	import Icon from '#lib/components/Icon.svelte';
	import Markdown from '#lib/components/Markdown.svelte';
	import ProfileTabs from '#lib/components/ProfileTabs.svelte';
	import { toast } from '#lib/components/Toast.svelte';

	const client = useQueryClient();
	const doc = createQuery(() => profileDocQuery());
	const save = createMutation(() => saveProfileDocMutation(client));
	const draft = createMutation(() => draftProfileDocMutation(client));
	const answer = createMutation(() => answerProfileDocMutation(client));

	const OUTLINE = [
		'# Perfil profissional',
		'## Contato',
		'## Momento profissional',
		'## Experiência',
		'## O que não afirmar'
	].join('\n\n');

	let text = $state('');
	let seeded = $state(false);
	let view = $state<'edit' | 'read'>('edit');
	/** O texto na tela é um rascunho gerado que ainda não foi salvo. */
	let drafted = $state(false);

	$effect(() => {
		if (doc.data && !seeded) {
			text = doc.data.markdown;
			seeded = true;
		}
	});

	const saved = $derived(doc.data?.markdown ?? '');
	const dirty = $derived(seeded && text !== saved);
	const questions = $derived(doc.data?.questions ?? []);

	function saveNow() {
		const sent = text;
		save.mutate(sent, {
			onSuccess: (stored) => {
				if (text !== sent) return;
				drafted = false;
				// O servidor pode normalizar o texto; a tela passa a mostrar o que ficou salvo.
				text = stored.markdown;
			},
			onError: () =>
				toast({ text: 'Não deu para salvar. Seu texto continua aqui.', tone: 'danger' })
		});
	}

	function generate() {
		draft.mutate(undefined, {
			onSuccess: (result) => {
				text = result.markdown;
				drafted = true;
				view = 'edit';
			},
			onError: (error) => toast({ text: draftProblem(error), tone: 'danger' })
		});
	}

	let replies = $state<Record<string, string>>({});
	let sending = $state<string | null>(null);

	function reply(question: ProfileQuestion) {
		const value = (replies[question.id] ?? '').trim();
		if (!value || sending) return;
		// A resposta entra no documento salvo: texto por salvar seria sobrescrito.
		if (dirty) {
			toast({ text: 'Salve o perfil antes de responder.' });
			return;
		}
		sending = question.id;
		answer.mutate(
			{ questionId: question.id, answer: value },
			{
				onSuccess: (updated) => {
					text = updated.markdown;
					delete replies[question.id];
					toast({ text: 'Resposta incluída no perfil.' });
				},
				onError: () =>
					toast({ text: 'Não deu para incluir a resposta. Tente de novo.', tone: 'danger' }),
				onSettled: () => (sending = null)
			}
		);
	}
</script>

<svelte:head><title>Perfil profissional · Wok</title></svelte:head>

<div class="flex h-full flex-col">
	<ProfileTabs />

	<div class="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
		<h2 class="t-title">Perfil profissional</h2>
		<p class="mt-1 text-[0.9375rem] leading-snug text-ink-soft">
			O agente só escreve o que está aqui; o que faltar, ele pergunta a você.
		</p>

		{#if doc.isPending}
			<div class="mt-4 h-72 animate-pulse rounded-sm bg-band" aria-label="Carregando perfil"></div>
		{:else if doc.isError}
			<p class="t-title mt-6">Não deu para carregar o perfil</p>
			<button type="button" class="btn mt-4" onclick={() => doc.refetch()}>
				<Icon name="refresh" size={20} /> Tentar de novo
			</button>
		{:else}
			<div class="mt-4 flex items-center justify-between gap-3">
				<div class="flex rounded-md bg-band p-0.5" role="tablist" aria-label="Modo">
					{#each [['edit', 'Editar'], ['read', 'Ver']] as const as [value, label] (value)}
						<button
							type="button"
							role="tab"
							aria-selected={view === value}
							class="min-h-10 rounded-[6px] px-4 text-sm font-medium transition-colors duration-150 {view ===
							value
								? 'bg-paper text-ink shadow-paper'
								: 'text-ink-soft'}"
							onclick={() => (view = value)}
						>
							{label}
						</button>
					{/each}
				</div>
				<p class="t-caption flex items-center gap-1.5" aria-live="polite">
					{#if save.isPending}
						Salvando…
					{:else if drafted && dirty}
						Rascunho, ainda não salvo
					{:else if dirty}
						Alterações por salvar
					{:else if saved}
						<span class="text-primary"><Icon name="check" size={16} stroke={2.4} /></span> Salvo
					{/if}
				</p>
			</div>

			{#if view === 'edit'}
				<textarea
					class="doc mt-3 w-full rounded-sm bg-band p-3 outline-none focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
					aria-label="Perfil profissional em markdown"
					autocapitalize="sentences"
					placeholder={OUTLINE}
					maxlength={60000}
					bind:value={text}></textarea>
			{:else if text.trim()}
				<div class="paper mt-3 px-4 py-4"><Markdown source={text} /></div>
			{:else}
				<p class="mt-6 text-[0.9375rem] text-ink-soft">
					O perfil está vazio. Escreva em Editar ou gere um rascunho a partir do currículo.
				</p>
			{/if}

			<div class="mt-3 grid gap-2">
				<button
					type="button"
					class="btn w-full"
					disabled={!dirty || save.isPending}
					onclick={saveNow}
				>
					{save.isPending ? 'Salvando…' : dirty ? 'Salvar perfil' : 'Perfil salvo'}
				</button>
				<button
					type="button"
					class="btn btn-quiet w-full"
					disabled={draft.isPending}
					onclick={generate}
				>
					<Icon name="refresh" size={20} />
					{draft.isPending ? 'Lendo seu currículo…' : 'Gerar rascunho a partir do currículo'}
				</button>
				{#if draft.isPending}
					<div class="progress" role="progressbar" aria-label="Gerando rascunho"><span></span></div>
					<p class="t-caption">Costuma levar uns 10 segundos. Pode continuar nesta tela.</p>
				{:else}
					<p class="t-caption">
						{text.trim()
							? 'O rascunho substitui o texto acima e só vale depois de salvo.'
							: 'Leva uns 10 segundos. O rascunho só vale depois de salvo.'}
					</p>
				{/if}
			</div>

			{#if questions.length > 0}
				<section class="mt-8">
					<h2 class="t-title">Perguntas que deixam seu perfil melhor</h2>
					<p class="mt-1 text-[0.9375rem] leading-snug text-ink-soft">
						Cada resposta é incluída no documento acima.
					</p>
					<ul class="mt-3 grid gap-4">
						{#each questions as question (question.id)}
							<li>
								<form
									onsubmit={(event) => {
										event.preventDefault();
										reply(question);
									}}
								>
									<label for="q-{question.id}" class="t-label block leading-snug"
										>{question.text}</label
									>
									{#if question.hint}<p class="t-caption mt-0.5">{question.hint}</p>{/if}
									<div class="mt-2 flex gap-2">
										<input
											id="q-{question.id}"
											class="field min-w-0 flex-1"
											autocomplete="off"
											enterkeyhint="send"
											placeholder="Sua resposta"
											bind:value={replies[question.id]}
										/>
										<button
											type="submit"
											class="btn shrink-0"
											disabled={!(replies[question.id] ?? '').trim() || sending !== null}
										>
											{sending === question.id ? 'Incluindo…' : 'Incluir'}
										</button>
									</div>
								</form>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/if}
	</div>
</div>

<style>
	/* Progresso estimado: enche em ~12 s e espera perto do fim. */
	.progress {
		height: 3px;
		border-radius: 2px;
		background: var(--color-band);
		overflow: hidden;
	}
	.progress span {
		display: block;
		height: 100%;
		background: var(--color-primary);
		transform-origin: left;
		animation: fill 12s cubic-bezier(0.2, 0.6, 0.3, 1) forwards;
	}
	@keyframes fill {
		from {
			transform: scaleX(0.03);
		}
		to {
			transform: scaleX(0.94);
		}
	}
	.doc {
		display: block;
		min-height: 24rem;
		height: 55vh;
		font-family: var(--font-mono);
		/* 16px: abaixo disso o iOS dá zoom ao focar. */
		font-size: 1rem;
		line-height: 1.5;
		resize: none;
		-webkit-overflow-scrolling: touch;
	}
</style>

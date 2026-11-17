<!--
	Passo do onboarding: gerar o rascunho do perfil profissional a partir do currículo
	e responder algumas perguntas. Tudo aqui é opcional.
-->
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
	import Icon from './Icon.svelte';
	import Markdown from './Markdown.svelte';

	let {
		waiting = false
	}: {
		/** O currículo ainda está sendo salvo: o rascunho precisa dele. */
		waiting?: boolean;
	} = $props();

	const client = useQueryClient();
	const doc = createQuery(() => profileDocQuery());
	const save = createMutation(() => saveProfileDocMutation(client));
	const draft = createMutation(() => draftProfileDocMutation(client));
	const answer = createMutation(() => answerProfileDocMutation(client));

	/** Rascunho gerado e ainda não salvo. */
	let pending = $state<string | null>(null);
	let problem = $state<string | null>(null);
	let replies = $state<Record<string, string>>({});
	let sending = $state<string | null>(null);

	const saved = $derived(doc.data?.markdown ?? '');
	const shown = $derived(pending ?? saved);
	const questions = $derived(
		pending === null && saved ? (doc.data?.questions ?? []).slice(0, 4) : []
	);

	function generate() {
		problem = null;
		draft.mutate(undefined, {
			onSuccess: (result) => (pending = result.markdown),
			onError: (error) => (problem = `${draftProblem(error)} Você também pode seguir em frente.`)
		});
	}

	/** Salva o rascunho que estiver na tela. O onboarding chama ao continuar. */
	export async function flush() {
		if (pending === null) return;
		const text = pending;
		problem = null;
		try {
			await save.mutateAsync(text);
			if (pending === text) pending = null;
		} catch {
			problem = 'Não deu para salvar o rascunho. Você pode gerar de novo depois, em Perfil.';
		}
	}

	function reply(question: ProfileQuestion) {
		const value = (replies[question.id] ?? '').trim();
		if (!value || sending) return;
		sending = question.id;
		problem = null;
		answer.mutate(
			{ questionId: question.id, answer: value },
			{
				onSuccess: () => delete replies[question.id],
				onError: () => (problem = 'Não deu para incluir a resposta. Tente de novo.'),
				onSettled: () => (sending = null)
			}
		);
	}
</script>

<p class="mt-4 leading-relaxed text-ink-soft">
	O perfil profissional reúne os fatos sobre você. O agente só escreve o que está nele; o que
	faltar, ele pergunta. Pode pular e fazer depois em Perfil.
</p>

{#if shown.trim()}
	<div class="paper mt-5 max-h-72 overflow-y-auto px-4 py-4"><Markdown source={shown} /></div>
	{#if pending !== null}
		<button type="button" class="btn mt-3 w-full" disabled={save.isPending} onclick={flush}>
			{save.isPending ? 'Salvando…' : 'Salvar e responder perguntas'}
		</button>
		<p class="t-caption mt-2">O rascunho só vale depois de salvo. Você edita depois em Perfil.</p>
	{:else}
		<p class="t-caption mt-2 flex items-center gap-1.5">
			<span class="text-primary"><Icon name="check" size={16} stroke={2.4} /></span>
			Salvo. Você edita depois em Perfil.
		</p>
	{/if}
{:else}
	<button
		type="button"
		class="btn mt-5 w-full"
		disabled={draft.isPending || waiting}
		onclick={generate}
	>
		<Icon name="refresh" size={20} />
		{#if waiting}Salvando seu currículo…{:else if draft.isPending}Lendo seu currículo…{:else}Gerar
			rascunho a partir do currículo{/if}
	</button>
	{#if draft.isPending}
		<div class="progress mt-3" role="progressbar" aria-label="Gerando rascunho"><span></span></div>
	{/if}
	<p class="t-caption mt-2">Costuma levar uns 10 segundos.</p>
{/if}

{#if problem}<p class="mt-3 text-sm text-danger" role="alert">{problem}</p>{/if}

{#if questions.length > 0}
	<section class="mt-8">
		<h2 class="t-title">Perguntas que deixam seu perfil melhor</h2>
		<p class="mt-1 text-sm leading-snug text-ink-soft">Responda as que quiser.</p>
		<ul class="mt-3 grid gap-4">
			{#each questions as question (question.id)}
				<li>
					<form
						onsubmit={(event) => {
							event.preventDefault();
							reply(question);
						}}
					>
						<label for="oq-{question.id}" class="t-label block leading-snug">{question.text}</label>
						{#if question.hint}<p class="t-caption mt-0.5">{question.hint}</p>{/if}
						<div class="mt-2 flex gap-2">
							<input
								id="oq-{question.id}"
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

<style>
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
</style>

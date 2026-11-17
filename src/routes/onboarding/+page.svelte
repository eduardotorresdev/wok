<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		compileResumeMutation,
		preferencesQuery,
		profileQuery,
		resumeQuery,
		savePreferencesMutation,
		saveProfileMutation,
		saveResumeMutation,
		searchMutation
	} from '#lib/client/queries.ts';
	import { emptyPreferences, emptyProfile } from '#lib/client/types.ts';
	import ConnectAccounts from '#lib/components/ConnectAccounts.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PreferencesFields from '#lib/components/PreferencesFields.svelte';
	import ProfileFields from '#lib/components/ProfileFields.svelte';
	import TexUpload from '#lib/components/TexUpload.svelte';
	import Underline from '#lib/components/Underline.svelte';

	const client = useQueryClient();
	const resume = createQuery(() => resumeQuery());
	const preferences = createQuery(() => preferencesQuery());
	const profileData = createQuery(() => profileQuery());

	const saveResume = createMutation(() => saveResumeMutation(client));
	const compile = createMutation(() => compileResumeMutation(client));
	const savePreferences = createMutation(() => savePreferencesMutation(client));
	const saveProfile = createMutation(() => saveProfileMutation(client));
	const search = createMutation(() => searchMutation(client));

	const STEPS = 4;
	let step = $state(0);
	let latex = $state('');
	let fileName = $state<string | null>(null);
	let prefs = $state(emptyPreferences());
	let profile = $state(emptyProfile());
	let error = $state<string | null>(null);
	let finishing = $state(false);
	let connectOpen = $state(false);
	let scroller = $state<HTMLElement>();

	// Quem volta ao onboarding encontra o que já tinha salvo.
	let seeded = { resume: false, prefs: false, profile: false };
	$effect(() => {
		if (!seeded.resume && resume.data) {
			seeded.resume = true;
			if (!latex) latex = resume.data.latex;
		}
		if (!seeded.prefs && preferences.data) {
			seeded.prefs = true;
			prefs = { ...emptyPreferences(), ...$state.snapshot(preferences.data) };
		}
		if (!seeded.profile && profileData.data) {
			seeded.profile = true;
			profile = { ...emptyProfile(), ...$state.snapshot(profileData.data) };
		}
	});

	function validate(): string | null {
		if (step === 0) {
			if (!latex.trim()) return 'Cole o LaTeX do currículo ou envie o arquivo .tex.';
			if (!/\\documentclass/.test(latex)) {
				return 'Falta o \\documentclass: envie o arquivo .tex completo, não só um trecho.';
			}
		}
		if (step === 1 && prefs.terms.length === 0) return 'Adicione pelo menos um termo de busca.';
		if (step === 2 && !prefs.area.trim()) return 'Escolha sua área.';
		return null;
	}

	function go(to: number) {
		step = to;
		error = null;
		scroller?.scrollTo({ top: 0 });
	}

	function next() {
		error = validate();
		if (error) return;
		if (step === 0 && latex !== resume.data?.latex) {
			// Salva e já compila em segundo plano; o resultado aparece em Perfil.
			saveResume.mutate(latex, { onSuccess: () => compile.mutate(undefined) });
		}
		if (step === 2) savePreferences.mutate($state.snapshot(prefs));
		if (step < STEPS - 1) go(step + 1);
		else finish(true);
	}

	async function finish(withProfile: boolean) {
		finishing = true;
		error = null;
		try {
			if (withProfile) await saveProfile.mutateAsync($state.snapshot(profile));
			// As preferências precisam estar gravadas antes de a busca começar.
			if (savePreferences.isPending || !preferences.data?.updatedAt) {
				await savePreferences.mutateAsync($state.snapshot(prefs));
			}
			await search.mutateAsync().catch(() => null);
			await goto(resolve('/(app)'), { replaceState: true });
		} catch {
			error = 'Não deu para salvar. Confira a conexão e tente de novo.';
		} finally {
			finishing = false;
		}
	}

	const TITLES = ['Comece pelo', 'O que você', 'Sua área e', 'Dados para'];
	const KEYWORDS = ['currículo', 'procura', 'nível', 'inscrição'];
</script>

<svelte:head><title>Primeiros passos · Wok</title></svelte:head>

<div class="mx-auto flex h-dvh max-w-md flex-col">
	<header
		class="flex shrink-0 items-center gap-3 px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-2"
	>
		<p class="font-serif text-2xl leading-none">wok</p>
		<ol class="ml-auto flex gap-1.5" aria-label="Passo {step + 1} de {STEPS}">
			{#each { length: STEPS }, index (index)}
				<li
					class="h-1 w-7 rounded-[1px] transition-colors duration-200 {index <= step
						? 'bg-primary'
						: 'bg-line'}"
					aria-hidden="true"
				></li>
			{/each}
		</ol>
	</header>

	<main bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-8">
		<p class="t-caption">Passo {step + 1} de {STEPS}</p>
		<h1 class="t-display mt-1 text-[2.125rem]">
			{TITLES[step]}
			<Underline>{KEYWORDS[step]}</Underline>
		</h1>

		{#if step === 0}
			<p class="mt-4 leading-relaxed text-ink-soft">
				Cole o código LaTeX ou envie o arquivo .tex. O agente adapta este texto para cada vaga,
				sempre em uma página.
			</p>
			<TexUpload
				class="btn btn-quiet mt-5 w-full"
				onload={(text, name) => {
					latex = text;
					fileName = name;
					error = null;
				}}
				onerror={(message) => (error = message)}
			>
				<Icon name="upload" size={20} />
				{fileName ? `Trocar arquivo (${fileName})` : 'Enviar arquivo .tex'}
			</TexUpload>
			<label for="latex" class="t-label mt-5 block">Ou cole aqui</label>
			<textarea
				id="latex"
				class="field code mt-2"
				rows="9"
				spellcheck="false"
				autocapitalize="none"
				autocomplete="off"
				placeholder={'\\documentclass{article}\n\\begin{document}\n…\n\\end{document}'}
				bind:value={latex}></textarea>
			{#if latex.trim()}
				<p class="t-caption mt-2">{latex.split('\n').length} linhas</p>
			{/if}
		{:else if step === 1}
			<p class="mt-4 mb-6 leading-relaxed text-ink-soft">
				O agente usa estes termos para coletar vagas no LinkedIn e no Glassdoor.
			</p>
			<PreferencesFields bind:prefs part="search" />
		{:else if step === 2}
			<p class="mt-4 mb-6 leading-relaxed text-ink-soft">
				Cada área tem seu jeito de escrever currículo. Isso ajusta como o agente adapta o seu.
			</p>
			<PreferencesFields bind:prefs part="area" />
		{:else}
			<p class="mt-4 mb-6 leading-relaxed text-ink-soft">
				O agente usa estes dados para preencher formulários de candidatura. Pode pular e completar
				depois em Perfil.
			</p>
			<ProfileFields bind:profile compact />
			<div class="mt-8 rounded-sm bg-band p-4">
				<p class="font-medium">Conectar LinkedIn e Glassdoor</p>
				<p class="mt-1 text-sm leading-snug text-ink-soft">
					As candidaturas saem da sua conta. Pode entrar agora ou quando o agente pedir.
				</p>
				<button type="button" class="btn btn-quiet mt-3" onclick={() => (connectOpen = true)}>
					<Icon name="globe" size={20} />
					Conectar contas
				</button>
			</div>
		{/if}
	</main>

	<footer
		class="shrink-0 border-t border-line bg-paper px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
	>
		{#if error}<p class="mb-2 text-sm text-danger" role="alert">{error}</p>{/if}
		<div class="flex gap-2">
			{#if step > 0}
				<button
					type="button"
					class="btn btn-quiet shrink-0 px-3.5"
					aria-label="Voltar"
					disabled={finishing}
					onclick={() => go(step - 1)}
				>
					<Icon name="back" size={20} />
				</button>
			{/if}
			{#if step === STEPS - 1}
				<button
					type="button"
					class="btn btn-quiet flex-1"
					disabled={finishing}
					onclick={() => finish(false)}
				>
					Pular
				</button>
			{/if}
			<button type="button" class="btn flex-1" disabled={finishing} onclick={next}>
				{#if finishing}Salvando…{:else if step === STEPS - 1}Buscar vagas{:else}Continuar{/if}
			</button>
		</div>
	</footer>
</div>

<ConnectAccounts bind:open={connectOpen} />

<style>
	.code {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		line-height: 1.5;
		white-space: pre;
		overflow-x: auto;
		resize: none;
	}
</style>

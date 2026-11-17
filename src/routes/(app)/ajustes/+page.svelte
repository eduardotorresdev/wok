<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ApiError } from '#lib/client/api.ts';
	import { authClient } from '#lib/client/auth.ts';
	import {
		answersQuery,
		browserStateQuery,
		deleteAnswerMutation,
		preferencesQuery,
		profileQuery,
		savePreferencesMutation,
		saveProfileMutation,
		searchMutation
	} from '#lib/client/queries.ts';
	import { emptyPreferences, emptyProfile } from '#lib/client/types.ts';
	import ConnectAccounts from '#lib/components/ConnectAccounts.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import SourceIcon from '#lib/components/SourceIcon.svelte';
	import PreferencesFields from '#lib/components/PreferencesFields.svelte';
	import ProfileFields from '#lib/components/ProfileFields.svelte';
	import ProfileTabs from '#lib/components/ProfileTabs.svelte';
	import { toast } from '#lib/components/Toast.svelte';

	const client = useQueryClient();
	const preferences = createQuery(() => preferencesQuery());
	const profileData = createQuery(() => profileQuery());
	const answers = createQuery(() => answersQuery());
	const savePreferences = createMutation(() => savePreferencesMutation(client));
	const saveProfile = createMutation(() => saveProfileMutation(client));
	const deleteAnswer = createMutation(() => deleteAnswerMutation(client));
	const search = createMutation(() => searchMutation(client));
	const session = authClient.useSession();
	const remote = createQuery(() => browserStateQuery());
	let connectOpen = $state(false);

	let prefs = $state(emptyPreferences());
	let profile = $state(emptyProfile());
	let seeded = $state({ prefs: false, profile: false });
	let leaving = $state(false);

	$effect(() => {
		if (!seeded.prefs && preferences.data) {
			seeded.prefs = true;
			prefs = { ...emptyPreferences(), ...$state.snapshot(preferences.data) };
		}
		if (!seeded.profile && profileData.data) {
			seeded.profile = true;
			profile = { ...emptyProfile(), ...$state.snapshot(profileData.data) };
		}
	});

	const same = (a: unknown, b: unknown) =>
		JSON.stringify({ ...(a as object), updatedAt: 0 }) ===
		JSON.stringify({ ...(b as object), updatedAt: 0 });
	const prefsDirty = $derived(
		seeded.prefs && !same(prefs, { ...emptyPreferences(), ...preferences.data })
	);
	const profileDirty = $derived(
		seeded.profile && !same(profile, { ...emptyProfile(), ...profileData.data })
	);

	const failed = () => toast({ text: 'Não deu para salvar. Tente de novo.', tone: 'danger' });

	function savePrefs() {
		savePreferences.mutate($state.snapshot(prefs), {
			onSuccess: () => toast({ text: 'Busca salva.' }),
			onError: failed
		});
	}

	// Vale na hora, sem depender do botão de salvar os outros dados.
	function setNotify(value: boolean) {
		if (!profileData.data) return;
		profile.notifyEmail = value;
		saveProfile.mutate(
			{ ...emptyProfile(), ...$state.snapshot(profileData.data), notifyEmail: value },
			{
				onSuccess: () =>
					toast({ text: value ? 'Vamos avisar por email.' : 'Avisos por email desligados.' }),
				onError: () => {
					profile.notifyEmail = !value;
					failed();
				}
			}
		);
	}

	function saveData() {
		saveProfile.mutate($state.snapshot(profile), {
			onSuccess: (saved) => {
				if (saved) profile = { ...emptyProfile(), ...saved };
				toast({ text: 'Dados salvos.' });
			},
			onError: failed
		});
	}

	async function searchNow() {
		try {
			if (prefsDirty) await savePreferences.mutateAsync($state.snapshot(prefs));
			await search.mutateAsync();
			await goto(resolve('/(app)'));
		} catch (error) {
			toast({
				text:
					error instanceof ApiError && error.code === 'preferences_empty'
						? 'Adicione um termo de busca ou uma área antes.'
						: 'Não deu para iniciar a busca. Tente de novo.',
				tone: 'danger'
			});
		}
	}

	async function signOut() {
		leaving = true;
		try {
			await authClient.signOut();
		} finally {
			client.clear();
			location.assign('/login');
		}
	}
</script>

<svelte:head><title>Busca e dados · Wok</title></svelte:head>

<ProfileTabs />

<div class="mx-auto max-w-md px-5 pt-6 pb-10">
	<section aria-labelledby="busca">
		<h2 id="busca" class="t-title">Busca de vagas</h2>
		{#if preferences.isPending}
			<div class="mt-4 h-40 animate-pulse rounded-sm bg-band"></div>
		{:else}
			<div class="mt-4"><PreferencesFields bind:prefs /></div>
			<div class="mt-6 grid grid-cols-2 gap-2">
				<button
					type="button"
					class="btn btn-quiet"
					disabled={!prefsDirty || savePreferences.isPending}
					onclick={savePrefs}
				>
					{prefsDirty ? 'Salvar' : 'Salvo'}
				</button>
				<button type="button" class="btn" disabled={search.isPending} onclick={searchNow}>
					<Icon name="refresh" size={20} />
					Buscar vagas
				</button>
			</div>
		{/if}
	</section>

	<section class="mt-12" aria-labelledby="dados">
		<h2 id="dados" class="t-title">Dados para inscrição</h2>
		<p class="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">
			O agente usa estes dados para preencher formulários. Tudo é opcional.
		</p>
		{#if profileData.isPending}
			<div class="mt-4 h-40 animate-pulse rounded-sm bg-band"></div>
		{:else}
			<div class="mt-5"><ProfileFields bind:profile /></div>
			<button
				type="button"
				class="btn mt-6 w-full"
				disabled={!profileDirty || saveProfile.isPending}
				onclick={saveData}
			>
				{profileDirty ? 'Salvar dados' : 'Dados salvos'}
			</button>
		{/if}
	</section>

	<section class="mt-12" aria-labelledby="contas">
		<h2 id="contas" class="t-title">Contas conectadas</h2>
		<p class="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">
			As candidaturas saem da sua conta: entre uma vez e o agente reaproveita a sessão.
		</p>
		<ul class="mt-3 divide-y divide-line border-y border-line">
			{#each [['linkedin', 'LinkedIn'], ['glassdoor', 'Glassdoor']] as const as [key, label] (key)}
				<li class="flex min-h-12 items-center gap-2.5">
					<SourceIcon source={key} size={18} />
					<span class="flex-1">{label}</span>
					{#if remote.data?.accounts[key]}
						<span class="inline-flex items-center gap-1 text-sm font-medium text-primary-deep">
							<Icon name="check" size={16} stroke={2.4} /> Conectada
						</span>
					{:else}
						<span class="text-sm text-ink-soft">Não conectada</span>
					{/if}
				</li>
			{/each}
		</ul>
		<button type="button" class="btn btn-quiet mt-4" onclick={() => (connectOpen = true)}>
			<Icon name="globe" size={20} />
			Conectar contas
		</button>
	</section>

	<section class="mt-12" aria-labelledby="respostas">
		<h2 id="respostas" class="t-title">Respostas salvas</h2>
		<p class="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">
			Perguntas de formulário que você já respondeu. O agente reutiliza nas próximas inscrições.
		</p>
		{#if answers.data?.length}
			<ul class="mt-3 divide-y divide-line border-y border-line">
				{#each answers.data as item (item.id)}
					<li class="flex items-start gap-2 py-3">
						<div class="min-w-0 flex-1">
							<p class="text-sm leading-snug text-ink-soft">{item.question}</p>
							<p class="mt-1 leading-snug">{item.answer}</p>
						</div>
						<button
							type="button"
							class="btn-icon shrink-0"
							aria-label="Apagar resposta: {item.question}"
							onclick={() => deleteAnswer.mutate(item.id, { onError: failed })}
						>
							<Icon name="trash" size={20} />
						</button>
					</li>
				{/each}
			</ul>
		{:else if !answers.isPending}
			<p class="t-caption mt-3">Nenhuma ainda. Elas aparecem quando o agente perguntar algo.</p>
		{/if}
	</section>

	<section class="mt-12" aria-labelledby="conta">
		<h2 id="conta" class="t-title">Conta</h2>
		{#if $session.data?.user.email}
			<p class="mt-1 text-[0.9375rem] [overflow-wrap:anywhere] text-ink-soft">
				{$session.data.user.email}
			</p>
		{/if}
		{#if profileData.data?.notifyEmail !== undefined}
			<label class="check mt-3">
				<input
					type="checkbox"
					checked={profile.notifyEmail ?? true}
					onchange={(event) => setNotify(event.currentTarget.checked)}
				/>
				<span>
					Avisar por email quando precisar de mim
					<span class="t-caption block">
						Login, verificação ou pergunta que só você sabe responder.
					</span>
				</span>
			</label>
		{/if}
		<button type="button" class="btn btn-quiet mt-4" disabled={leaving} onclick={signOut}>
			<Icon name="logout" size={20} />
			{leaving ? 'Saindo…' : 'Sair'}
		</button>
	</section>
</div>

<ConnectAccounts bind:open={connectOpen} />

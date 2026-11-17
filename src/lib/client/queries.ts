import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/svelte-query';
import { browser } from '$app/env';
import { ApiError, api } from './api.ts';
import type {
	Application,
	Job,
	Preferences,
	Profile,
	ProfileDoc,
	Resume,
	SavedAnswer,
	Step,
	SwipeDirection
} from './types.ts';

export const keys = {
	feed: ['jobs', 'feed'] as const,
	searchRun: ['jobs', 'search-run'] as const,
	applications: ['applications'] as const,
	application: (id: string) => ['applications', id] as const,
	preferences: ['preferences'] as const,
	resume: ['resume'] as const,
	profile: ['profile'] as const,
	answers: ['profile', 'answers'] as const,
	profileDoc: ['profile', 'document'] as const,
	browser: ['browser', 'state'] as const
};

const LIVE: Application['status'][] = ['queued', 'tailoring', 'applying'];
export const isLive = (app: Application) => LIVE.includes(app.status);

export const feedQuery = (collecting = false) =>
	queryOptions({
		queryKey: keys.feed,
		queryFn: api.jobs.feed,
		enabled: browser,
		// Enquanto a coleta roda no servidor, as vagas vão chegando aos poucos.
		refetchInterval: collecting ? 4000 : false
	});

/** Progresso da coleta em segundo plano (POST /api/jobs/search responde na hora). */
export const searchRunQuery = () =>
	queryOptions({
		queryKey: keys.searchRun,
		queryFn: async () => (await api.jobs.run()).run,
		enabled: browser,
		refetchInterval: (query) => (query.state.data?.status === 'running' ? 2500 : false)
	});

export const applicationsQuery = () =>
	queryOptions({
		queryKey: keys.applications,
		queryFn: api.applications.list,
		enabled: browser,
		refetchInterval: (query) => (query.state.data?.some(isLive) ? 3000 : 20_000)
	});

/** `streaming` desliga o polling quando o SSE da inscrição está conectado. */
export const applicationQuery = (id: string, streaming = false) =>
	queryOptions({
		queryKey: keys.application(id),
		queryFn: () => api.applications.get(id),
		// Inscrição otimista ainda não existe no servidor.
		enabled: browser && !!id && !id.startsWith('optimistic-'),
		refetchInterval: (query) =>
			!streaming && query.state.data && isLive(query.state.data) ? 2500 : false
	});

export const browserStateQuery = () =>
	queryOptions({ queryKey: keys.browser, queryFn: () => api.browser.state(), enabled: browser });

export const profileQuery = () =>
	queryOptions({
		queryKey: keys.profile,
		queryFn: api.profile.get,
		enabled: browser,
		staleTime: 60_000
	});

export const answersQuery = () =>
	queryOptions({ queryKey: keys.answers, queryFn: api.profile.answers, enabled: browser });

export const saveProfileMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: ['profile', 'save'],
		mutationFn: (profile: Profile) => api.profile.save(profile),
		onMutate: async (profile) => {
			await client.cancelQueries({ queryKey: keys.profile, exact: true });
			const previous = client.getQueryData<Profile>(keys.profile);
			client.setQueryData<Profile>(keys.profile, profile);
			return { previous };
		},
		onError: (_error, _profile, context) => {
			client.setQueryData(keys.profile, context?.previous);
		},
		onSuccess: (saved) => {
			if (saved) client.setQueryData(keys.profile, saved);
		}
	});

export const profileDocQuery = () =>
	queryOptions({
		queryKey: keys.profileDoc,
		queryFn: api.profile.doc.get,
		enabled: browser,
		staleTime: 60_000,
		// Em servidor que ainda não tem o documento, a aba simplesmente não aparece.
		retry: false
	});

export const saveProfileDocMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: ['profile', 'document', 'save'],
		mutationFn: (markdown: string) => api.profile.doc.save(markdown),
		onMutate: async (markdown) => {
			await client.cancelQueries({ queryKey: keys.profileDoc, exact: true });
			const previous = client.getQueryData<ProfileDoc>(keys.profileDoc);
			client.setQueryData<ProfileDoc>(keys.profileDoc, (old) =>
				old ? { ...old, markdown } : { markdown, updatedAt: null, questions: [] }
			);
			return { previous };
		},
		onError: (_error, _markdown, context) => {
			client.setQueryData(keys.profileDoc, context?.previous);
		},
		onSuccess: (saved) => {
			if (saved) client.setQueryData(keys.profileDoc, saved);
		}
	});

export const draftProfileDocMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: ['profile', 'document', 'draft'],
		mutationFn: () => api.profile.doc.draft(),
		// O rascunho não é salvo, mas o servidor grava as perguntas que ele levantou.
		onSuccess: () => client.invalidateQueries({ queryKey: keys.profileDoc })
	});

/** Por que o rascunho não saiu, em palavras de quem usa. */
export function draftProblem(error: unknown) {
	if (error instanceof ApiError && error.code === 'nothing_to_draft') {
		return 'Salve seu currículo primeiro: o rascunho é feito a partir dele.';
	}
	if (error instanceof ApiError && error.code === 'llm_unavailable') {
		return 'O agente está indisponível agora. Tente de novo em alguns minutos.';
	}
	return 'Não deu para gerar o rascunho. Tente de novo.';
}

export const doNotClaimMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: ['profile', 'document', 'do-not-claim'],
		mutationFn: (statement: string) => api.profile.doc.doNotClaim(statement),
		onSuccess: (saved) => {
			if (saved) client.setQueryData(keys.profileDoc, saved);
		}
	});

export const answerProfileDocMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: ['profile', 'document', 'answer'],
		mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) =>
			api.profile.doc.answer(questionId, answer),
		onSuccess: (saved) => {
			if (saved) client.setQueryData(keys.profileDoc, saved);
		}
	});

export const deleteAnswerMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: ['profile', 'answers', 'delete'],
		mutationFn: (id: string) => api.profile.deleteAnswer(id),
		onMutate: async (id) => {
			await client.cancelQueries({ queryKey: keys.answers });
			const previous = client.getQueryData<SavedAnswer[]>(keys.answers);
			client.setQueryData<SavedAnswer[]>(keys.answers, (old) => old?.filter((a) => a.id !== id));
			return { previous };
		},
		onError: (_error, _id, context) => {
			client.setQueryData(keys.answers, context?.previous);
		},
		onSettled: () => client.invalidateQueries({ queryKey: keys.answers })
	});

/** Grava uma inscrição nos dois caches (lista e detalhe), preservando os passos já vistos. */
export function putStep(client: QueryClient, id: string, step: Step) {
	client.setQueryData<Application>(keys.application(id), (old) =>
		old && !old.steps?.some((s) => s.id === step.id)
			? { ...old, steps: [...(old.steps ?? []), step].sort((a, b) => a.id - b.id) }
			: old
	);
}

export function putApplication(client: QueryClient, app: Application) {
	client.setQueryData<Application[]>(keys.applications, (old) =>
		old?.map((a) => (a.id === app.id ? { ...a, ...app, steps: undefined } : a))
	);
	client.setQueryData<Application>(keys.application(app.id), (old) => ({
		...old,
		...app,
		steps: app.steps ?? old?.steps
	}));
}

/** Responder a pergunta ou continuar: a inscrição volta para a fila na hora. */
const requeue = (
	client: QueryClient,
	key: string,
	run: (id: string, answer: string) => Promise<Application>,
	optimistic: Partial<Application> = { status: 'queued', lastMessage: 'Retomando a inscrição.' }
) =>
	mutationOptions({
		mutationKey: ['applications', key],
		mutationFn: ({ id, answer = '' }: { id: string; answer?: string }) => run(id, answer),
		onMutate: async ({ id }) => {
			await client.cancelQueries({ queryKey: keys.applications });
			const previous = client
				.getQueryData<Application[]>(keys.applications)
				?.find((a) => a.id === id);
			if (previous) {
				putApplication(client, {
					...previous,
					needsKind: null,
					pendingQuestion: null,
					updatedAt: new Date().toISOString(),
					...optimistic
				});
			}
			return { previous };
		},
		onError: (_error, _vars, context) => {
			if (context?.previous) putApplication(client, context.previous);
		},
		onSuccess: (app) => {
			if (app) putApplication(client, app);
		},
		onSettled: () => client.invalidateQueries({ queryKey: keys.applications })
	});

export const answerMutation = (client: QueryClient) =>
	requeue(client, 'answer', (id, answer) => api.applications.answer(id, answer));

export const resumeApplicationMutation = (client: QueryClient) =>
	requeue(client, 'resume', (id) => api.applications.resume(id));

export const markSubmittedMutation = (client: QueryClient) =>
	requeue(client, 'mark-submitted', (id) => api.applications.markSubmitted(id), {
		status: 'submitted',
		lastMessage: 'Você se inscreveu pelo site.'
	});

export const preferencesQuery = () =>
	queryOptions({
		queryKey: keys.preferences,
		queryFn: api.preferences.get,
		enabled: browser,
		staleTime: 60_000
	});

export const resumeQuery = () =>
	queryOptions({
		queryKey: keys.resume,
		queryFn: api.resume.get,
		enabled: browser,
		staleTime: 60_000
	});

const SWIPE = ['jobs', 'swipe'] as const;

/** Swipe otimista: o card sai do feed na hora; se a API falhar, ele volta ao topo. */
export const swipeMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: SWIPE,
		mutationFn: ({ job, direction }: { job: Job; direction: SwipeDirection }) =>
			api.jobs.swipe(job.id, direction),
		onMutate: async ({ job, direction }) => {
			await client.cancelQueries({ queryKey: keys.feed });
			client.setQueryData<Job[]>(keys.feed, (old) => old?.filter((j) => j.id !== job.id));

			const optimisticId = `optimistic-${job.id}`;
			if (direction === 'apply') {
				await client.cancelQueries({ queryKey: keys.applications, exact: true });
				client.setQueryData<Application[]>(keys.applications, (old) =>
					old
						? [
								{
									id: optimisticId,
									job,
									status: 'queued',
									tailoredPdfUrl: null,
									lastMessage: 'Na fila do agente',
									needsKind: null,
									pendingQuestion: null,
									createdAt: new Date().toISOString(),
									updatedAt: new Date().toISOString()
								},
								...old
							]
						: old
				);
			}
			return { optimisticId };
		},
		onError: (_error, { job }, context) => {
			// Devolve só este card: outros swipes podem estar em voo.
			client.setQueryData<Job[]>(keys.feed, (old) =>
				old && !old.some((j) => j.id === job.id) ? [job, ...old] : old
			);
			client.setQueryData<Application[]>(keys.applications, (old) =>
				old?.filter((a) => a.id !== context?.optimisticId)
			);
		},
		onSettled: (_data, _error, { direction }) => {
			// Com vários swipes em sequência, só o último revalida: evita o card "voltar".
			if (client.isMutating({ mutationKey: SWIPE }) > 1) return;
			client.invalidateQueries({ queryKey: keys.feed });
			if (direction === 'apply') client.invalidateQueries({ queryKey: keys.applications });
		}
	});

export const searchMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: ['jobs', 'search'],
		mutationFn: api.jobs.search,
		onSuccess: ({ run }) => {
			client.setQueryData(keys.searchRun, run);
			client.invalidateQueries({ queryKey: keys.feed });
		}
	});

export const savePreferencesMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: ['preferences', 'save'],
		mutationFn: (prefs: Preferences) => api.preferences.save(prefs),
		onMutate: async (prefs) => {
			await client.cancelQueries({ queryKey: keys.preferences });
			const previous = client.getQueryData<Preferences>(keys.preferences);
			client.setQueryData<Preferences>(keys.preferences, prefs);
			return { previous };
		},
		onError: (_error, _prefs, context) => {
			client.setQueryData(keys.preferences, context?.previous);
		},
		onSuccess: (saved) => {
			if (saved) client.setQueryData(keys.preferences, saved);
		},
		onSettled: () => client.invalidateQueries({ queryKey: keys.preferences })
	});

export const saveResumeMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: ['resume', 'save'],
		mutationFn: (latex: string) => api.resume.save(latex),
		onMutate: async (latex) => {
			await client.cancelQueries({ queryKey: keys.resume });
			const previous = client.getQueryData<Resume>(keys.resume);
			client.setQueryData<Resume>(keys.resume, (old) => ({
				latex,
				// O PDF anterior deixa de valer assim que a fonte muda.
				pages: old?.latex === latex ? (old?.pages ?? null) : null,
				pdfUrl: old?.latex === latex ? (old?.pdfUrl ?? null) : null,
				updatedAt: new Date().toISOString()
			}));
			return { previous };
		},
		onError: (_error, _latex, context) => {
			client.setQueryData(keys.resume, context?.previous);
		},
		onSuccess: (saved) => {
			if (saved) client.setQueryData(keys.resume, saved);
		}
	});

export const compileResumeMutation = (client: QueryClient) =>
	mutationOptions({
		mutationKey: ['resume', 'compile'],
		mutationFn: (latex?: string) => api.resume.compile(latex),
		onSuccess: (result, latex) => {
			client.setQueryData<Resume>(keys.resume, (old) =>
				old
					? {
							...old,
							latex: latex ?? old.latex,
							pages: result.ok ? result.pages : null,
							pdfUrl: result.pdfUrl
						}
					: old
			);
		}
	});

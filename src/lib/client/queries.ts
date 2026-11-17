import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/svelte-query';
import { browser } from '$app/env';
import { api } from './api.ts';
import type { Application, Job, Preferences, Resume, SwipeDirection } from './types.ts';

export const keys = {
	feed: ['jobs', 'feed'] as const,
	searchRun: ['jobs', 'search-run'] as const,
	applications: ['applications'] as const,
	application: (id: string) => ['applications', id] as const,
	preferences: ['preferences'] as const,
	resume: ['resume'] as const,
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

export const applicationQuery = (id: string) =>
	queryOptions({
		queryKey: keys.application(id),
		queryFn: () => api.applications.get(id),
		enabled: browser && !!id
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

<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { latexErrors } from '#lib/client/format.ts';
	import { compileResumeMutation, resumeQuery, saveResumeMutation } from '#lib/client/queries.ts';
	import Icon from '#lib/components/Icon.svelte';
	import PdfPreview from '#lib/components/PdfPreview.svelte';
	import PageMark from '#lib/components/PageMark.svelte';
	import ProfileTabs from '#lib/components/ProfileTabs.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import TexUpload from '#lib/components/TexUpload.svelte';
	import { toast } from '#lib/components/Toast.svelte';

	const client = useQueryClient();
	const resume = createQuery(() => resumeQuery());
	const save = createMutation(() => saveResumeMutation(client));
	const compile = createMutation(() => compileResumeMutation(client));

	let view = $state<'editor' | 'pdf'>('editor');
	let latex = $state('');
	let seeded = $state(false);
	let logOpen = $state(false);

	$effect(() => {
		if (!seeded && resume.data) {
			seeded = true;
			latex = resume.data.latex;
		}
	});

	const dirty = $derived(seeded && latex !== (resume.data?.latex ?? ''));
	const busy = $derived(save.isPending || compile.isPending);
	const pages = $derived(dirty ? null : (resume.data?.pages ?? null));
	const pdfUrl = $derived(resume.data?.pdfUrl ?? null);
	const failure = $derived(compile.data && !compile.data.ok && !dirty ? compile.data : null);
	const canCompile = $derived(!!latex.trim() && !busy && (dirty || pages === null));

	function saveAndCompile() {
		const source = latex;
		const afterSave = () =>
			compile.mutate(undefined, {
				onSuccess: (result) => {
					if (!result.ok) return;
					if (result.pages === 1) {
						view = 'pdf';
					} else {
						toast({
							text: `Ficou com ${result.pages} páginas. Precisa caber em uma.`,
							tone: 'danger'
						});
					}
				},
				onError: () => toast({ text: 'Não deu para compilar. Tente de novo.', tone: 'danger' })
			});
		if (source === resume.data?.latex) afterSave();
		else {
			save.mutate(source, {
				onSuccess: afterSave,
				onError: () =>
					toast({ text: 'Não deu para salvar. Seu texto continua aqui.', tone: 'danger' })
			});
		}
	}

	// O servidor pode mandar as mensagens já inteiras; senão elas são remontadas do log.
	const errorLines = $derived(
		failure
			? failure.errors?.trim()
				? failure.errors.trim().split('\n')
				: latexErrors(failure.log)
			: []
	);

	let copied = $state(false);
	async function copyLog() {
		try {
			await navigator.clipboard.writeText(failure?.log ?? '');
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast({ text: 'Não deu para copiar. Selecione o texto e copie à mão.', tone: 'danger' });
		}
	}
</script>

<svelte:head><title>Currículo · Wok</title></svelte:head>

<div class="flex h-full flex-col">
	<ProfileTabs />

	<div class="flex shrink-0 items-center justify-between gap-3 px-5 pt-3">
		<PageMark {pages} busy={compile.isPending} />
		<div class="flex rounded-md bg-band p-0.5" role="tablist" aria-label="Ver">
			{#each [['editor', 'LaTeX'], ['pdf', 'PDF']] as const as [value, label] (value)}
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
	</div>

	{#if !dirty && pages !== null && pages > 1}
		<p
			class="mx-5 mt-3 rounded-sm bg-danger-tint px-3 py-2.5 text-sm leading-snug text-danger"
			role="alert"
		>
			Seu currículo tem {pages} páginas. O Wok só envia currículos de uma página: corte conteúdo e compile
			de novo.
		</p>
	{/if}

	{#if failure}
		<div
			class="mx-5 mt-3 rounded-sm bg-danger-tint px-3 py-2.5 text-sm leading-snug text-danger"
			role="alert"
		>
			<p class="font-medium">O LaTeX não compilou.</p>
			{#if failure.explanation}
				<p class="mt-1 text-[0.9375rem] leading-snug font-medium text-ink">{failure.explanation}</p>
			{/if}
			{#each errorLines as line (line)}
				<p class="mt-1.5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
					{line}
				</p>
			{/each}
			<button
				type="button"
				class="mt-1 min-h-11 font-medium underline underline-offset-4"
				onclick={() => (logOpen = true)}>Ver log completo</button
			>
		</div>
	{/if}

	<div class="min-h-0 flex-1 px-5 pt-3 pb-3">
		{#if resume.isPending}
			<div class="h-full animate-pulse rounded-sm bg-band" aria-label="Carregando currículo"></div>
		{:else if resume.isError}
			<div class="flex h-full flex-col items-start justify-center">
				<p class="t-title">Não deu para carregar o currículo</p>
				<button type="button" class="btn mt-4" onclick={() => resume.refetch()}>
					<Icon name="refresh" size={20} /> Tentar de novo
				</button>
			</div>
		{:else if view === 'editor'}
			<textarea
				class="code h-full w-full rounded-sm bg-band p-3 outline-none focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
				aria-label="Código LaTeX do currículo"
				spellcheck="false"
				autocapitalize="none"
				autocomplete="off"
				placeholder="Cole aqui o LaTeX do seu currículo"
				bind:value={latex}></textarea>
		{:else if pdfUrl && !dirty}
			<div class="h-full overflow-y-auto px-1 pt-1 pb-2">
				<PdfPreview url={pdfUrl} />
				<a
					href={pdfUrl}
					target="_blank"
					rel="noopener external"
					class="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-deep underline decoration-primary/40 underline-offset-4"
				>
					Abrir PDF em tela cheia <Icon name="external" size={16} />
				</a>
			</div>
		{:else}
			<div class="flex h-full flex-col items-start justify-center">
				<p class="t-title">{dirty ? 'O PDF está desatualizado' : 'Ainda não há PDF'}</p>
				<p class="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
					{latex.trim()
						? 'Salve e compile para ver como o currículo fica em uma página.'
						: 'Cole o LaTeX do currículo na aba LaTeX para começar.'}
				</p>
			</div>
		{/if}
	</div>

	<div class="flex shrink-0 gap-2 border-t border-line px-5 py-3">
		<TexUpload
			class="btn btn-quiet shrink-0 px-3.5"
			onload={(text) => {
				latex = text;
				view = 'editor';
			}}
			onerror={(message) => toast({ text: message, tone: 'danger' })}
		>
			<Icon name="upload" size={20} />
			<span class="sr-only">Enviar arquivo .tex</span>
		</TexUpload>
		<button type="button" class="btn flex-1" disabled={!canCompile} onclick={saveAndCompile}>
			{#if save.isPending}Salvando…{:else if compile.isPending}Compilando…{:else if dirty || pages === null}Salvar
				e compilar{:else}Salvo e compilado{/if}
		</button>
	</div>
</div>

<Sheet bind:open={logOpen} title="Log do LaTeX" tall>
	<pre
		class="font-mono text-xs leading-relaxed break-words whitespace-pre-wrap select-text">{failure?.log ??
			''}</pre>
	{#snippet footer()}
		<button type="button" class="btn btn-quiet w-full" onclick={copyLog}>
			<Icon name={copied ? 'check' : 'doc'} size={20} />
			{copied ? 'Copiado' : 'Copiar log'}
		</button>
	{/snippet}
</Sheet>

<style>
	.code {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		line-height: 1.55;
		white-space: pre;
		overflow: auto;
		resize: none;
		-webkit-overflow-scrolling: touch;
	}
</style>

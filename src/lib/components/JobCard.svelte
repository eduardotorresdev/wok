<!--
	Card de vaga: uma folha de papel pousada, com frente e verso.
	Frente: o essencial para decidir. Verso: os detalhes, com rolagem.
	`lean` (-1..1) revela o carimbo do gesto.
-->
<script lang="ts">
	import type { Job } from '#lib/client/types.ts';
	import {
		applyViaLabel,
		blockedProvider,
		PROVIDER_NAME,
		relativeTime,
		scorePercent,
		sourceLabel
	} from '#lib/client/format.ts';
	import CompanyAvatar from './CompanyAvatar.svelte';
	import Icon from './Icon.svelte';
	import ScoreMark from './ScoreMark.svelte';
	import SourceIcon from './SourceIcon.svelte';

	let {
		job,
		lean = 0,
		interactive = true,
		flipped = false,
		onflip
	}: {
		job: Job;
		lean?: number;
		interactive?: boolean;
		flipped?: boolean;
		onflip?: (flipped: boolean) => void;
	} = $props();

	const posted = $derived(relativeTime(job.postedAt));
	const via = $derived(applyViaLabel(job));
	const blocked = $derived(blockedProvider(job));

	// Altura livre para o resumo, medida no card; 22.5px é a linha do resumo (15px × 1.5).
	const LINE = 22.5;
	let room = $state(0);
	const lines = $derived(Math.min(5, Math.floor((room + 0.5) / LINE)));
	const hasScore = $derived(scorePercent(job.matchScore) !== null);
</script>

{#snippet tick(size: number)}
	<svg
		class="mt-0.5 shrink-0"
		width={size}
		height={size}
		viewBox="0 0 16 16"
		fill="none"
		aria-hidden="true"
	>
		<path
			d="M2.5 8.8c1.6 1 2.6 2.2 3.4 3.8 1.8-4 4-6.8 7.6-9.4"
			stroke="var(--color-primary)"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{/snippet}

{#snippet connect()}
	{#if blocked}
		<p
			class="mt-1 flex shrink-0 items-center gap-1.5 text-[0.8125rem] leading-snug font-medium text-primary-deep"
		>
			<Icon name="alert" size={14} />Conecte o {PROVIDER_NAME[blocked]} para se inscrever
		</p>
	{/if}
{/snippet}

{#snippet source()}
	<p class="t-caption flex items-center gap-1.5">
		<SourceIcon source={job.source} size={14} />
		<span
			>{sourceLabel(job.source)}{#if posted}<span class="sep"></span>{posted}{/if}</span
		>
	</p>
{/snippet}

<div class="card" class:flipped>
	<div class="leaf">
		<!-- Frente -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
		<article
			class="paper face front flex flex-col px-5 pt-4 pb-3"
			inert={flipped || !interactive}
			onclick={() => onflip?.(true)}
		>
			<header class="flex shrink-0 items-start justify-between gap-3">
				<div class="flex min-w-0 items-center gap-3">
					<CompanyAvatar name={job.company} logo={job.companyLogo} />
					<div class="min-w-0">
						<p class="truncate text-[0.9375rem] leading-tight font-medium">{job.company}</p>
						<div class="mt-1">{@render source()}</div>
					</div>
				</div>
				<ScoreMark score={job.matchScore} />
			</header>

			<h2 class="title mt-4 shrink-0 font-serif">{job.title}</h2>

			<p class="mt-2 shrink-0 truncate text-[0.9375rem] leading-snug text-ink-soft">
				{job.location ?? 'Local não informado'}{#if job.salary}<span class="sep"></span><span
						class="text-ink">{job.salary}</span
					>{/if}
			</p>

			{#if via && !blocked}
				<p class="t-caption mt-1 flex shrink-0 items-center gap-1.5">
					<Icon name="send" size={14} />{via}
				</p>
			{/if}
			{@render connect()}

			<!-- O resumo ocupa o que sobrar, em linhas inteiras: nada é cortado no meio. -->
			<div class="mt-3 min-h-0 flex-1 overflow-hidden" bind:clientHeight={room}>
				{#if job.summary && lines > 0}
					<p
						class="summary text-[0.9375rem]"
						style="-webkit-line-clamp: {lines}; line-clamp: {lines}"
					>
						{job.summary}
					</p>
				{/if}
			</div>

			<div class="shrink-0">
				{#if job.matchReasons.length}
					<ul class="space-y-1.5 border-t border-line pt-3">
						{#each job.matchReasons.slice(0, job.summary ? 3 : 4) as reason (reason)}
							<li class="flex gap-2 text-sm leading-snug">
								{@render tick(16)}
								<span class="reason">{reason}</span>
							</li>
						{/each}
					</ul>
				{/if}
				<button
					type="button"
					class="mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-medium text-ink-soft"
				>
					<span class="underline decoration-line underline-offset-4">Ver detalhes</span>
					<Icon name="flip" size={16} />
				</button>
			</div>
		</article>

		<!-- Verso -->
		<article class="paper face back flex flex-col" inert={!flipped || !interactive}>
			<header class="flex shrink-0 items-center gap-3 border-b border-line py-2 pr-2 pl-5">
				<CompanyAvatar name={job.company} logo={job.companyLogo} size={32} />
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm leading-tight font-medium">{job.company}</p>
					<p class="t-caption truncate">{job.title}</p>
				</div>
				<button
					type="button"
					class="btn-icon shrink-0"
					aria-label="Voltar para a frente do card"
					onclick={() => onflip?.(false)}
				>
					<Icon name="flip" />
				</button>
			</header>

			<div class="scroll min-h-0 flex-1 px-5 pt-4 pb-5">
				<h2 class="t-headline text-balance">{job.title}</h2>
				<p class="mt-2 text-[0.9375rem] leading-snug text-ink-soft">
					{job.location ?? 'Local não informado'}{#if job.salary}<span class="sep"></span><span
							class="text-ink">{job.salary}</span
						>{/if}
				</p>
				<div class="mt-2">{@render source()}</div>
				{#if via && !blocked}
					<p class="t-caption mt-1 flex items-center gap-1.5">
						<Icon name="send" size={14} />{via}
					</p>
				{/if}
				{@render connect()}

				{#if hasScore}
					<section class="mt-5 flex items-center gap-3.5 rounded-sm bg-band p-3.5">
						<ScoreMark score={job.matchScore} size={56} />
						<p class="text-sm leading-snug">
							<span class="font-medium">Afinidade com seu currículo.</span>
							<span class="text-ink-soft"
								>Quanto do que a vaga pede já está no que você enviou.</span
							>
						</p>
					</section>
				{/if}

				{#if job.matchReasons.length}
					<section class="mt-5">
						<h3 class="t-title">Por que combina</h3>
						<ul class="mt-2 space-y-2">
							{#each job.matchReasons as reason (reason)}
								<li class="flex gap-2.5 text-[0.9375rem] leading-snug">
									{@render tick(18)}
									<span>{reason}</span>
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				{#if job.summary}
					<section class="mt-5">
						<h3 class="t-title">Resumo</h3>
						<p class="mt-2 text-[0.9375rem] leading-relaxed whitespace-pre-line">{job.summary}</p>
					</section>
				{/if}

				<a
					href={job.url}
					target="_blank"
					rel="noopener noreferrer external"
					class="mt-4 inline-flex min-h-11 items-center gap-2 font-medium text-primary-deep underline decoration-primary/40 underline-offset-4"
				>
					<SourceIcon source={job.source} />
					Ver vaga original no {sourceLabel(job.source)}
					<Icon name="external" size={18} />
				</a>
			</div>
		</article>
	</div>

	{#if lean !== 0}
		<div
			class="stamp stamp-apply"
			style="opacity: {Math.max(0, lean)}; transform: rotate(-9deg) scale({0.9 +
				Math.max(0, lean) * 0.1})"
			aria-hidden="true"
		>
			Inscrever
		</div>
		<div
			class="stamp stamp-skip"
			style="opacity: {Math.max(0, -lean)}; transform: rotate(8deg) scale({0.9 +
				Math.max(0, -lean) * 0.1})"
			aria-hidden="true"
		>
			Deixar pra lá
		</div>
	{/if}
</div>

<style>
	.card {
		position: relative;
		height: 100%;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.leaf {
		position: relative;
		height: 100%;
	}
	/*
		As duas faces giram juntas e trocam de visibilidade no meio do giro (90°),
		sem depender de backface-visibility, que falha no WebKit com overflow.
	*/
	.face {
		position: absolute;
		inset: 0;
		overflow: hidden;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		transition:
			transform 480ms cubic-bezier(0.45, 0, 0.55, 1),
			visibility 0s linear 240ms,
			box-shadow 200ms;
	}
	.front {
		transform: perspective(1400px) rotateY(0deg);
	}
	.back {
		transform: perspective(1400px) rotateY(-180deg);
		visibility: hidden;
	}
	.flipped .front {
		transform: perspective(1400px) rotateY(180deg);
		visibility: hidden;
	}
	.flipped .back {
		transform: perspective(1400px) rotateY(0deg);
		visibility: visible;
	}
	.scroll {
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		touch-action: pan-y;
	}
	.title {
		font-size: clamp(1.625rem, 7.6vw, 2rem);
		line-height: 1.08;
		letter-spacing: -0.015em;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-wrap: balance;
	}
	.summary {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 22.5px;
	}
	.reason {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	/* Em telas baixas o card encolhe por linhas inteiras, nunca no meio de uma. */
	.front {
		container-type: size;
	}
	@container (max-height: 450px) {
		.reason {
			-webkit-line-clamp: 1;
			line-clamp: 1;
		}
	}
	@container (max-height: 400px) {
		.title {
			-webkit-line-clamp: 2;
			line-clamp: 2;
		}
	}
</style>

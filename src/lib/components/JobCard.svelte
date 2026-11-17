<!-- Card de vaga: uma folha de papel pousada. `lean` (-1..1) revela o carimbo do gesto. -->
<script lang="ts">
	import type { Job } from '#lib/client/types.ts';
	import { relativeTime, sourceLabel } from '#lib/client/format.ts';
	import ScoreMark from './ScoreMark.svelte';

	let {
		job,
		lean = 0,
		interactive = true
	}: { job: Job; lean?: number; interactive?: boolean } = $props();

	const posted = $derived(relativeTime(job.postedAt));
</script>

<article class="paper card relative flex h-full flex-col overflow-hidden px-5 pt-4 pb-3">
	<header class="flex items-start justify-between gap-3">
		<div class="min-w-0 pt-1">
			<p class="t-caption">
				{sourceLabel(job.source)}{#if posted}<span class="sep"></span>{posted}{/if}
			</p>
			<p class="mt-3 truncate text-[0.9375rem] font-medium">{job.company}</p>
		</div>
		<ScoreMark score={job.matchScore} />
	</header>

	<h2 class="title mt-1 font-serif">{job.title}</h2>

	<p class="mt-2 text-[0.9375rem] leading-snug text-ink-soft">
		{job.location ?? 'Local não informado'}{#if job.salary}<span class="sep"></span><span
				class="text-ink">{job.salary}</span
			>{/if}
	</p>

	{#if job.summary}<p class="summary mt-3 text-[0.9375rem] leading-normal">{job.summary}</p>{/if}

	<div class="mt-auto pt-3">
		{#if job.matchReasons.length}
			<ul class="space-y-1.5 border-t border-line pt-3">
				{#each job.matchReasons.slice(0, 2) as reason (reason)}
					<li class="flex gap-2 text-sm leading-snug">
						<svg
							class="mt-0.5 shrink-0"
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M2.5 8.800c1.6 1 2.6 2.2 3.4 3.8 1.8-4 4-6.8 7.6-9.4"
								stroke="var(--color-primary)"
								stroke-width="2.2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<span class="line-clamp-2">{reason}</span>
					</li>
				{/each}
			</ul>
		{/if}
		<button
			type="button"
			class="mt-1 flex min-h-11 w-full items-center justify-center text-sm font-medium text-ink-soft underline decoration-line underline-offset-4"
			tabindex={interactive ? 0 : -1}
		>
			Ver detalhes
		</button>
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
</article>

<style>
	.card {
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
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
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.stamp {
		position: absolute;
		top: 38%;
		padding: 4px 14px 6px;
		font-family: var(--font-serif);
		font-size: 2.25rem;
		line-height: 1.1;
		background: var(--color-paper);
		border-radius: var(--radius-sm);
		pointer-events: none;
		white-space: nowrap;
	}
	.stamp-apply {
		left: 16px;
		color: var(--color-primary-deep);
		box-shadow:
			inset 0 0 0 2px var(--color-primary),
			var(--shadow-paper);
	}
	.stamp-skip {
		right: 16px;
		color: var(--color-ink-soft);
		box-shadow:
			inset 0 0 0 2px var(--color-ink-soft),
			var(--shadow-paper);
	}
</style>

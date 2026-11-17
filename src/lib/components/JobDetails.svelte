<script lang="ts">
	import type { Job, SwipeDirection } from '#lib/client/types.ts';
	import { relativeTime, scorePercent, sourceLabel } from '#lib/client/format.ts';
	import Icon from './Icon.svelte';
	import ScoreMark from './ScoreMark.svelte';
	import Sheet from './Sheet.svelte';

	let {
		job,
		open = $bindable(false),
		ondecide
	}: {
		job: Job | null;
		open?: boolean;
		ondecide?: (job: Job, direction: SwipeDirection) => void;
	} = $props();

	const posted = $derived(relativeTime(job?.postedAt));
</script>

{#if job}
	<Sheet bind:open title={job.title} description={job.company} tall>
		<p class="text-[0.9375rem] leading-snug text-ink-soft">
			{job.location ?? 'Local não informado'}{#if job.salary}<span aria-hidden="true">
					·
				</span><span class="text-ink">{job.salary}</span>{/if}
		</p>
		<p class="t-caption mt-1">
			{sourceLabel(job.source)}{#if posted}<span class="sep"></span>publicada {posted}{/if}
		</p>

		{#if scorePercent(job.matchScore) !== null}
			<section class="mt-6 flex items-center gap-4 rounded-sm bg-band p-4">
				<ScoreMark score={job.matchScore} size={60} />
				<p class="text-[0.9375rem] leading-snug">
					<span class="font-medium">Afinidade com seu currículo.</span>
					<span class="text-ink-soft">Quanto do que a vaga pede já está no que você enviou.</span>
				</p>
			</section>
		{/if}

		{#if job.matchReasons.length}
			<section class="mt-6">
				<h3 class="t-title">Por que combina</h3>
				<ul class="mt-2 space-y-2.5">
					{#each job.matchReasons as reason (reason)}
						<li class="flex gap-2.5 text-[0.9375rem] leading-snug">
							<svg
								class="mt-0.5 shrink-0"
								width="18"
								height="18"
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
							<span>{reason}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if job.summary}
			<section class="mt-6">
				<h3 class="t-title">Resumo</h3>
				<p class="mt-2 text-base leading-relaxed whitespace-pre-line">{job.summary}</p>
			</section>
		{/if}

		<a
			href={job.url}
			target="_blank"
			rel="noopener noreferrer external"
			class="mt-5 inline-flex min-h-11 items-center gap-2 font-medium text-primary-deep underline decoration-primary/40 underline-offset-4"
		>
			Ver vaga original no {sourceLabel(job.source)}
			<Icon name="external" size={18} />
		</a>

		{#snippet footer()}
			{#if ondecide}
				<div class="grid grid-cols-2 gap-3">
					<button type="button" class="btn btn-quiet" onclick={() => ondecide(job, 'skip')}>
						Deixar pra lá
					</button>
					<button type="button" class="btn" onclick={() => ondecide(job, 'apply')}>
						Inscrever
					</button>
				</div>
			{/if}
		{/snippet}
	</Sheet>
{/if}

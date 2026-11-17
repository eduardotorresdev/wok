<!-- Afinidade: número circulado à mão em tinta roxa. -->
<script lang="ts">
	import { scorePercent } from '#lib/client/format.ts';
	let { score, size = 52 }: { score: number | null; size?: number } = $props();
	const value = $derived(scorePercent(score));
</script>

{#if value !== null}
	<span
		class="relative inline-grid shrink-0 place-items-center"
		style="width: {size}px; height: {size}px"
		role="img"
		aria-label="{value}% de afinidade com seu currículo"
	>
		<svg class="absolute inset-0 h-full w-full" viewBox="0 0 52 52" fill="none" aria-hidden="true">
			<path
				d="M30 4.500C17 2.5 5.5 11 4.5 24.5 3.5 38 13 47.5 26.5 47.8 39.5 48 48.5 38.5 47.5 25 46.8 14 39 5.5 24 5.8"
				stroke="var(--color-primary)"
				stroke-width="2.4"
				stroke-linecap="round"
			/>
		</svg>
		<span class="font-serif leading-none" style="font-size: {size * 0.46}px">{value}</span>
	</span>
{/if}

<!-- Sublinhado à mão (assinatura): traço de pincel sob uma única palavra do título. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
	const id = $props.id();
</script>

<span class="relative inline-block whitespace-nowrap">
	<span class="relative z-10">{@render children()}</span>
	<svg
		class="pointer-events-none absolute -bottom-[0.2em] left-[-4%] h-[0.32em] w-[108%]"
		viewBox="0 0 200 20"
		preserveAspectRatio="none"
		fill="none"
		aria-hidden="true"
		style="overflow: visible"
	>
		<defs>
			<filter id="{id}-u" x="-10%" y="-80%" width="120%" height="260%">
				<feTurbulence type="fractalNoise" baseFrequency="0.02 0.5" numOctaves="2" seed="7" />
				<feDisplacementMap in="SourceGraphic" scale="7" xChannelSelector="R" />
			</filter>
		</defs>
		<g filter="url(#{id}-u)" stroke="var(--color-primary)" stroke-linecap="round">
			<path d="M4 11 C 50 5, 120 6, 196 9" stroke-width="6" />
			<path d="M22 15 C 80 11, 140 12, 180 14" stroke-width="3" opacity="0.8" />
		</g>
	</svg>
</span>

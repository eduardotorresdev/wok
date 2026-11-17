<!-- Marca do site de origem da vaga, na cor da própria marca. -->
<script lang="ts">
	import type { JobSource } from '#lib/client/types.ts';
	let { source, size = 16 }: { source: JobSource | string; size?: number } = $props();
</script>

{#if source === 'linkedin'}
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="#0a66c2"
		aria-hidden="true"
		class="shrink-0"
	>
		<path
			d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
		/>
	</svg>
{:else if source === 'glassdoor'}
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="#0caa41"
		aria-hidden="true"
		class="shrink-0"
	>
		<path
			d="M17.144 20.572H3.43A3.429 3.429 0 0 0 6.857 24h10.287a3.428 3.428 0 0 0 3.427-3.428V6.492a.123.123 0 0 0-.124-.123H17.27a.124.124 0 0 0-.125.124v14.08zm0-20.572a3.429 3.429 0 0 1 3.427 3.43H6.857v14.078a.126.126 0 0 1-.125.125H3.554a.125.125 0 0 1-.125-.125V3.43A3.429 3.429 0 0 1 6.857 0h10.287"
		/>
	</svg>
{/if}

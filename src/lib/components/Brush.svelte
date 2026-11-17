<!-- Pincelada (assinatura): mancha de tinta roxa com borda de pincel seco. Uma por tela. -->
<script lang="ts">
	let { seed = 3, class: klass = '' }: { seed?: number; class?: string } = $props();
	const id = $props.id();
</script>

<svg
	class={klass}
	viewBox="0 0 400 240"
	preserveAspectRatio="none"
	fill="none"
	aria-hidden="true"
	style="color: var(--color-primary); overflow: visible"
>
	<defs>
		<filter id="{id}-dry" x="-15%" y="-25%" width="130%" height="150%">
			<feTurbulence
				type="fractalNoise"
				baseFrequency="0.008 0.42"
				numOctaves="2"
				{seed}
				result="streaks"
			/>
			<feDisplacementMap in="SourceGraphic" in2="streaks" scale="34" xChannelSelector="R" />
			<feTurbulence
				type="fractalNoise"
				baseFrequency="0.02 0.9"
				numOctaves="1"
				{seed}
				result="grain"
			/>
			<feColorMatrix
				in="grain"
				type="matrix"
				values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.9"
				result="holes"
			/>
		</filter>
		<filter id="{id}-edge" x="-15%" y="-25%" width="130%" height="150%">
			<feTurbulence type="fractalNoise" baseFrequency="0.008 0.42" numOctaves="2" {seed} />
			<feDisplacementMap in="SourceGraphic" scale="34" xChannelSelector="R" />
		</filter>
	</defs>
	<g filter="url(#{id}-edge)" stroke="currentColor" stroke-linecap="round">
		<path d="M34 58 C 120 34, 262 62, 372 40" stroke-width="56" />
		<path d="M22 118 C 132 96, 250 128, 380 100" stroke-width="62" />
		<path d="M40 178 C 150 160, 262 190, 356 166" stroke-width="52" opacity="0.94" />
		<path
			d="M30 88 C 140 70, 270 96, 366 72"
			stroke-width="20"
			stroke="var(--color-primary-deep)"
			opacity="0.28"
		/>
		<path
			d="M44 150 C 160 134, 262 160, 362 136"
			stroke-width="14"
			stroke="var(--color-primary-deep)"
			opacity="0.22"
		/>
	</g>
</svg>

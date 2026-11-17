<!--
	Primeira página de um PDF desenhada num canvas (pdf.js), como folha de papel.
	iframes de PDF não renderizam no WebKit móvel; por isso o canvas.
-->
<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		url,
		label = 'PDF do currículo',
		onpages
	}: { url: string; label?: string; onpages?: (pages: number) => void } = $props();

	let canvas = $state<HTMLCanvasElement>();
	let width = $state(0);
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let ratio = $state(1.414); // A4 até o PDF dizer o contrário

	$effect(() => {
		const target = canvas;
		const source = url;
		const cssWidth = width;
		if (!target || !source || cssWidth < 10) return;

		let cancelled = false;
		let cleanup = () => {};
		status = 'loading';

		(async () => {
			try {
				const [pdfjs, worker] = await Promise.all([
					import('pdfjs-dist/legacy/build/pdf.mjs'),
					import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
				]);
				pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
				const task = pdfjs.getDocument({ url: source, withCredentials: true });
				cleanup = () => void task.destroy();
				const pdf = await task.promise;
				if (cancelled) return;
				onpages?.(pdf.numPages);
				const page = await pdf.getPage(1);
				const base = page.getViewport({ scale: 1 });
				ratio = base.height / base.width;
				const scale = (cssWidth / base.width) * Math.min(window.devicePixelRatio || 1, 3);
				const viewport = page.getViewport({ scale });
				target.width = Math.floor(viewport.width);
				target.height = Math.floor(viewport.height);
				await page.render({ canvas: target, viewport }).promise;
				if (!cancelled) status = 'ready';
			} catch {
				if (!cancelled) status = 'error';
			}
		})();

		return () => {
			cancelled = true;
			cleanup();
		};
	});
</script>

<div
	bind:clientWidth={width}
	class="paper relative w-full overflow-hidden"
	style="aspect-ratio: 1 / {ratio}"
>
	<canvas
		bind:this={canvas}
		class="block h-full w-full transition-opacity duration-200 {status === 'ready'
			? 'opacity-100'
			: 'opacity-0'}"
	>
		{label}
	</canvas>
	{#if status === 'loading'}
		<div class="absolute inset-0 animate-pulse bg-band" aria-label="Carregando PDF"></div>
	{:else if status === 'error'}
		<div class="absolute inset-0 flex flex-col items-start justify-center p-6">
			<p class="t-title">Não deu para mostrar o PDF aqui</p>
			<a
				href={url}
				target="_blank"
				rel="noopener external"
				class="mt-2 inline-flex min-h-11 items-center gap-2 font-medium text-primary-deep underline decoration-primary/40 underline-offset-4"
			>
				Abrir o PDF <Icon name="external" size={18} />
			</a>
		</div>
	{/if}
</div>

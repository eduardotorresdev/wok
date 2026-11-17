<!--
	Visor do browser remoto. Um componente, dois modos:
	- watch: só assiste aos frames enquanto o agente dirige;
	- control: toques, rolagem e teclado vão para POST /api/browser/input.
	Frames chegam por SSE (GET /api/browser/stream). As coordenadas enviadas são
	pixels CSS do viewport remoto, não do elemento na tela.
-->
<script lang="ts">
	import { browser } from '$app/env';
	import { ApiError, api } from '#lib/client/api.ts';
	import { onMount } from 'svelte';
	import type { BrowserFrame, BrowserInput, BrowserState, Provider } from '#lib/client/types.ts';
	import Icon from './Icon.svelte';
	import SourceIcon from './SourceIcon.svelte';

	let {
		mode = 'watch',
		shortcuts = false,
		start = null,
		takeover = false,
		maxHeight = 0.56,
		fit = false,
		applicationId,
		fallbackUrl,
		onstate
	}: {
		mode?: 'watch' | 'control';
		/** Atalhos para abrir LinkedIn, Glassdoor ou uma URL. */
		shortcuts?: boolean;
		/** Abre o login deste site assim que o visor aparece. */
		start?: Provider | null;
		/** Assume o controle da página que o agente deixou aberta. */
		takeover?: boolean;
		/** Altura máxima da tela remota, como fração da altura da janela. */
		maxHeight?: number;
		/** A janela ocupa a altura que sobra até o rodapé da folha, em vez de `maxHeight`. */
		fit?: boolean;
		/** Inscrição dona do browser; o servidor mostra a sessão dela. */
		applicationId?: string;
		/** Saída de emergência quando a página remota não abre: a vaga no site de origem. */
		fallbackUrl?: string;
		onstate?: (state: BrowserState) => void;
	} = $props();

	const id = $props.id();
	let frame = $state<{ src: string; width: number; height: number } | null>(null);
	let remote = $state<BrowserState | null>(null);
	let online = $state(false);
	let notice = $state<string | null>(null);
	let opening = $state(false);
	// O visor nunca fica mudo: sem página, diz que está reabrindo ou que falhou.
	let trouble = $state<'reopening' | 'failed' | null>(null);
	let attempt = $state(0);
	let lastUrl: string | null = null;
	let boxWidth = $state(0);
	let viewportHeight = $state(700);
	let text = $state('');
	let masked = $state(false);
	let urlOpen = $state(false);
	let url = $state('');
	let marks = $state<{ id: number; x: number; y: number }[]>([]);

	// O servidor responde na hora e a página abre em segundo plano: até `loading` cair,
	// a tela mostra o aviso de abertura e não aceita toque nem teclado.
	const loading = $derived(opening || !!remote?.loading);
	const loadError = $derived(loading ? null : (remote?.loadError ?? null));
	const canControl = $derived(
		mode === 'control' && remote?.controller === 'user' && !loading && !loadError
	);
	const ratio = $derived.by(() => {
		const size = remote?.viewport ?? frame;
		return size && size.width > 0 ? size.height / size.width : 2.04;
	});
	// A página remota ocupa a largura toda (dá para ler e tocar); o que não cabe
	// na altura fica fora da janela e aparece arrastando.
	const fullHeight = $derived(boxWidth * ratio);
	let screenEl = $state<HTMLElement>();
	let available = $state(0);
	const screenHeight = $derived(
		fit && available > 0
			? Math.min(fullHeight, Math.max(220, available))
			: Math.min(viewportHeight * maxHeight, fullHeight)
	);

	// Nada da janela pode ficar sob o rodapé da folha: mede o espaço até ele.
	function measure() {
		if (!screenEl) return;
		const body = screenEl.closest<HTMLElement>('[data-sheet-body]');
		const limit = body ? body.getBoundingClientRect().bottom : window.innerHeight;
		const top = screenEl.getBoundingClientRect().top + (body?.scrollTop ?? 0);
		available = Math.floor(limit - top - 12);
	}
	$effect(() => {
		void [boxWidth, canControl, notice, trouble, urlOpen];
		if (!fit || !browser) return;
		const raf = requestAnimationFrame(measure);
		window.addEventListener('resize', measure);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', measure);
		};
	});
	const maxPan = $derived(Math.max(0, fullHeight - screenHeight));
	let pan = $state(0);
	$effect(() => {
		if (pan > maxPan) pan = maxPan;
	});

	function setState(state: BrowserState) {
		remote = state;
		onstate?.(state);
	}

	$effect(() => {
		if (!browser) return;
		void attempt; // "Tentar de novo" refaz a conexão
		viewportHeight = window.innerHeight;

		if (import.meta.env.DEV && new URLSearchParams(location.search).has('mock')) {
			online = true;
			frame = { src: FIXTURE, width: 412, height: 839 };
			api.browser.state(applicationId).then(setState);
			return;
		}

		api.browser
			.state(applicationId)
			.then(setState)
			.catch(() => {});
		const source = new EventSource(
			applicationId
				? `/api/browser/stream?applicationId=${encodeURIComponent(applicationId)}`
				: '/api/browser/stream'
		);
		source.onopen = () => (online = true);
		source.onerror = () => (online = false);
		source.addEventListener('frame', (event) => {
			const data = JSON.parse((event as MessageEvent).data) as BrowserFrame;
			trouble = null;
			frame = {
				src: `data:image/jpeg;base64,${data.jpeg}`,
				width: data.width,
				height: data.height
			};
		});
		source.addEventListener('state', (event) => {
			setState(JSON.parse((event as MessageEvent).data) as BrowserState);
		});
		return () => source.close();
	});

	// "Precisa de você": a página que o agente deixou passa para as mãos do usuário.
	// Depois de um restart do servidor a aba pode não existir mais (409 browser_closed)
	// até o servidor reabri-la: tenta algumas vezes antes de desistir.
	let alive = true;
	let taking = false;
	$effect(() => () => {
		alive = false;
	});

	async function take() {
		if (taking) return;
		taking = true;
		let done = false;
		for (let round = 0; round < 4 && alive && !done; round += 1) {
			try {
				setState(await api.browser.open(undefined, applicationId));
				notice = null;
				done = true;
			} catch (error) {
				if (error instanceof ApiError && error.code === 'agent_in_control') {
					notice = 'O agente está no controle agora. Aguarde ele terminar.';
					done = true;
				} else {
					if (!frame) trouble = 'reopening';
					await new Promise((resolve) => setTimeout(resolve, 2000));
				}
			}
		}
		taking = false;
		if (!alive) return;
		if (!done) trouble = 'failed';
		else if (trouble === 'reopening') trouble = null;
	}

	let tookOver = false;
	$effect(() => {
		if (!takeover || tookOver || mode !== 'control') return;
		tookOver = true;
		void take();
	});

	// Página esperada e nenhum frame: mostra a falha em vez de uma área em branco. Numa
	// inscrição a página já existia (8 s bastam); em "Conectar contas" o navegador pode
	// estar partindo a frio, então a espera é de 20 s.
	$effect(() => {
		void attempt;
		if (frame || opening || loadError || trouble === 'failed' || !(takeover || remote?.open))
			return;
		const timer = setTimeout(
			() => {
				if (!frame && !taking && !opening) trouble = 'failed';
			},
			applicationId && !remote?.loading ? 8000 : 25000
		);
		return () => clearTimeout(timer);
	});

	function retry() {
		trouble = null;
		notice = null;
		attempt += 1;
		if (takeover && mode === 'control') void take();
		else if (lastUrl ?? remote?.url) void open((lastUrl ?? remote?.url) as string);
	}

	// Os comandos saem em fila, na ordem em que o usuário os fez.
	let chain: Promise<unknown> = Promise.resolve();
	function send(input: BrowserInput) {
		chain = chain
			.then(() => api.browser.input(input, applicationId))
			.then(() => (notice = null))
			.catch((error) => {
				// A página ainda estava abrindo: o toque é só ignorado.
				if (error instanceof ApiError && error.code === 'browser_loading') return;
				notice =
					error instanceof ApiError && error.status === 409
						? 'O agente está no controle agora. Aguarde ele terminar.'
						: 'O comando não chegou ao browser. Tente de novo.';
			});
	}

	const LOGIN: Record<Provider, string> = {
		linkedin: 'https://www.linkedin.com/login',
		glassdoor: 'https://www.glassdoor.com.br/profile/login_input.htm'
	};

	// Só na montagem: quem chegou por "Conectar LinkedIn" não precisa escolher de novo.
	onMount(() => {
		if (start) void open(LOGIN[start]);
	});

	async function open(target: string) {
		const clean = target.trim();
		if (!clean) return;
		opening = true;
		notice = null;
		lastUrl = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
		trouble = null;
		// O navegador remoto pode estar partindo a frio: uma falha do servidor é repetida
		// antes de virar mensagem. Recusas (4xx) não melhoram com outra tentativa.
		let opened = false;
		for (let round = 0; round < 3 && alive && !opened; round += 1) {
			try {
				setState(await api.browser.open(lastUrl, applicationId));
				opened = true;
			} catch (error) {
				if (error instanceof ApiError && error.status < 500) break;
				if (round < 2) await new Promise((resolve) => setTimeout(resolve, 2500));
			}
		}
		if (opened) {
			urlOpen = false;
			url = '';
		} else if (alive) notice = 'Não deu para abrir esse endereço. Tente de novo.';
		opening = false;
	}

	// Gesto na tela remota: toque simples vira tap; arrasto vertical vira rolagem.
	let pointer: number | null = null;
	let startX = 0;
	let startY = 0;
	let lastY = 0;
	let pending = 0;
	let scrolling = false;
	let startedAt = 0;
	let markId = 0;
	let flushTimer: ReturnType<typeof setTimeout> | undefined;

	function point(event: PointerEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const size = remote?.viewport ?? frame ?? { width: rect.width, height: fullHeight };
		const px = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
		const py = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
		return {
			x: Math.round((px / rect.width) * size.width),
			y: Math.round(((py + pan) / fullHeight) * size.height),
			scale: size.width / rect.width,
			px,
			py
		};
	}

	function down(event: PointerEvent) {
		if (!event.isPrimary || !frame) return;
		pointer = event.pointerId;
		startX = event.clientX;
		startY = lastY = event.clientY;
		scrolling = false;
		startedAt = event.timeStamp;
		pending = 0;
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			// ponteiro sintético ou já solto
		}
	}

	function move(event: PointerEvent) {
		if (event.pointerId !== pointer) return;
		if (!scrolling) {
			// Folga para o dedo: toque curto e quase parado é sempre toque, nunca arrasto.
			const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
			const quick = event.timeStamp - startedAt < 180;
			if (moved < (quick ? 28 : 14)) return;
			lastY = event.clientY;
		}
		scrolling = true;
		const delta = lastY - event.clientY;
		lastY = event.clientY;
		// Primeiro anda a janela local; o que sobrar rola a página remota.
		const next = Math.max(0, Math.min(maxPan, pan + delta));
		const rest = delta - (next - pan);
		pan = next;
		if (!canControl || rest === 0) return;
		const at = point(event);
		pending += rest * at.scale;
		flushTimer ??= setTimeout(() => {
			flushTimer = undefined;
			if (Math.abs(pending) >= 1)
				send({ type: 'scroll', deltaY: Math.round(pending), x: at.x, y: at.y });
			pending = 0;
		}, 90);
	}

	function up(event: PointerEvent) {
		if (event.pointerId !== pointer) return;
		pointer = null;
		if (scrolling || !canControl) return;
		const at = point(event);
		send({ type: 'tap', x: at.x, y: at.y });
		// O marcador é desenhado a partir das coordenadas REMOTAS enviadas, convertidas
		// de volta para a tela: mostra onde o toque caiu de verdade na página.
		const size = remote?.viewport ?? frame;
		if (!size) return;
		const id = (markId += 1);
		marks = [
			...marks,
			{ id, x: (at.x / size.width) * boxWidth, y: (at.y / size.height) * fullHeight - pan }
		];
		// Por id: os itens do estado são proxies, comparar por identidade nunca casa.
		setTimeout(() => (marks = marks.filter((m) => m.id !== id)), 1100);
	}

	function submitText(event: SubmitEvent) {
		event.preventDefault();
		if (!text) return;
		send({ type: 'type', text });
		text = '';
	}

	const FIXTURE =
		'data:image/svg+xml,' +
		encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 839"><rect width="412" height="839" fill="#f3f2ef"/><rect x="24" y="120" width="364" height="420" rx="8" fill="#fff"/><text x="48" y="180" font-family="sans-serif" font-size="28" fill="#111">Entrar</text><rect x="48" y="220" width="316" height="52" rx="4" fill="none" stroke="#666"/><rect x="48" y="292" width="316" height="52" rx="4" fill="none" stroke="#666"/><rect x="48" y="380" width="316" height="52" rx="26" fill="#0a66c2"/><text x="170" y="413" font-family="sans-serif" font-size="18" fill="#fff">Entrar</text><text x="24" y="70" font-family="sans-serif" font-size="26" font-weight="700" fill="#0a66c2">Linked in (fixture)</text></svg>`
		);

	const host = $derived.by(() => {
		try {
			return remote?.url ? new URL(remote.url).host.replace(/^www\./, '') : null;
		} catch {
			return remote?.url ?? null;
		}
	});
</script>

<div class="w-full" bind:clientWidth={boxWidth}>
	{#if shortcuts && mode === 'control'}
		<div class="mb-2 flex flex-wrap gap-2">
			<button type="button" class="chip" disabled={opening} onclick={() => open(LOGIN.linkedin)}>
				<SourceIcon source="linkedin" />
				LinkedIn
				{#if remote?.accounts.linkedin}<span class="text-primary"
						><Icon name="check" size={16} stroke={2.4} /></span
					>{/if}
			</button>
			{#if !remote?.glassdoorManual}
				<button type="button" class="chip" disabled={opening} onclick={() => open(LOGIN.glassdoor)}>
					<SourceIcon source="glassdoor" />
					Glassdoor
					{#if remote?.accounts.glassdoor}<span class="text-primary"
							><Icon name="check" size={16} stroke={2.4} /></span
						>{/if}
				</button>
			{/if}
			<button
				type="button"
				class="chip"
				aria-pressed={urlOpen}
				onclick={() => (urlOpen = !urlOpen)}
			>
				<Icon name="globe" size={18} />
				Outro site
			</button>
		</div>
		{#if remote?.glassdoorManual}
			<p class="t-caption mb-2 flex items-center gap-1.5">
				<SourceIcon source="glassdoor" size={14} />
				No Glassdoor a inscrição é feita por você, no site.
			</p>
		{/if}
		{#if urlOpen}
			<form
				class="mb-2 flex gap-2"
				onsubmit={(event) => {
					event.preventDefault();
					open(url);
				}}
			>
				<input
					class="field"
					type="url"
					inputmode="url"
					autocapitalize="none"
					spellcheck="false"
					aria-label="Endereço do site"
					placeholder="exemplo.com/vagas"
					bind:value={url}
				/>
				<button type="submit" class="btn shrink-0" disabled={opening || !url.trim()}>Abrir</button>
			</form>
		{/if}
	{/if}

	{#if canControl}
		<!-- Teclado: o texto digitado aqui vai para o campo em foco na página remota -->
		<form class="mb-2 flex gap-2" onsubmit={submitText}>
			<label for="{id}-text" class="sr-only">Texto para digitar na página</label>
			<div class="relative min-w-0 flex-1">
				<input
					id="{id}-text"
					class="field pr-12"
					type={masked ? 'password' : 'text'}
					autocapitalize="none"
					autocomplete="off"
					autocorrect="off"
					spellcheck="false"
					enterkeyhint="send"
					placeholder="Toque num campo e digite aqui"
					bind:value={text}
				/>
				<button
					type="button"
					class="absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-sm {masked
						? 'text-primary-deep'
						: 'text-ink-soft'}"
					aria-label={masked ? 'Mostrar o que digito' : 'Ocultar o que digito (senhas)'}
					aria-pressed={masked}
					onclick={() => (masked = !masked)}
				>
					<Icon name="eye" size={20} />
				</button>
			</div>
			<button type="submit" class="btn shrink-0 px-4" disabled={!text}>
				<Icon name="keyboard" size={20} />
				Digitar
			</button>
		</form>
	{/if}

	<!-- Barra: quem dirige, endereço e navegação -->
	<div class="flex min-h-11 items-center gap-1 rounded-t-md bg-ink py-1 pr-1 pl-3 text-paper">
		<span
			class="size-2 shrink-0 rounded-full {online ? 'bg-primary-tint' : 'bg-ink-soft'}"
			aria-hidden="true"
		></span>
		<p class="flex min-w-0 flex-1 items-center gap-1 pl-1.5 text-[0.8125rem]">
			{#if !online}
				Conectando ao browser…
			{:else if host}
				<Icon name="lock" size={12} /><span class="truncate">{host}</span>
			{:else}
				Nenhuma página aberta
			{/if}
		</p>
		<p class="shrink-0 px-2 text-xs text-paper/70" aria-live="polite">
			{#if remote?.controller === 'agent'}Agente no controle{:else if canControl}Você no controle{/if}
		</p>
		{#if canControl}
			<button
				type="button"
				class="grid size-10 place-items-center rounded-sm active:bg-paper/15"
				aria-label="Voltar página"
				onclick={() => send({ type: 'back' })}
			>
				<Icon name="back" size={20} />
			</button>
			<button
				type="button"
				class="grid size-10 place-items-center rounded-sm active:bg-paper/15"
				aria-label="Recarregar página"
				onclick={() => send({ type: 'reload' })}
			>
				<Icon name="refresh" size={18} />
			</button>
		{/if}
	</div>

	<!-- Tela remota -->
	<div class="rounded-b-md border border-t-0 border-line">
		<div
			bind:this={screenEl}
			class="screen relative w-full overflow-hidden rounded-b-md bg-paper"
			class:control={canControl}
			class:pannable={maxPan > 0}
			style="height: {screenHeight}px"
			role={canControl ? 'application' : 'img'}
			aria-label={canControl
				? 'Tela do browser remoto: toque para clicar, arraste para rolar'
				: 'Tela do browser remoto, ao vivo'}
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={() => (pointer = null)}
		>
			{#if loadError}
				<div
					class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
					role="alert"
				>
					<span class="text-danger"><Icon name="alert" size={28} /></span>
					<p class="leading-snug font-medium">{loadError}</p>
					<button type="button" class="btn" onclick={retry}>
						<Icon name="refresh" size={20} />
						Tentar de novo
					</button>
					{#if fallbackUrl}
						<a
							href={fallbackUrl}
							target="_blank"
							rel="noopener noreferrer external"
							class="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-deep underline decoration-primary/40 underline-offset-4"
						>
							Abrir a vaga no site <Icon name="external" size={16} />
						</a>
					{/if}
				</div>
			{:else if frame}
				<img
					src={frame.src}
					alt=""
					class="block w-full select-none"
					style="height: {fullHeight}px; transform: translateY({-pan}px)"
					draggable="false"
				/>
			{:else if trouble === 'failed'}
				<div
					class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
					role="alert"
				>
					<span class="text-danger"><Icon name="alert" size={28} /></span>
					<p class="font-medium">Não consegui abrir a página</p>
					<button type="button" class="btn" onclick={retry}>
						<Icon name="refresh" size={20} />
						Tentar de novo
					</button>
					{#if fallbackUrl}
						<a
							href={fallbackUrl}
							target="_blank"
							rel="noopener noreferrer external"
							class="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-deep underline decoration-primary/40 underline-offset-4"
						>
							Abrir a vaga no site <Icon name="external" size={16} />
						</a>
					{/if}
				</div>
			{:else if trouble === 'reopening'}
				<div
					class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
					role="status"
				>
					<span class="spin text-primary"><Icon name="refresh" size={28} /></span>
					<p class="text-sm leading-snug">Reabrindo a página…</p>
				</div>
			{:else}
				<div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
					<span class="text-ink-soft"><Icon name="globe" size={28} /></span>
					<p class="text-sm leading-snug text-ink-soft">
						{#if mode === 'watch'}
							O browser aparece aqui quando o agente abrir a página da vaga.
						{:else if shortcuts}
							Escolha um site acima para abrir.
						{:else}
							Abrindo a página…
						{/if}
					</p>
				</div>
			{/if}
			{#each marks as mark (mark.id)}
				<span class="mark" style="left: {mark.x}px; top: {mark.y}px" aria-hidden="true"></span>
			{/each}
			{#if frame && maxPan > 0 && !loadError}
				<!-- Há mais página do que cabe na janela: trilho à direita e aviso embaixo. -->
				<span
					class="thumb"
					style="height: {(screenHeight / fullHeight) * 100}%; top: {(pan / fullHeight) * 100}%"
					aria-hidden="true"
				></span>
				{#if pan > 2}<span class="edge edge-top" aria-hidden="true"></span>{/if}
				{#if pan < maxPan - 2}
					<span class="edge edge-bottom" aria-hidden="true">
						<span class="more"><Icon name="down" size={14} /> Arraste para ver o resto</span>
					</span>
				{/if}
			{/if}
			{#if loading && !loadError}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper/80 text-sm font-medium"
					role="status"
				>
					Abrindo o navegador…
					<span class="progress" aria-hidden="true"><span></span></span>
					<span class="t-caption font-normal">Pode levar uns 10 segundos.</span>
				</div>
			{/if}
		</div>
	</div>

	{#if notice}
		<p class="mt-2 text-sm text-danger" role="alert">{notice}</p>
	{/if}

	{#if mode === 'control'}
		{#if canControl}
			<div class="mt-3 flex gap-2">
				{#each [['Enter', 'Enter'], ['Tab', 'Tab'], ['Backspace', 'Apagar']] as [key, label] (key)}
					<button
						type="button"
						class="chip flex-1 justify-center"
						onclick={() => send({ type: 'key', key })}
					>
						{label}
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Progresso estimado da abertura: enche em ~15 s e espera perto do fim. */
	.progress {
		width: 9rem;
		height: 3px;
		border-radius: 2px;
		background: var(--color-line);
		overflow: hidden;
	}
	.progress span {
		display: block;
		height: 100%;
		background: var(--color-primary);
		transform-origin: left;
		animation: fill 15s cubic-bezier(0.2, 0.6, 0.3, 1) forwards;
	}
	@keyframes fill {
		from {
			transform: scaleX(0.03);
		}
		to {
			transform: scaleX(0.94);
		}
	}
	.screen.control,
	.screen.pannable {
		touch-action: none;
	}
	.screen.control {
		cursor: pointer;
	}
	.screen img {
		-webkit-user-drag: none;
		-webkit-touch-callout: none;
		pointer-events: none;
	}
	.spin {
		animation: spin 1.1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.mark {
		position: absolute;
		width: 44px;
		height: 44px;
		margin: -22px 0 0 -22px;
		border-radius: 50%;
		border: 2px solid var(--color-primary);
		background:
			radial-gradient(circle, var(--color-primary) 0 4px, transparent 5px), rgba(116, 70, 196, 0.18);
		pointer-events: none;
		animation: mark 1100ms ease-out forwards;
	}
	@keyframes mark {
		0% {
			transform: scale(0.5);
			opacity: 1;
		}
		25% {
			transform: scale(1);
			opacity: 1;
		}
		100% {
			transform: scale(1);
			opacity: 0;
		}
	}
	.thumb {
		position: absolute;
		right: 3px;
		width: 4px;
		min-height: 24px;
		border-radius: 2px;
		background: rgba(34, 27, 43, 0.45);
		pointer-events: none;
	}
	.edge {
		position: absolute;
		inset-inline: 0;
		height: 44px;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		pointer-events: none;
	}
	.edge-top {
		top: 0;
		background: linear-gradient(rgba(34, 27, 43, 0.16), transparent);
	}
	.edge-bottom {
		bottom: 0;
		padding-bottom: 6px;
		background: linear-gradient(transparent, rgba(34, 27, 43, 0.22));
	}
	.more {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border-radius: var(--radius-sm);
		background: var(--color-ink);
		color: var(--color-paper);
		font-size: 0.75rem;
		font-weight: 500;
	}
</style>

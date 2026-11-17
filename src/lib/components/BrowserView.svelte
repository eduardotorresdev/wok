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
	import type { BrowserFrame, BrowserInput, BrowserState } from '#lib/client/types.ts';
	import Icon from './Icon.svelte';
	import SourceIcon from './SourceIcon.svelte';

	let {
		mode = 'watch',
		shortcuts = false,
		takeover = false,
		maxHeight = 0.56,
		applicationId,
		fallbackUrl,
		onstate
	}: {
		mode?: 'watch' | 'control';
		/** Atalhos para abrir LinkedIn, Glassdoor ou uma URL. */
		shortcuts?: boolean;
		/** Assume o controle da página que o agente deixou aberta. */
		takeover?: boolean;
		/** Altura máxima da tela remota, como fração da altura da janela. */
		maxHeight?: number;
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
	let ripples = $state<{ id: number; x: number; y: number }[]>([]);

	const canControl = $derived(mode === 'control' && remote?.controller === 'user');
	const ratio = $derived.by(() => {
		const size = remote?.viewport ?? frame;
		return size && size.width > 0 ? size.height / size.width : 2.04;
	});
	// A página remota ocupa a largura toda (dá para ler e tocar); o que não cabe
	// na altura fica fora da janela e aparece arrastando.
	const fullHeight = $derived(boxWidth * ratio);
	const screenHeight = $derived(Math.min(viewportHeight * maxHeight, fullHeight));
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

	// Página esperada e nenhum frame em 8 s: mostra a falha em vez de uma área em branco.
	$effect(() => {
		void attempt;
		if (frame || trouble === 'failed' || !(takeover || remote?.open)) return;
		const timer = setTimeout(() => {
			if (!frame && !taking) trouble = 'failed';
		}, 8000);
		return () => clearTimeout(timer);
	});

	function retry() {
		trouble = null;
		notice = null;
		attempt += 1;
		if (takeover && mode === 'control') void take();
		else if (lastUrl) void open(lastUrl);
	}

	// Os comandos saem em fila, na ordem em que o usuário os fez.
	let chain: Promise<unknown> = Promise.resolve();
	function send(input: BrowserInput) {
		chain = chain
			.then(() => api.browser.input(input, applicationId))
			.then(() => (notice = null))
			.catch((error) => {
				notice =
					error instanceof ApiError && error.status === 409
						? 'O agente está no controle agora. Aguarde ele terminar.'
						: 'O comando não chegou ao browser. Tente de novo.';
			});
	}

	async function open(target: string) {
		const clean = target.trim();
		if (!clean) return;
		opening = true;
		notice = null;
		try {
			lastUrl = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
			trouble = null;
			setState(await api.browser.open(lastUrl, applicationId));
			urlOpen = false;
			url = '';
		} catch {
			notice = 'Não deu para abrir esse endereço.';
		} finally {
			opening = false;
		}
	}

	// Gesto na tela remota: toque simples vira tap; arrasto vertical vira rolagem.
	let pointer: number | null = null;
	let startX = 0;
	let startY = 0;
	let lastY = 0;
	let pending = 0;
	let scrolling = false;
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
		pending = 0;
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			// ponteiro sintético ou já solto
		}
	}

	function move(event: PointerEvent) {
		if (event.pointerId !== pointer) return;
		if (!scrolling && Math.hypot(event.clientX - startX, event.clientY - startY) < 10) return;
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
		const ripple = { id: Date.now(), x: at.px, y: at.py };
		ripples = [...ripples, ripple];
		setTimeout(() => (ripples = ripples.filter((r) => r !== ripple)), 450);
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
			{#if frame}
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
							Escolha um site abaixo para abrir.
						{:else}
							Abrindo a página…
						{/if}
					</p>
				</div>
			{/if}
			{#each ripples as ripple (ripple.id)}
				<span class="ripple" style="left: {ripple.x}px; top: {ripple.y}px" aria-hidden="true"
				></span>
			{/each}
			{#if opening}
				<div class="absolute inset-0 grid place-items-center bg-paper/70 text-sm font-medium">
					Abrindo…
				</div>
			{/if}
		</div>
	</div>

	{#if notice}
		<p class="mt-2 text-sm text-danger" role="alert">{notice}</p>
	{/if}

	{#if mode === 'control'}
		{#if shortcuts}
			<div class="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					class="chip"
					disabled={opening}
					onclick={() => open('https://www.linkedin.com/login')}
				>
					<SourceIcon source="linkedin" />
					LinkedIn
					{#if remote?.accounts.linkedin}<span class="text-primary"
							><Icon name="check" size={16} stroke={2.4} /></span
						>{/if}
				</button>
				<button
					type="button"
					class="chip"
					disabled={opening}
					onclick={() => open('https://www.glassdoor.com.br/profile/login_input.htm')}
				>
					<SourceIcon source="glassdoor" />
					Glassdoor
					{#if remote?.accounts.glassdoor}<span class="text-primary"
							><Icon name="check" size={16} stroke={2.4} /></span
						>{/if}
				</button>
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
			{#if urlOpen}
				<form
					class="mt-2 flex gap-2"
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
					<button type="submit" class="btn shrink-0" disabled={opening || !url.trim()}>Abrir</button
					>
				</form>
			{/if}
		{/if}

		{#if canControl}
			<!-- Teclado: o texto digitado aqui vai para o campo em foco na página remota -->
			<form class="mt-3 flex gap-2" onsubmit={submitText}>
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
			<div class="mt-2 flex gap-2">
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
	.ripple {
		position: absolute;
		width: 36px;
		height: 36px;
		margin: -18px 0 0 -18px;
		border-radius: 50%;
		background: rgba(116, 70, 196, 0.35);
		box-shadow: 0 0 0 2px var(--color-primary);
		pointer-events: none;
		animation: ripple 450ms ease-out forwards;
	}
	@keyframes ripple {
		from {
			transform: scale(0.4);
			opacity: 1;
		}
		to {
			transform: scale(1.4);
			opacity: 0;
		}
	}
</style>

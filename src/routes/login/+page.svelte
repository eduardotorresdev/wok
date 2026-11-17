<script lang="ts">
	import { page } from '$app/state';
	import { authClient } from '#lib/client/auth.ts';
	import Brush from '#lib/components/Brush.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Underline from '#lib/components/Underline.svelte';

	let email = $state('');
	let sending = $state(false);
	let sentTo = $state<string | null>(null);
	let error = $state<string | null>(null);
	let cooldown = $state(0);

	const next = $derived.by(() => {
		const target = page.url.searchParams.get('next');
		return target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
	});

	$effect(() => {
		if (cooldown <= 0) return;
		const timer = setTimeout(() => (cooldown -= 1), 1000);
		return () => clearTimeout(timer);
	});

	async function send(address: string) {
		sending = true;
		error = null;
		try {
			const result = await authClient.signIn.magicLink({ email: address, callbackURL: next });
			if (result.error) {
				error =
					result.error.status === 429
						? 'Muitas tentativas. Espere um minuto e tente de novo.'
						: 'Não deu para enviar o link. Confira o email e tente de novo.';
				return;
			}
			sentTo = address;
			cooldown = 30;
		} catch {
			error = 'Sem conexão. Tente de novo.';
		} finally {
			sending = false;
		}
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const address = email.trim().toLowerCase();
		if (!address || sending) return;
		send(address);
	}
</script>

<svelte:head><title>Entrar · Wok</title></svelte:head>

<main
	class="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+24px)]"
>
	<p class="font-serif text-[1.75rem] leading-none">wok</p>

	<!-- Objeto principal: o currículo pousado sobre a pincelada. -->
	<div class="relative mx-auto mt-7 h-36 w-full" aria-hidden="true">
		<Brush class="absolute inset-x-[-8px] top-5 h-28 w-[calc(100%+16px)]" seed={4} />
		<div
			class="paper absolute top-0 left-1/2 h-36 w-28 -translate-x-[58%] -rotate-6 p-3 shadow-lifted"
		>
			<div class="h-2 w-12 rounded-[1px] bg-ink"></div>
			<div class="mt-1 h-1 w-16 rounded-[1px] bg-line"></div>
			<div class="mt-3 h-1 w-8 rounded-[1px] bg-primary"></div>
			{#each [20, 18, 21, 14] as w (w)}<div
					class="mt-1.5 h-1 rounded-[1px] bg-line"
					style="width: {w * 4}%"
				></div>{/each}
			<div class="mt-3 h-1 w-10 rounded-[1px] bg-primary"></div>
			{#each [19, 22, 16] as w (w)}<div
					class="mt-1.5 h-1 rounded-[1px] bg-line"
					style="width: {w * 4}%"
				></div>{/each}
		</div>
		<div
			class="paper absolute top-3 left-1/2 flex h-12 w-28 translate-x-[6%] rotate-[5deg] items-center gap-2 px-3"
		>
			<span class="text-primary"><Icon name="check" size={18} stroke={2.4} /></span>
			<span class="text-xs leading-tight font-medium">Candidatura enviada</span>
		</div>
	</div>

	{#if sentTo}
		<section class="mt-9" aria-live="polite">
			<h1 class="t-display text-balance">Confira seu <Underline>email</Underline></h1>
			<p class="mt-4 text-base leading-relaxed text-ink-soft">
				Mandamos um link de acesso para <span class="font-medium [overflow-wrap:anywhere] text-ink"
					>{sentTo}</span
				>. Abra neste celular para entrar. Ele vale por 15 minutos.
			</p>
			<div class="mt-7 flex flex-col gap-2">
				<button
					type="button"
					class="btn btn-quiet"
					disabled={cooldown > 0 || sending}
					onclick={() => sentTo && send(sentTo)}
				>
					{#if sending}Enviando…{:else if cooldown > 0}Reenviar em {cooldown}s{:else}Reenviar link{/if}
				</button>
				<button
					type="button"
					class="btn btn-text"
					onclick={() => ((sentTo = null), (error = null))}
				>
					Usar outro email
				</button>
			</div>
			{#if error}<p class="mt-3 text-sm text-danger" role="alert">{error}</p>{/if}
		</section>
	{:else}
		<section class="mt-9">
			<h1 class="t-display text-balance">Seu currículo, na vaga <Underline>certa</Underline></h1>
			<p class="mt-4 text-base leading-relaxed text-ink-soft">
				O Wok lê seu currículo em LaTeX, encontra vagas e se inscreve por você.
			</p>

			<form class="mt-7" onsubmit={submit} novalidate>
				<label for="email" class="t-label">Seu email</label>
				<input
					id="email"
					class="field mt-2"
					type="email"
					name="email"
					inputmode="email"
					autocomplete="email"
					autocapitalize="none"
					spellcheck="false"
					placeholder="voce@exemplo.com"
					required
					bind:value={email}
					aria-invalid={error ? 'true' : undefined}
					aria-describedby="email-hint"
				/>
				<button type="submit" class="btn mt-3 w-full" disabled={sending || !email.trim()}>
					<Icon name="mail" size={20} />
					{sending ? 'Enviando…' : 'Receber link de acesso'}
				</button>
				<p
					id="email-hint"
					class="mt-3 text-center text-sm {error ? 'text-danger' : 'text-ink-soft'}"
					role={error ? 'alert' : undefined}
				>
					{error ?? 'Sem senha. O link chega no seu email.'}
				</p>
			</form>
		</section>
	{/if}
</main>

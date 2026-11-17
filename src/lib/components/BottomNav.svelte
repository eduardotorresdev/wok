<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { PageRouteId } from '$app/types';
	import { createQuery } from '@tanstack/svelte-query';
	import { applicationsQuery } from '#lib/client/queries.ts';
	import Icon, { type IconName } from './Icon.svelte';

	const applications = createQuery(() => applicationsQuery());
	const waiting = $derived(
		(applications.data ?? []).filter((a) => a.status === 'needs_user').length
	);

	const items: {
		href: PageRouteId;
		path: string;
		label: string;
		icon: IconName;
		also?: string;
	}[] = [
		{ href: '/(app)', path: '/', label: 'Vagas', icon: 'cards' },
		{ href: '/(app)/inscricoes', path: '/inscricoes', label: 'Inscrições', icon: 'send' },
		{
			href: '/(app)/curriculo',
			path: '/curriculo',
			label: 'Perfil',
			icon: 'doc',
			also: '/ajustes'
		}
	];

	function isActive(item: (typeof items)[number]) {
		const path = page.url.pathname;
		if (item.path === '/') return path === '/';
		return path.startsWith(item.path) || (!!item.also && path.startsWith(item.also));
	}
</script>

<nav
	aria-label="Principal"
	class="shrink-0 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]"
>
	<ul class="mx-auto grid max-w-md grid-cols-3">
		{#each items as item (item.href)}
			{@const active = isActive(item)}
			<li>
				<a
					href={resolve(item.href)}
					aria-current={active ? 'page' : undefined}
					class="relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors duration-150 {active
						? 'text-ink'
						: 'text-ink-soft'}"
				>
					<span class="relative">
						<Icon name={item.icon} size={22} stroke={active ? 1.9 : 1.6} />
						{#if item.path === '/inscricoes' && waiting > 0}
							<span
								class="absolute -top-1.5 -right-2.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-primary px-1 text-[0.6875rem] leading-none font-semibold text-paper"
								aria-hidden="true">{waiting > 9 ? '9+' : waiting}</span
							>
						{/if}
					</span>
					<span>
						{item.label}{#if item.path === '/inscricoes' && waiting > 0}<span class="sr-only"
								>, {waiting === 1 ? '1 precisa de você' : `${waiting} precisam de você`}</span
							>{/if}
					</span>
					{#if active}
						<svg
							class="absolute bottom-1 h-1.5 w-7"
							viewBox="0 0 28 6"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M2 3.4C8 1.6 19 1.8 26 3"
								stroke="var(--color-primary)"
								stroke-width="2.6"
								stroke-linecap="round"
							/>
						</svg>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>

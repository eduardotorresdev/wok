<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { PageRouteId } from '$app/types';
	import Icon, { type IconName } from './Icon.svelte';

	const items: {
		href: PageRouteId;
		path: string;
		label: string;
		icon: IconName;
		also?: string;
	}[] = [
		{ href: '/(app)', path: '/', label: 'Vagas', icon: 'cards' },
		{ href: '/(app)/inscricoes', path: '/inscricoes', label: 'Inscrições', icon: 'send' },
		{ href: '/(app)/browser', path: '/browser', label: 'Browser', icon: 'globe' },
		{
			href: '/(app)/curriculo',
			path: '/curriculo',
			label: 'Currículo',
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
	<ul class="mx-auto grid max-w-md grid-cols-4">
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
					<Icon name={item.icon} size={22} stroke={active ? 1.9 : 1.6} />
					<span>{item.label}</span>
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

<script lang="ts" module>
	import type { PageRouteId } from '$app/types';

	interface ToastMessage {
		id: number;
		text: string;
		href?: PageRouteId;
		action?: string;
		tone?: 'ink' | 'danger';
	}
	let current = $state<ToastMessage | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	export function toast(message: Omit<ToastMessage, 'id'>, ms = 3200) {
		clearTimeout(timer);
		current = { ...message, id: Date.now() };
		timer = setTimeout(() => (current = null), ms);
	}
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { fly } from 'svelte/transition';
</script>

<div
	class="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] z-40 flex justify-center px-4"
	aria-live="polite"
>
	{#if current}
		{#key current.id}
			<div
				transition:fly={{ y: -12, duration: 180 }}
				class="pointer-events-auto flex min-h-12 max-w-sm items-center gap-3 rounded-md py-1 pr-1.5 pl-4 text-[0.9375rem] text-paper shadow-lifted {current.tone ===
				'danger'
					? 'bg-danger'
					: 'bg-ink'}"
			>
				<span class="py-2">{current.text}</span>
				{#if current.href}
					<a
						href={resolve(current.href)}
						class="flex min-h-11 shrink-0 items-center rounded-sm px-2.5 font-medium underline decoration-paper/40 underline-offset-4"
						>{current.action ?? 'Ver'}</a
					>
				{/if}
			</div>
		{/key}
	{/if}
</div>

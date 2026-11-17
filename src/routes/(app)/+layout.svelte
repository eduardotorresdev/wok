<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { preferencesQuery, resumeQuery } from '#lib/client/queries.ts';
	import BottomNav from '#lib/components/BottomNav.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Primeiro acesso: sem currículo e sem preferências salvas, começa pelo onboarding.
	const resume = createQuery(() => resumeQuery());
	const preferences = createQuery(() => preferencesQuery());
	$effect(() => {
		if (
			resume.data &&
			preferences.data &&
			!resume.data.latex.trim() &&
			!preferences.data.updatedAt
		) {
			goto(resolve('/onboarding'), { replaceState: true });
		}
	});
</script>

<div class="flex h-dvh flex-col overflow-hidden">
	<main
		class="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto pt-[env(safe-area-inset-top)]"
	>
		{@render children()}
	</main>
	<BottomNav />
</div>
<Toast />

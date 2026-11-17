<script lang="ts">
	import BottomNav from '#lib/components/BottomNav.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
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

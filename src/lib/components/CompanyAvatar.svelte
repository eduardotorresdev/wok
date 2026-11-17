<!-- Avatar da empresa: logo quando a API manda; senão, a inicial sobre lavanda. -->
<script lang="ts">
	let {
		name,
		logo = null,
		size = 40
	}: { name: string; logo?: string | null; size?: number } = $props();

	let broken = $state(false);
	const initial = $derived((name.trim()[0] ?? '?').toUpperCase());
</script>

<span
	class="inline-grid shrink-0 place-items-center overflow-hidden rounded-sm bg-primary-tint font-serif text-primary-deep"
	style="width: {size}px; height: {size}px; font-size: {size * 0.55}px; line-height: 1"
	aria-hidden="true"
>
	{#if logo && !broken}
		<img
			src={logo}
			alt=""
			class="h-full w-full bg-paper object-contain"
			loading="lazy"
			referrerpolicy="no-referrer"
			onerror={() => (broken = true)}
		/>
	{:else}
		{initial}
	{/if}
</span>

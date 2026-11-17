<!-- Indicador de páginas do currículo: uma página, sempre. -->
<script lang="ts">
	import Icon from './Icon.svelte';
	let { pages, busy = false }: { pages: number | null; busy?: boolean } = $props();
</script>

<p
	class="inline-flex min-h-8 items-center gap-1.5 rounded-sm px-2.5 text-[0.8125rem] font-medium {busy ||
	pages === null
		? 'bg-band text-ink-soft'
		: pages === 1
			? 'bg-primary-tint text-primary-deep'
			: 'bg-danger-tint text-danger'}"
	aria-live="polite"
>
	{#if busy}
		Compilando…
	{:else if pages === null}
		Não compilado
	{:else if pages === 1}
		<Icon name="check" size={16} stroke={2.2} /> 1 página
	{:else}
		<Icon name="alert" size={16} /> {pages} páginas
	{/if}
</p>

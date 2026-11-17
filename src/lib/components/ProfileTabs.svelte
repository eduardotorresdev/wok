<!-- Cabeçalho da aba Perfil: Currículo | Profissional | Busca e dados. -->
<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import { profileDocQuery } from '#lib/client/queries.ts';

	const path = $derived(page.url.pathname);
	// A aba só aparece quando o servidor já tem o perfil profissional.
	const doc = createQuery(() => profileDocQuery());
</script>

<header class="shrink-0 px-5 pt-2">
	<h1 class="t-headline">Perfil</h1>
	<nav class="mt-1 flex gap-6 border-b border-line" aria-label="Perfil">
		<a
			href={resolve('/(app)/curriculo')}
			class="tab"
			aria-current={path.startsWith('/curriculo') ? 'page' : undefined}>Currículo</a
		>
		{#if doc.isSuccess}
			<a
				href={resolve('/(app)/profissional')}
				class="tab"
				aria-current={path.startsWith('/profissional') ? 'page' : undefined}>Profissional</a
			>
		{/if}
		<a
			href={resolve('/(app)/ajustes')}
			class="tab"
			aria-current={path.startsWith('/ajustes') ? 'page' : undefined}>Busca e dados</a
		>
	</nav>
</header>

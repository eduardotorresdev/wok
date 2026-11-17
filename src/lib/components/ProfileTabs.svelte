<!-- Cabeçalho da aba Perfil: Currículo | Ajustes. -->
<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	const path = $derived(page.url.pathname);
</script>

<header class="shrink-0 px-5 pt-2">
	<h1 class="t-headline">Perfil</h1>
	<nav class="mt-1 flex gap-6 border-b border-line" aria-label="Perfil">
		<a
			href={resolve('/(app)/curriculo')}
			class="tab"
			aria-current={path.startsWith('/curriculo') ? 'page' : undefined}>Currículo</a
		>
		<a
			href={resolve('/(app)/ajustes')}
			class="tab"
			aria-current={path.startsWith('/ajustes') ? 'page' : undefined}>Busca e dados</a
		>
	</nav>
</header>

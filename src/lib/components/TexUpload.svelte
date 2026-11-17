<!-- Lê um arquivo .tex do aparelho e devolve o texto. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		onload,
		onerror,
		class: klass = 'btn btn-quiet',
		children
	}: {
		onload: (text: string, name: string) => void;
		onerror?: (message: string) => void;
		class?: string;
		children: Snippet;
	} = $props();

	async function change(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) return;
		if (file.size > 200_000) {
			onerror?.('Arquivo grande demais (máximo de 200 kB).');
			return;
		}
		try {
			onload(await file.text(), file.name);
		} catch {
			onerror?.('Não deu para ler o arquivo.');
		}
	}
</script>

<label
	class="{klass} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
>
	{@render children()}
	<input
		type="file"
		class="sr-only"
		accept=".tex,.ltx,.txt,text/plain,text/x-tex,application/x-tex"
		onchange={change}
	/>
</label>

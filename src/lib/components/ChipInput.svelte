<!-- Lista de termos como etiquetas: digita, Enter ou vírgula adiciona; toque remove. -->
<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		value = $bindable([]),
		label,
		hint,
		placeholder = '',
		suggestions = [],
		max = 20
	}: {
		value?: string[];
		label: string;
		hint?: string;
		placeholder?: string;
		suggestions?: string[];
		max?: number;
	} = $props();

	const id = $props.id();
	let draft = $state('');

	const has = (item: string) => value.some((v) => v.toLowerCase() === item.toLowerCase());
	const open = $derived(suggestions.filter((s) => !has(s)));

	function add(raw: string) {
		const next = [...value];
		for (const part of raw.split(/[,;\n]/)) {
			const term = part.trim().slice(0, 120);
			if (term && next.length < max && !next.some((v) => v.toLowerCase() === term.toLowerCase())) {
				next.push(term);
			}
		}
		value = next;
		draft = '';
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			add(draft);
		} else if (event.key === 'Backspace' && !draft && value.length) {
			value = value.slice(0, -1);
		}
	}
</script>

<div>
	<label for={id} class="t-label">{label}</label>
	{#if hint}<p class="t-caption mt-1">{hint}</p>{/if}

	{#if value.length}
		<ul class="mt-2.5 flex flex-wrap gap-2">
			{#each value as item (item)}
				<li>
					<button
						type="button"
						class="chip chip-on"
						aria-label="Remover {item}"
						onclick={() => (value = value.filter((v) => v !== item))}
					>
						{item}
						<Icon name="x" size={16} />
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-2.5 flex gap-2">
		<input
			{id}
			class="field"
			type="text"
			enterkeyhint="done"
			autocapitalize="none"
			{placeholder}
			bind:value={draft}
			onkeydown={keydown}
			oninput={() => /[,;]/.test(draft) && add(draft)}
			onblur={() => draft.trim() && add(draft)}
		/>
		<button
			type="button"
			class="btn btn-quiet shrink-0 px-3.5"
			aria-label="Adicionar"
			disabled={!draft.trim()}
			onclick={() => add(draft)}
		>
			<Icon name="plus" size={20} />
		</button>
	</div>

	{#if open.length}
		<ul class="mt-2.5 flex flex-wrap gap-2" aria-label="Sugestões">
			{#each open as item (item)}
				<li>
					<button type="button" class="chip text-ink-soft" onclick={() => add(item)}>
						<Icon name="plus" size={16} />
						{item}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

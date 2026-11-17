<!-- Escolha única entre poucas opções, como etiquetas. -->
<script lang="ts" generics="T extends string">
	let {
		value = $bindable(),
		label,
		options,
		clearable = false
	}: {
		value: T;
		label: string;
		options: { value: T; label: string }[];
		/** Tocar na opção marcada limpa a escolha (volta para ''). */
		clearable?: boolean;
	} = $props();
</script>

<fieldset>
	<legend class="t-label">{label}</legend>
	<div class="mt-2.5 flex flex-wrap gap-2">
		{#each options as option (option.value)}
			<button
				type="button"
				class="chip"
				aria-pressed={value === option.value}
				onclick={() => (value = clearable && value === option.value ? ('' as T) : option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
</fieldset>

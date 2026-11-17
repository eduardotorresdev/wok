<!-- Campos da busca: usados no onboarding (por partes) e em Ajustes (tudo). -->
<script lang="ts">
	import type { Preferences } from '#lib/client/types.ts';
	import ChipInput from './ChipInput.svelte';
	import Choice from './Choice.svelte';

	let {
		prefs = $bindable(),
		part = 'all'
	}: { prefs: Preferences; part?: 'search' | 'area' | 'all' } = $props();

	const AREAS = [
		'Engenharia de Software',
		'Dados e IA',
		'Produto',
		'Design e UX',
		'Marketing',
		'Vendas',
		'Finanças e Contabilidade',
		'Operações e Logística',
		'Recursos Humanos',
		'Saúde',
		'Jurídico',
		'Engenharia (civil, elétrica, mecânica, produção)',
		'Educação',
		'Atendimento e Customer Success'
	];
	const SENIORITY = ['Estágio', 'Júnior', 'Pleno', 'Sênior', 'Especialista', 'Gestão'].map(
		(label) => ({ value: label, label })
	);

	const areaId = $props.id();
	const listed = $derived(AREAS.includes(prefs.area));
	let other = $state(false);
</script>

<div class="space-y-7">
	{#if part !== 'area'}
		<ChipInput
			bind:value={prefs.terms}
			label="Termos de busca"
			hint="Cargos ou palavras que você digitaria no LinkedIn."
			placeholder="ex.: desenvolvedora front-end"
		/>
		<div>
			<ChipInput
				bind:value={prefs.locations}
				label="Onde"
				hint="Cidades, estados ou países."
				placeholder="ex.: São Paulo"
				suggestions={['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Brasil']}
			/>
			<label class="check mt-2">
				<input type="checkbox" bind:checked={prefs.remote} />
				Incluir vagas remotas
			</label>
		</div>
	{/if}

	{#if part !== 'search'}
		<div>
			<label for={areaId} class="t-label">Área</label>
			<p class="t-caption mt-1">Define o jeito de escrever o currículo e avaliar as vagas.</p>
			<select
				id={areaId}
				class="field mt-2.5"
				value={other || (prefs.area && !listed) ? '__other' : prefs.area}
				onchange={(event) => {
					const picked = event.currentTarget.value;
					other = picked === '__other';
					prefs.area = other ? '' : picked;
				}}
			>
				<option value="">Escolha uma área</option>
				{#each AREAS as area (area)}<option value={area}>{area}</option>{/each}
				<option value="__other">Outra</option>
			</select>
			{#if other || (prefs.area && !listed)}
				<input
					class="field mt-2"
					type="text"
					aria-label="Qual área?"
					placeholder="Qual área?"
					maxlength="120"
					bind:value={prefs.area}
				/>
			{/if}
		</div>

		<Choice bind:value={prefs.seniority} label="Senioridade" options={SENIORITY} clearable />
	{/if}
</div>

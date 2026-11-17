<!--
	"Dados para inscrição": o que o agente usa para preencher formulários.
	`compact` mostra só o essencial (onboarding); o resto fica para o Perfil.
-->
<script lang="ts">
	import type { Profile, SalaryRange } from '#lib/client/types.ts';
	import ChipInput from './ChipInput.svelte';
	import Choice from './Choice.svelte';
	import Icon from './Icon.svelte';

	let { profile = $bindable(), compact = false }: { profile: Profile; compact?: boolean } =
		$props();

	const id = $props.id();

	const REGIMES = [
		{ value: 'clt' as const, label: 'CLT' },
		{ value: 'pj' as const, label: 'PJ' },
		{ value: 'outro' as const, label: 'Outro' }
	];
	const MODELS = [
		{ value: 'any' as const, label: 'Tanto faz' },
		{ value: 'remote' as const, label: 'Remoto' },
		{ value: 'hybrid' as const, label: 'Híbrido' },
		{ value: 'onsite' as const, label: 'Presencial' }
	];
	const AVAILABILITY = ['Imediata', '15 dias', '30 dias', '60 dias'];
	const LEVELS = ['Básico', 'Intermediário', 'Avançado', 'Fluente', 'Nativo'];

	const showClt = $derived(profile.salary.preferredRegime !== 'pj');
	const showPj = $derived(
		profile.salary.preferredRegime === 'pj' || profile.salary.preferredRegime === 'outro'
	);

	function setAmount(range: SalaryRange, key: 'min' | 'max', raw: string) {
		const digits = raw.replace(/\D/g, '');
		range[key] = digits ? Number(digits) : null;
	}
</script>

{#snippet range(label: string, value: SalaryRange)}
	<fieldset class="mt-3">
		<legend class="t-caption">{label}, por mês</legend>
		<div class="mt-1.5 grid grid-cols-2 gap-2">
			<input
				class="field"
				type="text"
				inputmode="numeric"
				aria-label="{label}: mínimo"
				placeholder="Mínimo"
				value={value.min ?? ''}
				oninput={(e) => setAmount(value, 'min', e.currentTarget.value)}
			/>
			<input
				class="field"
				type="text"
				inputmode="numeric"
				aria-label="{label}: máximo"
				placeholder="Máximo"
				value={value.max ?? ''}
				oninput={(e) => setAmount(value, 'max', e.currentTarget.value)}
			/>
		</div>
	</fieldset>
{/snippet}

<div class="space-y-7">
	<div class="space-y-3">
		<div>
			<label for="{id}-name" class="t-label">Nome completo</label>
			<input
				id="{id}-name"
				class="field mt-2"
				type="text"
				autocomplete="name"
				bind:value={profile.fullName}
			/>
		</div>
		<div>
			<label for="{id}-phone" class="t-label">Telefone</label>
			<input
				id="{id}-phone"
				class="field mt-2"
				type="tel"
				inputmode="tel"
				autocomplete="tel"
				placeholder="+55 11 90000-0000"
				bind:value={profile.phone}
			/>
		</div>
		<div class="grid grid-cols-2 gap-2">
			<div>
				<label for="{id}-city" class="t-label">Cidade</label>
				<input
					id="{id}-city"
					class="field mt-2"
					type="text"
					autocomplete="address-level2"
					bind:value={profile.city}
				/>
			</div>
			<div>
				<label for="{id}-country" class="t-label">País</label>
				<input
					id="{id}-country"
					class="field mt-2"
					type="text"
					autocomplete="country-name"
					bind:value={profile.country}
				/>
			</div>
		</div>
		<div>
			<label for="{id}-linkedin" class="t-label">LinkedIn</label>
			<input
				id="{id}-linkedin"
				class="field mt-2"
				type="url"
				inputmode="url"
				autocapitalize="none"
				spellcheck="false"
				placeholder="linkedin.com/in/voce"
				bind:value={profile.linkedinUrl}
			/>
		</div>
	</div>

	{#if !compact}
		<ChipInput
			bind:value={profile.portfolioLinks}
			label="Portfólio e links"
			hint="GitHub, site pessoal, Behance."
			placeholder="github.com/voce"
			max={10}
		/>
	{/if}

	<div>
		<Choice
			bind:value={profile.salary.preferredRegime}
			label="Pretensão salarial"
			options={REGIMES}
			clearable
		/>
		{#if showClt}{@render range('CLT', profile.salary.clt)}{/if}
		{#if showPj}{@render range('PJ', profile.salary.pj)}{/if}
		<div class="mt-3">
			<label for="{id}-currency" class="t-caption">Moeda</label>
			<select id="{id}-currency" class="field mt-1.5" bind:value={profile.salary.currency}>
				<option value="BRL">Real (R$)</option>
				<option value="USD">Dólar (US$)</option>
				<option value="EUR">Euro (€)</option>
			</select>
		</div>
	</div>

	<div>
		<label for="{id}-availability" class="t-label">Disponibilidade para início</label>
		<input
			id="{id}-availability"
			class="field mt-2"
			type="text"
			placeholder="ex.: 30 dias"
			bind:value={profile.availability}
		/>
		<div class="mt-2 flex flex-wrap gap-2">
			{#each AVAILABILITY as option (option)}
				<button
					type="button"
					class="chip"
					aria-pressed={profile.availability === option}
					onclick={() => (profile.availability = option)}
				>
					{option}
				</button>
			{/each}
		</div>
	</div>

	<div>
		<Choice bind:value={profile.workModel} label="Modelo preferido" options={MODELS} />
		<label class="check mt-2">
			<input type="checkbox" bind:checked={profile.willingToRelocate} />
			Aceito mudar de cidade
		</label>
	</div>

	{#if !compact}
		<fieldset>
			<legend class="t-label">Autorização de trabalho</legend>
			<p class="t-caption mt-1">Países onde você pode, ou não, trabalhar legalmente.</p>
			<ul class="mt-2.5 space-y-2">
				{#each profile.workAuthorization as item, index (index)}
					<li class="rounded-md bg-band p-3">
						<div class="flex gap-2">
							<input
								class="field"
								type="text"
								aria-label="País"
								placeholder="País"
								bind:value={item.country}
							/>
							<button
								type="button"
								class="btn-icon shrink-0"
								aria-label="Remover {item.country || 'país'}"
								onclick={() =>
									(profile.workAuthorization = profile.workAuthorization.filter(
										(_, i) => i !== index
									))}
							>
								<Icon name="trash" size={20} />
							</button>
						</div>
						<label class="check">
							<input type="checkbox" bind:checked={item.authorized} />
							Tenho autorização
						</label>
						<input
							class="field"
							type="text"
							aria-label="Observação"
							placeholder="Observação (visto, cidadania…)"
							bind:value={item.note}
						/>
					</li>
				{/each}
			</ul>
			<button
				type="button"
				class="btn btn-quiet mt-2"
				onclick={() =>
					(profile.workAuthorization = [
						...profile.workAuthorization,
						{ country: '', authorized: true, note: '' }
					])}
			>
				<Icon name="plus" size={20} />
				Adicionar país
			</button>
		</fieldset>

		<fieldset>
			<legend class="t-label">Idiomas</legend>
			<ul class="mt-2.5 space-y-2">
				{#each profile.languages as item, index (index)}
					<li class="flex gap-2">
						<input
							class="field min-w-0 flex-1"
							type="text"
							aria-label="Idioma"
							placeholder="Idioma"
							bind:value={item.language}
						/>
						<select class="field w-[9.5rem] shrink-0" aria-label="Nível" bind:value={item.level}>
							<option value="">Nível</option>
							{#each LEVELS as level (level)}<option value={level}>{level}</option>{/each}
						</select>
						<button
							type="button"
							class="btn-icon shrink-0"
							aria-label="Remover {item.language || 'idioma'}"
							onclick={() => (profile.languages = profile.languages.filter((_, i) => i !== index))}
						>
							<Icon name="trash" size={20} />
						</button>
					</li>
				{/each}
			</ul>
			<button
				type="button"
				class="btn btn-quiet mt-2"
				onclick={() => (profile.languages = [...profile.languages, { language: '', level: '' }])}
			>
				<Icon name="plus" size={20} />
				Adicionar idioma
			</button>
		</fieldset>

		<details class="more border-t border-line pt-2">
			<summary class="flex min-h-12 cursor-pointer items-center justify-between font-medium">
				Registro, certificações e sigilo
				<span class="chev text-ink-soft"><Icon name="down" size={20} /></span>
			</summary>
			<div class="space-y-7 pt-3 pb-1">
				<fieldset>
					<legend class="t-label">Registro profissional</legend>
					<p class="t-caption mt-1">CRM, OAB, CREA, CRC e similares.</p>
					<div class="mt-2.5 grid grid-cols-[1fr_5rem] gap-2">
						<input
							class="field"
							type="text"
							aria-label="Número do registro"
							placeholder="Número"
							bind:value={profile.professionalRegistration.number}
						/>
						<input
							class="field"
							type="text"
							aria-label="UF"
							placeholder="UF"
							maxlength="2"
							autocapitalize="characters"
							bind:value={profile.professionalRegistration.state}
						/>
					</div>
					<input
						class="field mt-2"
						type="text"
						aria-label="Situação do registro"
						placeholder="Situação (ex.: ativo)"
						bind:value={profile.professionalRegistration.status}
					/>
				</fieldset>

				<fieldset>
					<legend class="t-label">Certificações</legend>
					<ul class="mt-2.5 space-y-2">
						{#each profile.certifications as item, index (index)}
							<li class="flex gap-2">
								<input
									class="field min-w-0 flex-1"
									type="text"
									aria-label="Certificação"
									placeholder="Nome"
									bind:value={item.name}
								/>
								<input
									class="field w-28 shrink-0"
									type="text"
									aria-label="Validade"
									placeholder="Validade"
									bind:value={item.validUntil}
								/>
								<button
									type="button"
									class="btn-icon shrink-0"
									aria-label="Remover {item.name || 'certificação'}"
									onclick={() =>
										(profile.certifications = profile.certifications.filter((_, i) => i !== index))}
								>
									<Icon name="trash" size={20} />
								</button>
							</li>
						{/each}
					</ul>
					<button
						type="button"
						class="btn btn-quiet mt-2"
						onclick={() =>
							(profile.certifications = [...profile.certifications, { name: '', validUntil: '' }])}
					>
						<Icon name="plus" size={20} />
						Adicionar certificação
					</button>
				</fieldset>

				<ChipInput
					bind:value={profile.shifts}
					label="Turnos e plantões aceitos"
					placeholder="ex.: noturno"
					suggestions={['Diurno', 'Noturno', 'Fins de semana', 'Plantão 12x36']}
					max={10}
				/>

				<ChipInput
					bind:value={profile.confidential}
					label="O que não divulgar"
					hint="Clientes, números sigilosos ou projetos que o agente não deve citar."
					placeholder="ex.: nome do cliente X"
					max={30}
				/>
			</div>
		</details>
	{/if}
</div>

<style>
	.more summary {
		list-style: none;
	}
	.more summary::-webkit-details-marker {
		display: none;
	}
	.more[open] .chev {
		transform: rotate(180deg);
	}
</style>

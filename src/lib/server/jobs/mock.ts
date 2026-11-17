import type { CollectedJob } from './types.ts';

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Seed postings used only when APIFY_TOKEN is missing, so the feed is never empty. */
export function mockJobs(terms: string[], location: string): CollectedJob[] {
	const role = terms[0] || 'Pessoa Desenvolvedora';
	const place = location || 'Brasil';
	const base: Omit<CollectedJob, 'externalId' | 'url' | 'source'>[] = [
		{
			title: `${role} Sênior`,
			company: 'Aurora Pagamentos',
			location: `${place} (remoto)`,
			applyUrl: null,
			salary: 'R$ 14.000–18.000 / mês',
			postedAt: day(1),
			description: `Buscamos ${role} sênior para o time de produto. Você vai desenhar e entregar funcionalidades de ponta a ponta, revisar código e apoiar pessoas mais novas. Requisitos: experiência sólida na área, boa comunicação e inglês intermediário.`
		},
		{
			title: `${role} Pleno`,
			company: 'Lume Saúde',
			location: place,
			applyUrl: null,
			salary: null,
			postedAt: day(3),
			description: `Vaga para ${role} pleno em healthtech em crescimento. Trabalho híbrido, squad multidisciplinar, foco em qualidade e métricas. Diferenciais: experiência com produtos regulados.`
		},
		{
			title: `Especialista em ${role}`,
			company: 'Trilha Logística',
			location: `${place} (híbrido)`,
			applyUrl: null,
			salary: 'R$ 16.000–21.000 / mês',
			postedAt: day(5),
			description: `Atuação como referência técnica em ${role}, definindo padrões e apoiando decisões de arquitetura junto a liderança.`
		},
		{
			title: `${role} (contrato PJ)`,
			company: 'Estúdio Norte',
			location: 'Remoto',
			applyUrl: null,
			salary: 'R$ 90 / hora',
			postedAt: day(7),
			description: `Projeto de 6 meses, com possibilidade de extensão. Time pequeno, autonomia alta, entregas quinzenais.`
		}
	];
	return base.map((j, i) => ({
		...j,
		source: i % 2 === 0 ? 'linkedin' : 'glassdoor',
		externalId: `mock-${i + 1}`,
		url: `https://example.com/vagas/mock-${i + 1}`
	}));
}

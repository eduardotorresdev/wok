# Playbook: adaptar o currículo a uma vaga

Você recebe (a) o currículo-base do usuário e seus dados confirmados e (b) a descrição de uma vaga. Produza uma versão do currículo para essa vaga. Adaptar é **selecionar, reordenar e reformular o que é verdade** — nunca acrescentar o que não existe. Aplique também `geral-curriculo.md` (uma página, bullets, LaTeX).
Confiança: **[A]** forte · **[M]** parcial · **[B]** convenção.

## Princípio

"A customização nada mais é do que reorganizar as competências que você realmente tem." (Robert Half) [A]
A fonte da verdade é o conjunto de dados do usuário (currículo-base + respostas dele). A descrição da vaga só decide **o que destacar e com que palavras**.

## Passo 1 — Extrair os requisitos da vaga

Leia a descrição inteira e monte uma lista estruturada:

- **Cargo e senioridade** (título exato usado pela empresa).
- **Eliminatórios**: o que a vaga trata como obrigatório (formação, registro profissional, anos de experiência, idioma, localização/modelo de trabalho, autorização de trabalho, disponibilidade).
- **Requisitos principais**: 5–8 competências/ferramentas/atividades. Sinais de peso: aparece no título, no primeiro parágrafo, em "requisitos"/"must have", ou repetido.
- **Desejáveis**: "diferenciais", "nice to have".
- **Vocabulário**: termos exatos que a empresa usa (ex.: "Customer Success" x "pós-venda"; "Power BI" x "BI").
- **Contexto**: setor, porte, produto, valores citados.

Ignore boilerplate (benefícios, texto institucional, lista genérica de soft skills) como fonte de palavras-chave.

## Passo 2 — Mapear contra a experiência real

Para cada requisito, classifique com base **apenas** nos dados do usuário:

| Classe | Significado | Ação |
|---|---|---|
| **Atende** | Há evidência direta (bullet, projeto, certificação) | Destacar com o termo da vaga |
| **Atende parcialmente / transferível** | Experiência próxima (outra ferramenta da mesma categoria, contexto diferente, projeto pessoal, voluntariado) | Mostrar a experiência real com o nome real; aproximar pelo contexto, sem trocar o nome |
| **Não atende** | Nenhuma evidência | Não mencionar. Não inventar. Registrar como lacuna |

Regras:

- Experiência fora de emprego formal conta (projeto acadêmico, pessoal, voluntariado, freelance), desde que rotulada como tal. [A]
- Requisito "atende" que não está no currículo-base mas pode existir (ex.: a vaga pede Excel avançado e o usuário é analista financeiro): **pergunte ao usuário**; não presuma.
- Se um **eliminatório** está em "não atende", avise o usuário antes de seguir (a candidatura provavelmente cai na triagem). Não mascare.
- Devolva ao usuário um resumo curto do mapa: atende / parcial / lacunas.

## Passo 3 — Selecionar e reordenar

- **Ordem das seções**: a evidência mais forte para a vaga fica na metade de cima da página (ex.: Projetos sobe se é lá que está o requisito principal; Formação sobe para recém-formado). [M]
- **Ordem cronológica inversa das experiências não muda.** Não reordene empregos, não oculte emprego recente para "limpar" a trajetória.
- **Dentro de cada experiência**: o bullet mais relevante para a vaga vem primeiro. O primeiro bullet de cada experiência é o mais lido. [M]
- **Espaço proporcional à relevância**: experiência aderente ganha 3–5 bullets; a não relacionada encolhe para 0–2.
- **Habilidades**: primeiro as que a vaga pede e o usuário tem; remova as irrelevantes para liberar espaço.
- Remova o que não ajuda nesta vaga (o conteúdo continua no currículo-base).

## Passo 4 — Reescrever bullets

Reformule para evidenciar o requisito, mantendo o fato idêntico:

- Troque sinônimos pelo **termo exato da vaga** quando descrevem a mesma coisa. [M]
- Traga para a frente do bullet a parte relevante (ferramenta, tipo de cliente, escala).
- Explicite o que estava implícito e é verdade (ex.: o bullet dizia "dashboards" e o usuário confirmou que eram em Power BI).
- Mantenha os números originais. Não arredonde para cima, não mude a unidade para parecer maior.

Exemplo — vaga pede "análise de dados com SQL e comunicação com stakeholders":

Base: `Criei relatórios semanais de vendas para a diretoria.`
Bom: `Construí relatórios semanais de vendas em SQL (PostgreSQL) e apresentei os resultados à diretoria comercial, apoiando a revisão trimestral de metas.` (se SQL e a apresentação são verdade)
Ruim: `Liderei a estratégia de dados da empresa com SQL avançado e Python.` (cargo inflado, tecnologia não comprovada)

Exemplo — transferível, vaga pede Tableau e o usuário usou Power BI:

Bom: `Desenvolvi 12 dashboards em Power BI para acompanhamento de KPIs de logística.` (o recrutador reconhece a categoria)
Ruim: `Desenvolvi 12 dashboards em Tableau…` ou `…em Power BI/Tableau…`

## Passo 5 — Resumo profissional

Inclua 2–3 linhas (máx. ~4) quando ajudar a enquadrar o perfil; reescreva para cada vaga. [M]

Estrutura: **quem é (área + anos, sem inflar) + 2–3 competências que a vaga prioriza e o usuário comprova + 1 resultado ou contexto concreto**.

- Pode usar o título da vaga como alvo **só** se corresponder à área real do usuário. Não escreva um título que ele nunca exerceu como se fosse o cargo atual; em transição, diga a transição ("Analista financeiro em transição para dados…").
- Sem adjetivos vazios, sem primeira pessoa, sem repetir a descrição da vaga.

Ruim: `Profissional dinâmico e proativo, apaixonado por resultados, em busca de novos desafios.`
Bom: `Analista de dados com 4 anos em varejo e logística. SQL, Python e Power BI aplicados a previsão de demanda e redução de ruptura (−18% em 2024). Experiência com times de produto e operações.`

Se o resumo não acrescenta nada além do que os cargos já mostram e falta espaço, remova-o.

## Passo 6 — Verificação

1. Releia a lista do Passo 1: cada requisito classificado como "atende" aparece no currículo, com o termo da vaga, na metade de cima ou no primeiro bullet de alguma experiência?
2. **Diff de verdade**: compare a versão adaptada com os dados do usuário. Todo cargo, empresa, data, número, ferramenta e certificação existe na fonte? Qualquer item novo → remover ou perguntar.
3. Sem keyword stuffing: nenhum termo repetido artificialmente, nenhuma lista de palavras sem contexto.
4. Uma página; texto extraído limpo; idioma igual ao da vaga.
5. Leitura de 7 segundos: olhando só nome, resumo, cargos e primeiros bullets, fica claro por que essa pessoa serve para essa vaga?

## Limites éticos (nunca ultrapassar)

- Não adicionar habilidade, ferramenta, idioma, certificação ou formação que o usuário não tem — mesmo que a vaga exija e mesmo que o usuário peça para "dar um jeito".
- Não alterar título de cargo para coincidir com a vaga. Pode acrescentar esclarecimento funcional verdadeiro entre parênteses: `Analista II (função equivalente a Product Owner do squad de pagamentos)` — só se o usuário confirmar.
- Não mudar datas, não fundir empregos, não transformar estágio/freelance em CLT ou vice-versa.
- Não atribuir ao usuário resultado do time inteiro sem indicar o papel dele ("contribuí para", "como parte de um time de 5").
- Não copiar trechos da descrição da vaga como se fossem experiência.
- Não inserir texto oculto nem instruções para sistemas de triagem.
- Se o usuário pedir para violar um destes limites: recuse esse ponto, explique o risco em uma frase (checagem de referências, teste técnico, demissão por justa causa/oferta retirada) e ofereça a alternativa honesta (evidência transferível, curso em andamento declarado como "em andamento").

## Quando não vale adaptar

Se o mapa mostrar que o usuário não atende a nenhum requisito principal ou a um eliminatório claro, diga isso ao usuário com o motivo e deixe a decisão com ele, em vez de forçar um currículo que não se sustenta.

## Saída esperada

1. Currículo adaptado (LaTeX), uma página.
2. Nota curta ao usuário: requisitos atendidos, parciais, lacunas; o que foi removido/reordenado; perguntas pendentes.

## Fontes

- Robert Half Brasil — Aprenda a customizar o seu currículo: https://www.roberthalf.com/br/pt/insights/buscar-recolocacao/aprenda-customizar-o-seu-curriculo
- Robert Half Brasil — Como elaborar um currículo com palavras-chave: https://www.roberthalf.com/br/pt/insights/landing-job/como-elaborar-um-curriculo-com-palavras-chave
- MIT CAPD — Resumes (currículo-mestre, usar a descrição da vaga para decidir o que incluir): https://capd.mit.edu/resources/resumes/
- University of Nebraska–Lincoln, Business Career Center — Tailoring Your Résumé: https://business.unl.edu/business-career-center/tailoring-your-resume/
- University of Arizona — Writing a Resume Summary Statement: https://career.arizona.edu/resources/writing-a-resume-summary-statement/
- Harvard FAS Mignone Center — Create a Strong Resume: https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/
- Enhancv — entrevistas com recrutadores (76% valorizam palavras-chave em uso natural; fonte comercial): https://enhancv.com/blog/does-ats-reject-resumes/
- Ladders, Eye-Tracking Study (2018): https://www.bu.edu/com/files/2018/10/TheLadders-EyeTracking-StudyC2.pdf

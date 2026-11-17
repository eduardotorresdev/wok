# Playbook de área: Dados e IA

Complementa `geral-curriculo.md` e `geral-adaptacao-vaga.md`. Aplica-se a: analista de dados/BI, analytics engineer, engenheiro(a) de dados, cientista de dados, engenheiro(a) de machine learning/IA, MLOps.
Confiança: [A] forte · [M] parcial · [B] convenção.

## O que o recrutador da área procura

- **Decisão ou resultado de negócio que o trabalho gerou**, não a técnica. "Treinei um XGBoost" sem dizer o que mudou é bullet incompleto. [M]
- Prova de que a habilidade foi **aplicada**: toda ferramenta listada em Habilidades precisa aparecer em um bullet de experiência ou projeto. [A]
- O subperfil certo. As vagas separam: **análise/BI** (SQL, dashboards, métricas de negócio), **engenharia de dados** (pipelines, modelagem, orquestração, custo), **ciência de dados** (estatística, experimentos, modelos), **ML/IA** (modelos em produção, serving, avaliação, LLMs). Enquadre o usuário em um, conforme a vaga e a experiência real. [M]
- Capacidade de explicar resultado para quem não é técnico (apresentações a diretoria, áreas atendidas). [M]
- No Brasil, SQL e Python são tratados como base em qualquer subperfil, e Power BI é a ferramenta de BI mais citada pelos profissionais (pesquisa State of Data Brazil). [M]

## Seções e ordem (o que muda)

- **Júnior/transição:** Formação → Habilidades técnicas → Projetos (2–3 bullets cada) → Experiência. Projetos são o centro do currículo de início de carreira. [A]
- **Com experiência na área:** Experiência → Habilidades → Formação → Projetos/Publicações (só se acrescentarem um requisito da vaga).
- **Habilidades por categoria:** Linguagens (SQL, Python, R) · Bibliotecas/frameworks · Bancos e plataformas · Visualização · Métodos (testes A/B, regressão, séries temporais). Sem "noções de"/"familiaridade com": ou a pessoa usa, ou não entra. [M]
- **Bullet de dados:** resultado → ação → ferramenta ("Reduzi X ao fazer Y com Z"). [M]
- **Projeto:** título + tipo (pessoal, acadêmico, em grupo, competição) + problema de negócio + dados usados (fonte e volume) + método + resultado + link. [M]
- Mestrado/doutorado: sobem quando a vaga pede pesquisa (research scientist, ML avançado); publicações em uma linha cada, só as relevantes. [B]

## Métricas típicas

Os números abaixo são ilustrativos; no currículo entram só os números reais do usuário.

- **Negócio:** receita, custo evitado, churn, conversão, inadimplência, ruptura, horas de trabalho manual eliminadas.
- **Modelo:** AUC, F1, precisão/recall, RMSE/MAPE — sempre com baseline e, se houver, com o efeito no negócio. Métrica de modelo sozinha diz pouco.
- **Escala:** linhas/GB/TB processados, nº de tabelas, fontes, dashboards e usuários que consomem.
- **Engenharia:** tempo de execução do pipeline, frescor/SLA dos dados, custo de warehouse, incidentes de qualidade de dados.
- **Experimentação:** nº de testes A/B, tamanho de amostra, lift com intervalo de confiança.
- **ML em produção:** latência de inferência, volume de predições, tempo de retreino, drift monitorado.

Ruim: `Criação de dashboards em Power BI para a área comercial.`
Bom: `Construí 8 dashboards em Power BI sobre SQL Server para 40 gestores comerciais, substituindo 6 planilhas manuais e ~10 h/semana de consolidação.`

Ruim: `Desenvolvi modelo de machine learning para prever churn com 92% de acurácia.`
Bom: `Desenvolvi modelo de churn (LightGBM, AUC 0,84 vs. 0,71 da regra anterior) usado pelo time de retenção para priorizar 5 mil contatos/mês; cancelamento do grupo abordado caiu de 6,2% para 4,9%.`

Ruim: `Responsável por pipelines de ETL.`
Bom: `Migrei 35 pipelines de cron para Airflow + dbt no BigQuery, reduzindo a carga diária de 4 h para 50 min e o custo mensal de consultas em 30%.`

Ruim: `Realizei análises para apoiar a tomada de decisão.`
Bom: `Analisei o funil de cadastro (SQL, 1,2 mi de sessões) e identifiquei a etapa de validação de documento como principal ponto de abandono; a mudança proposta entrou no roadmap do trimestre.`

## Palavras-chave

Use o termo como a vaga escreve, e só o que o usuário domina.

- **Cargos (PT/EN):** Analista de Dados, Analista de BI, Data Analyst, Analytics Engineer, Engenheiro(a) de Dados, Data Engineer, Cientista de Dados, Data Scientist, Engenheiro(a) de Machine Learning, ML Engineer, AI Engineer, MLOps.
- **Análise/BI:** SQL, Excel avançado, Power BI (DAX), Tableau, Looker, Metabase, KPIs, indicadores, storytelling com dados, análise exploratória.
- **Engenharia:** ETL/ELT, Airflow, dbt, Spark/PySpark, Databricks, BigQuery, Snowflake, Redshift, Kafka, modelagem dimensional, data lake/lakehouse, data warehouse, qualidade e governança de dados, LGPD.
- **Ciência/ML:** Python (pandas, scikit-learn), estatística, teste de hipóteses, testes A/B, regressão, classificação, séries temporais, feature engineering, PyTorch/TensorFlow, MLflow, deploy de modelos.
- **IA generativa:** LLM, RAG, embeddings, fine-tuning, avaliação de modelos (evals), agentes. Só com experiência real: "usei o ChatGPT" não é experiência com LLM. Iniciativas de IA generativa já são maioria nas empresas pesquisadas no Brasil, então o termo aparece muito nas vagas. [M]
- Diferencie o que a vaga diferencia: "Python para análise" ≠ "Python em produção"; "Power BI" ≠ "BI".

## Portfólio e links

- GitHub no cabeçalho com 1–3 projetos fixados; cada um com README que conte problema, dados, decisões (o porquê), resultado e como reproduzir. Código organizado, não um notebook único e sem texto. [M]
- Prefira **um projeto completo de ponta a ponta** (coleta → tratamento → análise/modelo → avaliação → entrega) a vários exercícios soltos. [M]
- Dashboards (Power BI/Tableau) não funcionam bem no GitHub: use link público (Tableau Public, Power BI publicado, Notion) com dados não confidenciais. [M]
- Kaggle: cite quando houver resultado notável (medalha, colocação) ou projeto autoral. As fontes divergem sobre o peso; nunca deixe competição ocupar o lugar de experiência profissional. [B]
- Dataset clichê (Titanic, Iris) como único projeto e notebook copiado contam contra. [M]
- Nunca publique dado de empregador ou cliente; descreva o trabalho sem expor a base.

## Por senioridade

- **Júnior:** projetos com problema de negócio, SQL e uma ferramenta de visualização bem demonstrados; certificados de curso não substituem projeto. [M]
- **Pleno/sênior:** impacto em decisão ou receita, modelos e pipelines em produção, escala, autonomia e interlocução com áreas de negócio; lista de cursos sai.
- **Gestão/lead:** tamanho do time, plataforma ou roadmap de dados, priorização com stakeholders, adoção das soluções, custo. [B]

## Erros comuns

- Método sem resultado; métrica de modelo sem baseline; "acurácia" em problema desbalanceado. [M]
- Lista enorme de bibliotecas (matplotlib, numpy, seaborn…) ocupando espaço de bullets.
- Atribuir a si resultado de negócio que dependeu de outras áreas, sem indicar o papel ("contribuí com…").
- Dizer que o modelo está "em produção" quando ficou em notebook ou prova de conceito.
- Tratar bootcamp ou curso como experiência profissional; portfólio só de certificados. [M]
- Currículo genérico "de dados" para vaga de subperfil específico.

## Na inscrição

- **Triagem típica:** anos de experiência com SQL, Python e a ferramenta de BI/cloud da vaga; nível de inglês; formação (algumas vagas exigem graduação em exatas ou pós); regime CLT x PJ e pretensão; modelo de trabalho. O presencial/híbrido voltou a crescer entre profissionais de dados no Brasil — confirme cidade e disponibilidade do usuário. [M]
- **Etapas comuns:** RH → teste de SQL/Python em plataforma (HackerRank e similares) ou case take-home com base de dados → apresentação do case → entrevista técnica e com gestor. [M] Teste ou case no formulário: pare e devolva ao usuário.
- **Pergunte ao usuário antes de candidatar:** em qual subperfil quer se posicionar; anos reais por ferramenta; volumes e resultados que pode citar (e o que é confidencial); se os modelos foram a produção; links públicos de projetos/dashboards; aceita PJ e valores por regime; disponibilidade para case de vários dias.

## Fontes

- George Washington University, Data Science Program — Resume Guide: https://dats.columbian.gwu.edu/student-resources/career-resources/resume-guide.html
- Duke University Career Hub — Data Resume: What and How: https://careerhub.students.duke.edu/blog/2026/02/14/data-resume-what-and-how/
- Data Hackers — O guia definitivo para encontrar o primeiro emprego na área de dados: https://www.datahackers.news/p/guia-primeiro-emprego-dados
- Alura — Portfólio em dados (escola de tecnologia; fonte comercial): https://www.alura.com.br/artigos/portfolio-em-dados
- Bain & Company / Data Hackers — State of Data Brazil 2025, principais resultados: https://www.bain.com/pt-br/insights/state-of-data-2025/
- Data Hackers — State of Data Brazil 2023 (preferência por Power BI; resultado de busca, não aberto): https://www.datahackers.news/p/o-relatorio-do-state-of-data-brazil-2023-esta-no-ar
- Emory University — STEM Resume Guide (resultado de busca, não aberto): https://cpd.emory.edu/resources/stem-resume-guide/
- KDnuggets — 5 Common Data Science Resume Mistakes to Avoid (resultado de busca; acesso bloqueado): https://www.kdnuggets.com/5-common-data-science-resume-mistakes-to-avoid

# Playbook de área: Engenharia de software

Complementa `geral-curriculo.md` e `geral-adaptacao-vaga.md`. Aplica-se a: desenvolvimento backend, frontend, full stack, mobile, DevOps/SRE/plataforma, QA/SDET, tech lead e gestão de engenharia.
Confiança: [A] forte · [M] parcial · [B] convenção.

## O que o recrutador da área procura

- A primeira triagem costuma ser de recrutador **não técnico**, que compara o currículo com os requisitos da vaga; só o gestor técnico interpreta com flexibilidade. Deixe óbvio o encaixe: cargo, anos de experiência, linguagens e tecnologias pedidas. [M]
- O que precisa saltar à vista: cargos e empresas, datas, **linguagens/tecnologias principais**, localização e 1–2 fatos fora da curva (escala, open source, palestra). [M]
- Impacto e contribuição individual vêm antes da lista de tecnologias: o que mudou no sistema ou no negócio por causa do trabalho da pessoa. [A]
- Mito: "o ATS das empresas de tecnologia reprova currículo sozinho". Gestor de contratação ouvido pelo Stack Overflow relata que um humano lê os currículos nessas empresas; desconfie de quem vende a ideia. [M]

## Seções e ordem (o que muda)

- **Experiente (padrão):** Cabeçalho (com GitHub) → Experiência → Habilidades → Formação → Projetos/open source (se relevantes). Experiência vem antes de Habilidades. [M]
- **Júnior/estágio/transição:** Formação → Habilidades → Projetos → Experiência. A seção Projetos pesa mais quanto menos experiência houver; estágio real vem antes de projeto pessoal. [M]
- **Habilidades:** agrupe por categoria (Linguagens · Frameworks · Bancos de dados · Cloud/DevOps · Testes). Sem níveis, barras ou "%"; sem qualificadores como "noções de". Ordene do mais forte e mais pedido pela vaga para o menos. [M]
- Em cada bullet, a tecnologia entra **depois** do impacto e da contribuição ("…usando Kotlin e Kafka"), não como abertura. [M]
- Empresa pouco conhecida: meia linha de contexto ("fintech de crédito, 2 mi de clientes") — só com dado do usuário. [B]
- Projeto: nome + tipo (pessoal, acadêmico, em grupo, open source) + papel individual + stack + resultado verificável + link. [M]

## Métricas típicas

Os números abaixo são ilustrativos; no currículo entram só os números reais do usuário.

- **Escala:** requisições/s, usuários ativos, volume de dados, nº de serviços, tamanho do time.
- **Performance:** latência (p95/p99), tempo de carregamento (LCP), tamanho de bundle, tempo de build, custo de infraestrutura.
- **Confiabilidade (SRE):** disponibilidade/SLO, nº de incidentes, tempo de recuperação.
- **Entrega (DevOps) — métricas DORA:** frequência de deploy, lead time de mudança, taxa de falha de mudança, tempo de recuperação de deploy com falha. [A]
- **Qualidade (QA):** cobertura de testes antes/depois, bugs em produção, tempo de regressão, flakiness da suíte.
- **Mobile:** taxa de crash, nota na loja, instalações, tempo de inicialização.

Ruim: `Desenvolvimento de APIs REST em Java e Spring Boot.`
Bom: `Reduzi o p95 do endpoint de busca de 900 ms para 220 ms com índices compostos e paginação por cursor (Java, PostgreSQL), atendendo ~1.500 req/s.`

Ruim: `Responsável pela pipeline de CI/CD.`
Bom: `Migrei o deploy de manual semanal para contínuo (GitHub Actions + Argo CD), de 1 para ~12 deploys/semana, com rollback automatizado.`

Ruim: `Criação de testes automatizados.`
Bom: `Automatizei 180 cenários de regressão do checkout em Cypress, reduzindo a regressão manual de 2 dias para 40 min por release.`

Ruim: `Trabalhei no app mobile da empresa.`
Bom: `Reescrevi o fluxo de login do app Android em Jetpack Compose, baixando a taxa de crash de 1,8% para 0,3% das sessões.`

## Palavras-chave

Use o termo como a vaga escreve, e só o que o usuário domina a ponto de responder em entrevista técnica.

- **Cargos (PT/EN):** Pessoa Desenvolvedora, Desenvolvedor(a) Backend/Frontend/Full Stack/Mobile, Engenheiro(a) de Software, Software Engineer, SRE, DevOps Engineer, Platform Engineer, Analista de Testes, QA Engineer, SDET, Tech Lead, Engineering Manager.
- **Backend:** APIs REST, GraphQL, gRPC, microsserviços, mensageria (Kafka, RabbitMQ, SQS), SQL/NoSQL, cache, arquitetura orientada a eventos.
- **Frontend/mobile:** React, Angular, Vue, TypeScript, Next.js, acessibilidade (WCAG), design system, React Native, Flutter, Swift, Kotlin.
- **Infra:** AWS/GCP/Azure, Docker, Kubernetes, Terraform, CI/CD, observabilidade (Prometheus, Grafana, Datadog), SLO/SLI, on-call.
- **Qualidade:** testes unitários/integração/E2E, TDD, Cypress, Playwright, Selenium, testes de carga (k6, JMeter), code review.
- **Práticas:** Scrum/Kanban, metodologias ágeis, system design, documentação técnica, mentoria.
- Versão só quando a vaga exigir ou for diferencial real ("Java 21", "Angular 17"). Não liste IDE, sistema operacional ou pacote Office.

## Portfólio e links

- GitHub (ou GitLab) no cabeçalho **se** houver algo para ver: repositórios fixados com README que explique o problema, as decisões e como rodar. Perfil vazio ou só com forks e tutoriais: omita o link. [M]
- Blog técnico: aponte para 1–2 artigos relevantes, não para a home. [M]
- Ao citar um projeto linkado, diga em uma linha por que ele importa (complexidade, práticas, nº de usuários). [M]
- Contribuição open source: nome do projeto + o que foi aceito (PR, feature, correção). Só o que foi de fato mergeado.
- Mobile: link da loja. Frontend: URL em produção. Código de empregador sob sigilo não vira link.
- "Quadradinhos verdes" do GitHub como critério de triagem: sem evidência; não é motivo para incluir ou omitir. [B]

## Por senioridade

- **Júnior/estágio:** 2–3 projetos sólidos com papel individual e stack; formação, monitoria, hackathon e open source no topo. [M]
- **Pleno/sênior:** impacto em produção, escala, decisões de arquitetura, donos de sistemas; projetos pessoais e nota de faculdade saem; progressão de cargos visível. [M]
- **Tech lead/gestão:** tamanho e composição do time, contratações, mentoria, entregas do time e indicadores (prazo, incidentes, rotatividade); menos lista de tecnologias. [B]

## Erros comuns

- Bullets que são só lista de stack ou descrição de tarefas do board. [A]
- Lista de habilidades com tudo que já foi tocado uma vez: cada item vira pergunta de entrevista ou teste.
- Voz passiva/gerúndio de quem só recebeu tarefas ("corrigindo bugs diversos"). [M]
- Negrito em excesso; detalhe antigo empurrando o que é relevante para baixo. [M]
- Atribuir a si o resultado do time ("migramos" virando "migrei").
- Misturar perfis no mesmo currículo (backend + design + suporte) quando a vaga é de um só.

## Na inscrição

- **Triagem típica:** anos de experiência por tecnologia, nível de inglês, regime (CLT x PJ) e pretensão **por regime**, modelo (remoto/híbrido/presencial) e cidade, disponibilidade de início; em vaga do exterior: fuso, autorização de trabalho, contratação como contractor.
- **PJ x CLT (Brasil):** vagas de tecnologia frequentemente são PJ ou "CLT ou PJ"; valores não são comparáveis diretamente (benefícios, impostos, férias). Nunca converta um no outro por conta própria: use o valor que o usuário definiu para aquele regime ou pergunte. [M]
- No currículo, experiência PJ contínua em uma empresa é listada como emprego normal, com o cargo real; freelas para vários clientes ficam agrupados como "Desenvolvedor(a) freelancer". Não rotular PJ como CLT. [B]
- **Etapas comuns:** conversa com RH → teste técnico (plataforma tipo HackerRank/Codility, take-home ou live coding) → entrevista técnica/system design → gestor. [M] Teste, desafio ou link de plataforma no formulário: pare e devolva ao usuário.
- **Pergunte ao usuário antes de candidatar:** stack principal e anos reais em cada tecnologia; aceita PJ? valores por regime; nível de inglês para entrevista; disponibilidade para teste take-home (costuma levar horas); quais repositórios podem ser divulgados; restrição de sigilo/NDA do empregador atual.

## Fontes

- Stack Overflow Blog — How to write an effective developer resume: advice from a hiring manager: https://stackoverflow.blog/2020/11/25/how-to-write-an-effective-developer-resume-advice-from-a-hiring-manager/
- Gergely Orosz (The Pragmatic Engineer), via freeCodeCamp — How to write a developer resume recruiters will read: https://www.freecodecamp.org/news/how-to-write-a-developer-resume-recruiters-will-read/
- DORA — Software delivery performance metrics: https://dora.dev/guides/dora-metrics-four-keys/
- Emory University, Career & Professional Development — STEM Resume Guide (resultado de busca, não aberto): https://cpd.emory.edu/resources/stem-resume-guide/
- University of Florida, Career Connections Center — Technical Resume Guide (resultado de busca, não aberto): https://careerhub.ufl.edu/resources/technical-resume-guide/
- GeekHunter — testes na contratação de desenvolvedores (plataforma de recrutamento tech; fonte comercial): https://www.geekhunter.com/pt/blog/teste-para-desenvolvedor-2/
- TabNews — Como otimizar seu currículo de dev (relato de praticante, não é recrutador): https://www.tabnews.com.br/guilhermegalanti/como-otimizar-seu-curriculo-de-dev-simples-e-rapido
- Revista Oeste / levantamento Infojobs — crescimento de vagas PJ (resultado de busca, não aberto): https://www.revistaoeste.com/economia/vagas-para-pj-crescem-30-em-2-anos-mostra-levantamento/

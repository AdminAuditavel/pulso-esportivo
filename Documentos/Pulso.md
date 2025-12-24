REGISTRO DE DESENVOLVIMENTO

Data: 2025-12-23
Status atual: Documentação de produto + MVP definida (visão, fontes, metodologia IAP, stack e plano 14 dias).
Decisões consolidadas:

Dados públicos apenas; sem comentários individuais; transparência metodológica.

MVP = ranking Top 5/10 “Times mais comentados hoje”, janela 24h, Reddit/YouTube/Trends.
Pendências abertas (alto nível):

Definir lista inicial de times (e sinônimos/aliases).

Definir estratégia de matching (time/termos) para contagem de menções.

Implementar pipeline: coleta → agregação → normalização → IAP → persistência → API → frontend.


# Visão do Produto – Plataforma Pública de Tendências Esportivas

## 1. Visão Geral
A plataforma será um **painel público de inteligência (esportiva, política, cultural, tecnológica etc)**, criado para mostrar, de forma clara e acessível, **quais assuntos estão gerando mais atenção e discussão pública na internet**, usando **exclusivamente dados públicos e sem restrições**.

O produto transforma grandes volumes de conversas abertas em **rankings, gráficos e indicadores**, sem expor comentários individuais ou dados pessoais.

---

## 2. Problema
Hoje:
- As pessoas sabem *o que aconteceu* no esporte (placar, estatísticas), mas não sabem **qual é o clima do público**.
- Dados de conversas existem, mas estão presos em **ferramentas fechadas, caras ou técnicas**.
- Não há um local público que mostre, de forma contínua, **quais times, atletas ou eventos estão dominando a atenção das pessoas**.

---

## 3. Objetivo do Produto
Ser a **principal referência pública** para entender o *termômetro do esporte*, respondendo perguntas como:
- Quais times estão sendo mais comentados hoje?
- Qual jogo gerou mais reação do público?
- Um atleta está em alta ou em crise?
- O interesse está crescendo ou diminuindo?

---

## 4. Público-Alvo
- Torcedores interessados em tendências
- Jornalistas e criadores de conteúdo esportivo
- Sites e portais esportivos
- Plataformas de apostas e análise
- Profissionais de marketing esportivo

---

## 5. Fontes de Dados
A plataforma utilizará apenas **fontes públicas e abertas**:
- Fóruns esportivos (ex.: Reddit)
- Comentários públicos em vídeos esportivos (ex.: YouTube)
- Páginas informativas abertas (ex.: Wikipedia)
- Interesse de busca (ex.: Google Trends)
- Conteúdo esportivo da web aberta

Não serão utilizadas redes sociais fechadas ou com restrições de redistribuição.

---

## 6. Princípios do Produto
- **Dados públicos apenas**
- **Nada de comentários individuais**
- **Transparência metodológica**
- **Visual simples e direto**
- **Atualização frequente**
- **Neutralidade editorial**

---

## 7. Produto Inicial (MVP)

### Objetivo do MVP
Validar se existe interesse recorrente do público em **rankings de atenção esportiva baseados em dados públicos**, com o menor custo, complexidade e risco possíveis.

### O que ENTRA no MVP

#### 1. Ranking Principal
**“Times mais comentados do dia”**

Conteúdo:
- Top 5 ou Top 10 times
- Janela de tempo: últimas 24 horas
- Atualização: 1 a 2 vezes por dia

Indicadores exibidos:
- Volume relativo de menções
- Tendência (em alta / em queda / estável)
- Sentimento agregado (positivo, neutro, negativo)

---

#### 2. Fontes de Dados (limitadas)
- Reddit (subreddits esportivos relevantes)
- YouTube (comentários em vídeos esportivos recentes)
- Google Trends (interesse de busca)

---

#### 3. Visualização
- Página única no site (home)
- Tabela simples do ranking
- Indicadores visuais básicos (setas, cores, ícones)
- Texto curto explicando o que o ranking significa

---

#### 4. Transparência
- Explicação simples da metodologia
- Disclaimer claro:
  > “Este ranking mede atenção e discussão pública, não desempenho esportivo.”

---

### O que FICA FORA do MVP

- Comentários individuais ou exemplos de textos
- Perfis de usuários ou autores
- Análise por jogador
- Análise por partida específica
- Estatísticas de jogo (gols, posse, xG etc.)
- App mobile
- Login de usuário
- Personalização
- Alertas em tempo real
- Inteligência artificial avançada
- Monetização ativa

---

### Métrica de Sucesso do MVP
- Atualização diária consistente
- Cliques e visitas recorrentes
- Compartilhamentos do ranking
- Feedback espontâneo do público

---


## 8. Metodologia do Ranking

### Objetivo da Metodologia
Garantir que o ranking seja:
- Compreensível para qualquer pessoa
- Reprodutível tecnicamente
- Transparente
- Baseado apenas em dados públicos

O ranking **não mede qualidade esportiva**, apenas **nível de atenção e discussão pública**.

---

### Janela de Tempo
- Período padrão: **últimas 24 horas**
- Comparação: 24h atuais vs 24h anteriores

---

### Fontes Utilizadas no MVP
- Reddit: posts e comentários em subreddits esportivos
- YouTube: comentários em vídeos esportivos publicados recentemente
- Google Trends: interesse de busca pelo nome do time

Cada fonte gera um **indicador independente**, que depois é normalizado.

---

### Indicadores Calculados

#### 1. Volume de Atenção (VA)
Mede quanto um time foi citado ou discutido.
- Contagem relativa de menções por fonte
- Normalização em escala 0–100

---

#### 2. Tendência de Crescimento (TC)
Compara o volume atual com o período anterior.
- Crescimento positivo → Em alta
- Estável → Sem variação relevante
- Queda → Em baixa

---

#### 3. Sentimento Agregado (SA)
Classificação geral das conversas.
- Positivo
- Neutro
- Negativo

O sentimento é sempre apresentado de forma **agregada**, nunca por comentário individual.

---

### Índice de Atenção Pública (IAP)

O ranking final usa um índice simples:

- 60% Volume de Atenção
- 25% Tendência de Crescimento
- 15% Interesse de Busca (Google Trends)

O resultado é um número de 0 a 100 que permite ordenar os times.

---

### Regras Importantes
- Nenhum texto de comentário é exibido
- Nenhum usuário é identificado
- Apenas métricas agregadas são publicadas
- Metodologia pública e fixa

---

### Limitações Conhecidas
- O ranking reflete apenas fontes abertas
- Pode haver picos causados por eventos pontuais
- Não representa opinião de toda a população

Essas limitações são sempre comunicadas ao usuário.

---

## 9. Monetização (futuro)
- Publicidade no site
- Afiliados (apostas, conteúdo esportivo)
- Relatórios premium
- Licenciamento de indicadores agregados

---

## 10. Sucesso do Produto
O produto será bem-sucedido se:
- Usuários retornarem diariamente
- Rankings forem compartilhados
- A plataforma virar referência para "o que está em alta no esporte"

---

## 11. Stack Técnica (100% Gratuita – MVP)

### Objetivo da Stack
Permitir que **uma única pessoa** construa, publique e mantenha o MVP com **baixo custo, baixa complexidade e alta confiabilidade**, usando apenas ferramentas gratuitas.

---

### 1. Coleta de Dados
- **Reddit API (gratuita)**: coleta de posts e comentários públicos em subreddits esportivos
- **YouTube Data API (free tier)**: coleta de comentários públicos em vídeos esportivos recentes
- **Google Trends (pytrends)**: interesse de busca por times

Boas práticas:
- Respeitar limites de requisição
- Coletar apenas IDs e métricas agregáveis
- Evitar armazenar texto bruto quando possível

---

### 2. Processamento
- **Python 3**
- Bibliotecas:
  - pandas (agregação)
  - numpy (normalização)
  - scikit-learn ou alternativa simples (sentimento básico)

Tarefas:
- Normalização dos indicadores
- Cálculo do Índice de Atenção Pública (IAP)
- Geração do ranking diário

---

### 3. Armazenamento
- **PostgreSQL gratuito** (Neon / Supabase free tier)
- Tabelas pequenas:
  - times
  - métricas agregadas
  - rankings diários

❌ Não armazenar comentários individuais

---

### 4. Backend / Automação
- **FastAPI** (API simples)
- **Cron jobs** (GitHub Actions ou plataforma gratuita)

Funções:
- Atualizar dados 1–2x por dia
- Recalcular ranking
- Servir dados para o site

---

### 5. Frontend
- **Site estático**
- Opções:
  - HTML + CSS + JS simples
  - Next.js estático (opcional)

Componentes:
- Tabela de ranking
- Indicadores visuais simples
- Texto explicativo

---

### 6. Hospedagem
- **Frontend**: Vercel / Netlify (gratuito)
- **Backend**: Render / Railway (free tier)
- **Banco**: Neon / Supabase

---

### 7. Monitoramento Básico
- Logs simples no backend
- Alertas manuais (email)

---

### 8. O que NÃO usar no MVP
- Microserviços
- Big Data
- Streaming em tempo real
- IA pesada
- App mobile

---

### Regra Técnica do MVP
> **Se não pode ser mantido por uma pessoa, está complexo demais.**

---

## 12. Wireframe da Home (MVP)

### Objetivo da Home
Permitir que qualquer visitante **entenda o valor da plataforma em menos de 10 segundos** e consiga ver rapidamente **quais times estão dominando a atenção pública hoje**.

A home é **o produto**.

---

### Estrutura da Página (de cima para baixo)

#### 1. Header
- Nome da plataforma
- Subtítulo curto:
  > "Ranking público de atenção esportiva baseado em dados abertos"

Sem menu complexo.

---

#### 2. Destaque Principal (Hero)
- Título grande:
  > **Times mais comentados hoje**
- Texto explicativo curto:
  > "Este ranking mostra quais times estão gerando mais discussão pública nas últimas 24h, com base em dados abertos da internet."

- Data e hora da última atualização

---

#### 3. Ranking (Elemento Central)

Tabela simples e escaneável:

Colunas:
- Posição
- Time
- Índice de Atenção Pública (0–100)
- Tendência (↑ ↓ →)
- Sentimento (🙂 😐 🙁)

Características:
- Top 5 ou Top 10 apenas
- Ordenação fixa
- Atualização automática

---

#### 4. Explicação Rápida (Como ler o ranking)
Bloco curto em linguagem simples:
- O que é o índice
- O que significa tendência
- O que NÃO significa (não é desempenho esportivo)

---

#### 5. Gráfico Simples (Opcional no MVP)
- Evolução do Top 3 nas últimas 24h
- Linha ou barras simples

---

#### 6. Transparência
Link ou bloco curto:
- Fontes utilizadas
- Metodologia resumida
- Disclaimer legal

---

#### 7. Rodapé
- Texto simples:
  > "Dados públicos. Métricas agregadas. Sem comentários individuais."
- Contato (email)

---

### Princípios Visuais
- Fundo claro
- Alto contraste
- Tipografia simples
- Sem excesso de cores
- Ícones apenas para tendência e sentimento

---

### Regra de UX
> **Se precisar explicar em vídeo, está complexo demais.**

---

## 13. Plano de Execução – 14 Dias (MVP no Ar)

### Objetivo do Plano
Colocar o MVP **funcionando, público e atualizando automaticamente** em até 14 dias, trabalhando sozinho e usando apenas ferramentas gratuitas.

---

### Dia 1 – Organização
- Criar repositório Git
- Criar README simples com objetivo do projeto
- Definir lista inicial de times (ex: 20–30)

---

### Dia 2 – Acesso às Fontes
- Criar conta Reddit Developer
- Criar chave YouTube Data API
- Testar acesso ao Google Trends (pytrends)

---

### Dia 3 – Scripts de Coleta (Reddit)
- Coletar posts e comentários por time
- Armazenar apenas contagens agregadas
- Log básico de erros

---

### Dia 4 – Scripts de Coleta (YouTube)
- Buscar vídeos recentes por palavra-chave
- Agregar comentários por time
- Validar limites de API

---

### Dia 5 – Google Trends
- Coletar interesse de busca por time
- Normalizar dados

---

### Dia 6 – Processamento
- Normalizar indicadores
- Calcular Volume de Atenção
- Calcular Tendência

---

### Dia 7 – Sentimento Básico
- Implementar classificação simples
- Testar com dados agregados

---

### Dia 8 – Índice Final
- Calcular Índice de Atenção Pública (IAP)
- Gerar ranking diário
- Validar resultados manualmente

---

### Dia 9 – Banco de Dados
- Criar schema simples
- Salvar rankings diários
- Testar leitura

---

### Dia 10 – Backend
- Criar FastAPI
- Endpoint público: /ranking

---

### Dia 11 – Frontend
- Página única
- Tabela do ranking
- Indicadores visuais

---

### Dia 12 – Deploy
- Subir backend
- Subir frontend
- Conectar API

---

### Dia 13 – Automação
- Agendar execução diária
- Validar atualização automática

---

### Dia 14 – Lançamento
- Revisar textos e disclaimers
- Compartilhar link
- Observar uso real

---

### Regra do Plano
> **Feito é melhor que perfeito.**

---

## 14. Frase-Guia do Produto
> **Transformar conversas públicas sobre esporte em inteligência clara, acessível e aberta.**


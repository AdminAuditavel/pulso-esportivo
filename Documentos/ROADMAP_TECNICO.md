# Pulso — Roadmap Técnico

Este documento descreve a evolução técnica do Pulso de forma incremental,
mantendo coerência com a tese do produto, o valor público e os princípios
fundamentais de privacidade, neutralidade e uso exclusivo de dados públicos.

O roadmap é organizado por **fases**, não por datas rígidas.

---

## Fase 0 — Base Validada (estado atual)

### Status: ✅ Concluída

Esta fase valida a arquitetura central do produto.

### O que já está pronto
- Banco de dados no Supabase
- Pipeline funcional (hourly → daily)
- Normalização por fonte
- Agregação diária via RPC
- Cálculo de score composto (IAP)
- Rankings diários
- API pública (FastAPI)
- Privacidade por design (dados agregados apenas)
- Estrutura preparada para múltiplas fontes

### Valor entregue
- Prova técnica do método
- Validação conceitual do produto
- Base sólida para expansão sem retrabalho

---

## Fase 1 — Coleta Real Inicial (Entidades)

### Objetivo
Substituir o mock por coleta real **mínima**, mantendo controle e previsibilidade.

### Escopo técnico
- Implementar coleta real para **1 fonte principal** (ex.: Reddit)
- Manter coleta simples e transparente
- Inserir dados diretamente em `time_bucket_metrics`

### Tarefas
- Implementar coletor real (Reddit)
- Mapear termos a partir da tabela `clubs`
- Respeitar janelas horárias
- Garantir idempotência por bucket
- Manter logs simples de execução

### Critério de conclusão
- Ranking diário baseado em dados reais
- Pipeline funcionando sem intervenção manual

---

## Fase 2 — Consolidação da API Pública

### Objetivo
Transformar a API em uma interface estável para consumo externo.

### Escopo técnico
- Padronização de endpoints
- Filtros simples (data, top N)
- Estrutura de resposta consistente

### Tarefas
- Versionar API (`/v1`)
- Ajustar endpoints para leitura pública
- Garantir uso exclusivo de `anon key`
- Documentar endpoints básicos

### Critério de conclusão
- API consumível por front-end sem adaptações
- Respostas previsíveis e auditáveis

---

## Fase 3 — Front-end Público Inicial

### Objetivo
Exibir o Pulso de forma clara e acessível ao público geral.

### Escopo técnico
- Front-end simples (Next.js ou equivalente)
- Foco em leitura, não interação
- Sem login, sem personalização

### Funcionalidades
- Ranking diário
- Indicadores básicos
- Atualização por data
- Explicação do que o indicador representa

### Critério de conclusão
- Usuário entende “o que está quente hoje” em poucos segundos
- Interface reforça neutralidade e confiança

---

## Fase 4 — Introdução de Temas

### Objetivo
Adicionar camada explicativa ao ranking de entidades.

### Escopo técnico
- Definição de temas como entidades abstratas
- Associação indireta entre temas e menções
- Métricas agregadas por tema

### Tarefas
- Criar tabela de temas
- Mapear palavras-chave por tema
- Agregar volume e sentimento por tema
- Expor rankings temáticos

### Critério de conclusão
- Capacidade de responder “sobre o que estão falando”
- Temas explicam variações de entidades

---

## Fase 5 — Eventos e Análise Temporal

### Objetivo
Contextualizar picos de atenção no tempo.

### Escopo técnico
- Detecção simples de picos
- Associação de eventos a datas
- Visualização de evolução temporal

### Tarefas
- Identificar picos de volume
- Criar entidade “evento”
- Relacionar eventos a temas e entidades
- Expor timelines simples

### Critério de conclusão
- Capacidade de leitura histórica da atenção pública
- Identificação clara de início, pico e dissipação

---

## Fase 6 — Expansão de Domínios

### Objetivo
Expandir além do esporte sem alterar o método.

### Escopo técnico
- Política
- Ciência e tecnologia
- Economia
- Temas sociais

### Estratégia
- Reutilizar pipeline
- Alterar apenas entidades observadas
- Manter princípios intactos

### Critério de conclusão
- Pulso reconhecido como método de leitura de atenção pública
- Esporte torna-se um eixo, não um limite

---

## Fase 7 — Transparência e Auditoria Pública

### Objetivo
Aumentar confiança e legitimidade pública.

### Escopo técnico
- Publicar metodologia
- Explicar pesos e métricas
- Tornar decisões explícitas

### Tarefas
- Documentar cálculo do score
- Expor limitações do método
- Criar página de metodologia

### Critério de conclusão
- Produto compreensível mesmo para céticos
- Confiança baseada em clareza, não autoridade

---

## Princípios que NÃO mudam em nenhuma fase

- Uso exclusivo de dados públicos
- Métricas apenas agregadas
- Nenhum dado pessoal
- Nenhuma personalização
- Neutralidade estrutural
- Transparência metodológica

---

## Síntese final

O roadmap do Pulso não busca complexidade técnica,
mas **clareza progressiva da leitura coletiva da realidade**.

Cada fase adiciona contexto, não ruído.

O produto evolui como método,
não como plataforma de engajamento.

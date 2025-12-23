1. Objetivo do Projeto - Pulso Esportivo

O Pulso Esportivo é uma plataforma pública que analisa dados de interações online para medir a popularidade de clubes de futebol. Usando dados de fontes públicas, como redes sociais e buscas, ele gera um ranking diário, agregando métricas de volume e sentimento.

2. Estrutura do Projeto

A estrutura de diretórios do seu projeto é a seguinte:

API (FastAPI): Para servir os dados através de endpoints RESTful.

Pipeline: Processa dados e interage com o banco de dados do Supabase.

Banco de Dados (Supabase): Armazena as métricas e rankings dos clubes.

Scripts: Para automação de coleta de dados de plataformas como YouTube.

3. Componentes Detalhados
a) API (FastAPI)

A API é responsável por servir os dados aos usuários via endpoints. Ela foi configurada com FastAPI para ser simples e rápida. Cada endpoint consulta o banco de dados do Supabase e retorna dados estruturados.

main.py (Arquivo principal da API):

Usa o FastAPI para criar os endpoints.

Conecta-se ao Supabase usando as variáveis de ambiente para acessar os dados.

O arquivo contém vários endpoints para diferentes dados:

/daily_ranking: Retorna o ranking diário dos clubes.

/clubs: Retorna os dados dos clubes.

/sources: Retorna as fontes de dados utilizadas (Reddit, YouTube, Google Trends).

/daily_iap: Retorna o ranking IAP diário dos clubes.

Outros endpoints podem ser criados no futuro, como filtros para o ranking por data ou outras métricas.

b) Banco de Dados (Supabase)

O Supabase foi configurado como banco de dados para armazenar as métricas coletadas. Ele é acessado pela API para gerar rankings e outras análises.

Tabelas no Supabase:

clubs: Armazena informações dos clubes de futebol (nome, palavras-chave, status).

sources: Armazena informações sobre as fontes de dados (Reddit, YouTube, etc.).

daily_ranking: Armazena o ranking diário dos clubes com base no volume de interações e outras métricas.

daily_iap: Armazena o IAP diário, que é uma combinação de várias métricas como volume, sentimento, etc.

time_bucket_metrics: Armazena métricas agregadas por período (como menções por hora).

Essas tabelas são a base para o cálculo do ranking diário e o acompanhamento das interações com os clubes.

c) Pipeline

O pipeline é o processo que coleta e processa dados, gerando as métricas que são armazenadas no banco de dados. Ele é implementado em scripts Python que interagem diretamente com a API do Supabase.

scripts no pipeline:

aggregate_daily.py: Este script executa a agregação diária das métricas (como volume e sentimentos), invocando a função aggregate_daily_metrics no Supabase para processar e armazenar os dados.

normalize_hourly.py: Este script normaliza as métricas coletadas por hora, ajustando os volumes para comparações justas entre diferentes fontes de dados.

collect_hourly_mock.py: Coleta dados fictícios (mock) de fontes como o Reddit e o YouTube para gerar métricas simuladas e inserir na tabela time_bucket_metrics.

test_connection.py: Verifica se a conexão com o banco de dados está funcionando corretamente, fazendo uma consulta simples na tabela de clubes.

d) Coleta de Dados

A coleta de dados é feita através de feedparser para YouTube e outras fontes. Além disso, o Supabase é acessado para buscar dados de interações (menções).

youtube_collect.py: Este script coleta menções dos clubes no YouTube. Ele usa a API do YouTube para buscar vídeos relacionados a cada clube e contabiliza a quantidade de vídeos postados nas últimas 24 horas. Ele usa a função collect_youtube_mentions para obter os dados de cada clube.

e) Variáveis de Ambiente

As variáveis de ambiente são carregadas do arquivo .env, o que facilita a configuração e o acesso seguro ao Supabase. As variáveis armazenadas incluem:

SUPABASE_URL: A URL do projeto no Supabase.

SUPABASE_KEY: A chave de serviço para acessar a API do Supabase.

f) Front-End (em potencial)

Atualmente, não há um front-end implementado, mas você pode integrar a API com uma aplicação Next.js ou qualquer outra tecnologia front-end. O front-end poderá consumir os dados dos endpoints da API e exibi-los de forma interativa, como um painel de ranking dos clubes.

4. Fluxo de Dados

Aqui está o fluxo de como os dados são coletados, processados e disponibilizados:

Coleta de Dados:

O script youtube_collect.py coleta dados de menções no YouTube.

Outros scripts podem coletar dados de diferentes fontes (como Reddit, Google Trends) e inserir esses dados na tabela time_bucket_metrics no Supabase.

Normalização e Agregação:

O script normalize_hourly.py processa os dados coletados, normalizando o volume de interações para diferentes fontes.

O script aggregate_daily.py realiza a agregação diária das métricas, calculando o ranking dos clubes com base no volume e sentimento.

Exibição dos Dados:

A API expõe endpoints como /daily_ranking para exibir os dados do ranking diário dos clubes.

O front-end pode consumir esses dados e exibi-los ao usuário final, mostrando, por exemplo, o clube mais popular do dia.

5. Resultados Esperados

Com a implementação atual, você pode esperar os seguintes resultados:

Ranking Diário de Clubes: A plataforma gera um ranking de clubes com base nas interações online (menções, volume, sentimento).

Monitoramento de Fontes: As fontes de dados como Reddit, YouTube e Google Trends são monitoradas e suas métricas são agregadas diariamente.

Exibição Interativa: A API pode ser integrada com um front-end para exibir os rankings, análises de sentimento e outras métricas de maneira interativa.

from fastapi import FastAPI
from db.supabase import supabase
import os
from dotenv import load_dotenv

# Carregar as variáveis de ambiente
load_dotenv()

app = FastAPI()

# Carregar as variáveis do .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Função para calcular o IAP e gerar o ranking
def get_ranking():
    # Buscar os dados do ranking na tabela 'daily_ranking' (ajustado)
    ranking_data = (
        supabase.table("daily_ranking")  # Alterado para a tabela correta
        .select("club_id, rank_position, score, volume_total")
        .execute()
        .data
    )
    return ranking_data

@app.get("/ranking")
def read_ranking():
    ranking = get_ranking()
    return {"ranking": ranking}

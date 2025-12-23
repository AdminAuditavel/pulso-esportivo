#api/main.py

from fastapi import FastAPI
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Carregar as variáveis de ambiente
load_dotenv()

app = FastAPI()

# Configurações do Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Endpoint de teste
@app.get("/")
def read_root():
    return {"message": "Pulso Esportivo API funcionando!"}

# Endpoint para pegar dados da tabela daily_ranking
@app.get("/daily_ranking")
async def get_daily_ranking():
    try:
        response = supabase.table("daily_ranking").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        return {"error": str(e)}

# Endpoint para pegar dados da tabela clubs
@app.get("/clubs")
async def get_clubs():
    try:
        response = supabase.table("clubs").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        return {"error": str(e)}

# Endpoint para pegar dados da tabela daily_iap
@app.get("/daily_iap")
async def get_daily_iap():
    try:
        response = supabase.table("daily_iap").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        return {"error": str(e)}

# Endpoint para pegar dados da tabela daily_iap_ranking
@app.get("/daily_iap_ranking")
async def get_daily_iap_ranking():
    try:
        response = supabase.table("daily_iap_ranking").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        return {"error": str(e)}

# Endpoint para pegar dados da tabela sources
@app.get("/sources")
async def get_sources():
    try:
        response = supabase.table("sources").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        return {"error": str(e)}

# Endpoint para pegar dados da tabela daily_aggregations_v2
@app.get("/daily_aggregations_v2")
async def get_daily_aggregations_v2():
    try:
        response = supabase.table("daily_aggregations_v2").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        return {"error": str(e)}

# Endpoint para pegar dados da tabela time_bucket_metrics
@app.get("/time_bucket_metrics")
async def get_time_bucket_metrics():
    try:
        response = supabase.table("time_bucket_metrics").select("*").execute()
        return {"data": response.data}
    except Exception as e:
        return {"error": str(e)}

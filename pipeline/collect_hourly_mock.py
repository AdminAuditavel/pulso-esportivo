from datetime import datetime, timedelta, timezone
import random

from db.supabase import supabase


def get_bucket_start():
    """
    Retorna o início da hora anterior (UTC).
    """
    now = datetime.now(timezone.utc)
    return now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)


def main():
    bucket_start = get_bucket_start()
    print(f"Gerando bucket mock para: {bucket_start.isoformat()}")

    clubs = (
        supabase.table("clubs")
        .select("id")
        .eq("active", True)
        .execute()
        .data
    )

    sources = (
        supabase.table("sources")
        .select("id, code")
        .eq("active", True)
        .execute()
        .data
    )

    if not clubs or not sources:
        raise RuntimeError("Clubes ou fontes não encontrados")

    inserts = []

    for source in sources:
        for club in clubs:
            inserts.append({
                "club_id": club["id"],
                "source_id": source["id"],
                "bucket_start": bucket_start.isoformat(),
                "bucket_size_minutes": 60,
                "volume_raw": random.randint(10, 80),
                "sentiment_score": round(random.uniform(-0.4, 0.7), 2)
            })

    response = (
        supabase.table("time_bucket_metrics")
        .insert(inserts)
        .execute()
    )

    print(f"Inseridos {len(response.data)} registros em time_bucket_metrics")


if __name__ == "__main__":
    main()

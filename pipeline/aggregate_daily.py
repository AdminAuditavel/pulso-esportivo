# pulso-esportivo/pipeline/aggregate_daily.py

from datetime import datetime, timedelta

from db.supabase import supabase


def get_day_window():
    """
    Retorna o intervalo das últimas 24h,
    compatível com timestamp without time zone.
    """
    end = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(hours=24)
    return start, end, end.date()


def main():
    start_ts, end_ts, day = get_day_window()

    start_str = start_ts.strftime("%Y-%m-%d %H:%M:%S")
    end_str = end_ts.strftime("%Y-%m-%d %H:%M:%S")

    print(f"Agregando dados do dia {day}")
    print(f"Intervalo: {start_str} → {end_str}")

    metrics = (
        supabase.table("time_bucket_metrics")
        .select(
            "club_id, source_id, volume_normalized, sentiment_score"
        )
        .gte("bucket_start", start_str)
        .lt("bucket_start", end_str)
        .execute()
        .data
    )

    if not metrics:
        print("Nenhum dado encontrado para agregação")
        return

    # Agrupar manualmente (MVP simples)
    grouped = {}

    for m in metrics:
        key = (m["club_id"], m["source_id"])
        grouped.setdefault(key, {
            "club_id": m["club_id"],
            "source_id": m["source_id"],
            "volumes": [],
            "sentiments": []
        })

        if m["volume_normalized"] is not None:
            grouped[key]["volumes"].append(m["volume_normalized"])

        if m["sentiment_score"] is not None:
            grouped[key]["sentiments"].append(m["sentiment_score"])

    inserts = []

    for g in grouped.values():
        if not g["volumes"]:
            continue

        inserts.append({
            "club_id": g["club_id"],
            "source_id": g["source_id"],
            "day": str(day),
            "volume_avg": round(sum(g["volumes"]) / len(g["volumes"]), 2),
            "volume_max": max(g["volumes"]),
            "sentiment_avg": round(
                sum(g["sentiments"]) / len(g["sentiments"]), 2
            ) if g["sentiments"] else None,
            "buckets_count": len(g["volumes"]),
            "created_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        })

    if not inserts:
        print("Nada para inserir após agregação")
        return

    response = (
        supabase.table("daily_aggregations")
        .insert(inserts)
        .execute()
    )

    print(f"Inseridos {len(response.data)} registros em daily_aggregations")


if __name__ == "__main__":
    main()

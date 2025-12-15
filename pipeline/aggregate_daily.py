# pulso-esportivo/pipeline/aggregate_daily.py

from datetime import datetime, timedelta

from db.supabase import supabase


def get_day_window():
    """
    Retorna intervalo das últimas 24h (UTC),
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
        .select("club_id, volume_raw, volume_normalized, sentiment_score")
        .gte("bucket_start", start_str)
        .lt("bucket_start", end_str)
        .execute()
        .data
    )

    if not metrics:
        print("Nenhum dado encontrado para agregação")
        return

    grouped = {}

    for m in metrics:
        club_id = m["club_id"]

        grouped.setdefault(club_id, {
            "club_id": club_id,
            "volume_raw": [],
            "volume_normalized": [],
            "sentiments": []
        })

        if m["volume_raw"] is not None:
            grouped[club_id]["volume_raw"].append(m["volume_raw"])

        if m["volume_normalized"] is not None:
            grouped[club_id]["volume_normalized"].append(m["volume_normalized"])

        if m["sentiment_score"] is not None:
            grouped[club_id]["sentiments"].append(m["sentiment_score"])

    inserts = []

    for g in grouped.values():
        if not g["volume_raw"]:
            continue

        inserts.append({
            "club_id": g["club_id"],
            "aggregation_date": str(day),
            "volume_total": sum(g["volume_raw"]),
            "volume_normalized": round(
                sum(g["volume_normalized"]) / len(g["volume_normalized"]), 2
            ) if g["volume_normalized"] else None,
            "sentiment_score": round(
                sum(g["sentiments"]) / len(g["sentiments"]), 2
            ) if g["sentiments"] else None,
            "calculated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "created_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        })

    response = (
        supabase.table("daily_aggregations_v2")
        .insert(inserts)
        .execute()
    )

    print(f"Inseridos {len(response.data)} registros em daily_aggregations")


if __name__ == "__main__":
    main()

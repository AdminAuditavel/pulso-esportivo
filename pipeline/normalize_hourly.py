from datetime import datetime, timedelta, timezone

from db.supabase import supabase


def get_bucket_start():
    """
    Retorna o início da hora anterior (UTC),
    mesma regra da coleta.
    """
    now = datetime.now(timezone.utc)
    return now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)


def main():
    bucket_start = get_bucket_start()
    print(f"Normalizando bucket: {bucket_start.isoformat()}")

    # Buscar todas as fontes ativas
    sources = (
        supabase.table("sources")
        .select("id, code")
        .eq("active", True)
        .execute()
        .data
    )

    for source in sources:
        metrics = (
            supabase.table("time_bucket_metrics")
            .select("id, volume_raw")
            .eq("source_id", source["id"])
            .eq("bucket_start", bucket_start)
            .execute()
            .data
        )

        if not metrics:
            print(f"Fonte {source['code']}: sem dados")
            continue

        max_volume = max(m["volume_raw"] for m in metrics) or 1

        print(
            f"Fonte {source['code']}: "
            f"{len(metrics)} registros, max_volume={max_volume}"
        )

        for m in metrics:
            volume_normalized = round((m["volume_raw"] / max_volume) * 100, 2)

            (
                supabase.table("time_bucket_metrics")
                .update({"volume_normalized": volume_normalized})
                .eq("id", m["id"])
                .execute()
            )

    print("Normalização concluída")


if __name__ == "__main__":
    main()

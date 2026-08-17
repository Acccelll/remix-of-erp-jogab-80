#!/usr/bin/env python3
"""
DB-003 (Onda 1) — Gera o índice cronológico legível das migrations.

Uso:  python3 scripts/db/gen-migrations-index.py

Lê `supabase/migrations/*.sql`, extrai a primeira linha significativa
(comentário `--` ou primeiro DDL) e produz `supabase/migrations/INDEX.md`.
Não altera migrations existentes; apenas indexa.
"""
import os, re, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = os.path.join(ROOT, "supabase", "migrations")
OUT_DIR = os.path.join(ROOT, "docs", "db")


def ementa(path: str) -> str:
    try:
        with open(path, "r", errors="replace") as fh:
            content = fh.read()
    except OSError as e:
        return f"(erro leitura: {e})"
    m = re.search(r"^\s*--\s*(.+)$", content, re.MULTILINE)
    if m:
        return m.group(1).strip()[:120]
    m = re.search(
        r"^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|GRANT|REVOKE)\b.+",
        content,
        re.IGNORECASE | re.MULTILINE,
    )
    if m:
        return re.sub(r"\s+", " ", m.group(0)).strip()[:120]
    return ""


def main() -> int:
    files = sorted(f for f in os.listdir(D) if f.endswith(".sql"))
    if not files:
        print("Nenhuma migration encontrada.", file=sys.stderr)
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, "MIGRATIONS_INDEX.md")
    with open(out_path, "w") as out:
        out.write("# Índice cronológico de migrations\n\n")
        out.write("> Auto-gerado por `scripts/db/gen-migrations-index.py` (DB-003 · Onda 1).\n")
        out.write("> Regeração: `python3 scripts/db/gen-migrations-index.py`.\n\n")

        first = files[0][:12]
        last = files[-1][:12]
        window = f"{first[:4]}-{first[4:6]}-{first[6:8]} {first[8:10]}:{first[10:12]} → "
        window += f"{last[:4]}-{last[4:6]}-{last[6:8]} {last[8:10]}:{last[10:12]}"
        out.write(f"Total: **{len(files)}** migrations · janela: {window}\n\n")

        out.write("| # | Data/Hora | Arquivo | Ementa (primeira linha) |\n")
        out.write("|--:|-----------|---------|-------------------------|\n")
        for i, f in enumerate(files, 1):
            ts = f[:12]
            dt = f"{ts[:4]}-{ts[4:6]}-{ts[6:8]} {ts[8:10]}:{ts[10:12]}"
            em = ementa(os.path.join(D, f)).replace("|", "\\|")
            out.write(f"| {i} | {dt} | `{f}` | {em} |\n")

    print(f"OK — {len(files)} entradas em {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Export tables from the latest legacy MDB (docs/data/2026B.mdb) to CSV for migration."""

import csv
import os
import sys

from access_parser import AccessParser

MDB_PATH = "/home/amar-salim/Documents/Projects/pos-business/docs/data/2026B.mdb"
OUT_DIR = "/home/amar-salim/Documents/Projects/pos-business/docs/data/2026B_csv"

TABLES = [
    "ITEMS",
    "GroupsT",
    "GRNs",
    "Movements",
    "Movements2",
    "StockBalances",
    "Suppliers",
]


def main() -> None:
    db = AccessParser(MDB_PATH)
    os.makedirs(OUT_DIR, exist_ok=True)

    for name in TABLES:
        try:
            table = db.parse_table(name)
        except Exception as e:
            print(f"FAIL {name}: {e}")
            continue
        if not table:
            print(f"EMPTY {name}")
            continue

        cols = list(table.keys())
        row_count = len(table[cols[0]])
        out_path = os.path.join(OUT_DIR, f"{name}.csv")
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(cols)
            for i in range(row_count):
                writer.writerow(
                    ["" if table[c][i] is None else table[c][i] for c in cols]
                )
        print(f"OK {name}: {row_count} rows -> {out_path}")


if __name__ == "__main__":
    sys.exit(main())

"""Resale comps. $0 + ToS-safe approach: a CSV YOU fill from marketplace 'Sold items'
searches (about 2 min/item). Columns: title,price,kind,n   (kind: sold|asking|manual)."""
import csv
import statistics
from .models import Comp
from .normalize import product_key, similarity, model_numbers
from . import config

MATCH_THRESHOLD = 0.5


def load_comps_csv(path: str):
    out = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if not row.get("title") or not row.get("price"):
                continue
            out.append((row["title"], Comp(key=product_key(row["title"]), price=float(row["price"]),
                                           kind=(row.get("kind") or "manual").strip(),
                                           n=int(row.get("n") or 1), source="csv")))
    return out


def best_comp(title: str, comps):
    """Return (Comp, similarity) for the closest comp. If both have model numbers they must overlap."""
    mn = model_numbers(title)
    best, best_s = None, 0.0
    for ctitle, comp in comps:
        cm = model_numbers(ctitle)
        if mn and cm and mn != cm:
            continue
        s = similarity(title, ctitle)
        if s > best_s:
            best, best_s = comp, s
    if best_s < MATCH_THRESHOLD:
        return None, best_s
    return best, best_s


def effective_resale(comp: Comp) -> float:
    """Asking-price comps are shaved; sold comps are used as-is (still haircut by risk margin later)."""
    return comp.price * (config.ASKING_COMP_DISCOUNT if comp.kind == "asking" else 1.0)


def median_price(prices):
    return statistics.median(prices) if prices else None

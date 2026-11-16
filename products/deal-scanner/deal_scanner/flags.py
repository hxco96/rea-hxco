"""Deterministic risk flags. Rules first; the AI layer may add explanation but never removes a flag."""
import re
from . import config


def category_of(title: str) -> str:
    t = title.lower()
    rules = [("electronics", r"headphone|earbud|laptop|monitor|ssd|gpu|camera|speaker|tablet|router|keyboard|console|drone|watch"),
             ("clothing", r"shoe|sneaker|jacket|hoodie|jeans|boots|shirt|coat"),
             ("toys", r"lego|toy|puzzle|figure|doll|playset|board game"),
             ("tools", r"drill|saw|wrench|tool set|impact|sander|socket"),
             ("home", r"vacuum|blender|air fryer|cookware|kettle|mattress|lamp|knife|coffee"),
             ("supplements", r"vitamin|supplement|protein powder"),
             ("grocery", r"snack|coffee beans|cereal|grocery"),
             ("cosmetics", r"perfume|makeup|skincare|serum|lipstick")]
    for cat, pat in rules:
        if re.search(pat, t):
            return cat
    return "unknown"


def risk_flags(title: str, price, comp_price, category, merchant="", description=""):
    f = []
    t = (title + " " + description).lower()
    if comp_price and price is not None and price < comp_price * config.PRICING_ERROR_RATIO:
        f.append("PRICING_ERROR_LIKELY: price far below comps; retailer may cancel the order")
    if category in config.GATED_CATEGORIES:
        f.append(f"GATED_CATEGORY: {category} usually needs approval/has rules to resell")
    for b in config.COUNTERFEIT_PRONE:
        if b in t:
            f.append(f"COUNTERFEIT_PRONE_BRAND: {b}; buy only from authorized sellers, expect scrutiny")
            break
    if any(w in t for w in config.OVERSIZE_WORDS):
        f.append("OVERSIZE: shipping likely far above default estimate")
    if any(w in t for w in config.HAZMAT_WORDS):
        f.append("HAZMAT: shipping restrictions possible")
    if re.search(r"refurb|renewed|open box|used|for parts", t):
        f.append("CONDITION: not new; comps must match condition")
    if re.search(r"marketplace seller|third.party|sold by (?!amazon)", t):
        f.append("THIRD_PARTY_SELLER: not first-party stock; authenticity/cancel risk")
    if re.search(r"limit (?:\d+|one|1)|1 per customer|while supplies last", t):
        f.append("PURCHASE_LIMIT: quantity capped; low volume")
    return f

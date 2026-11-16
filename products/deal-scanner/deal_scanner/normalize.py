import re
_STOP = {"the", "a", "an", "with", "and", "for", "of", "in", "new", "free", "shipping", "at",
         "w/", "off", "deal", "sale", "after", "coupon", "code", "prime", "ac", "or", "to"}


def product_key(title: str) -> str:
    """Crude normalized key: lowercase tokens minus price/stop-words, sorted."""
    t = re.sub(r"\$\s?[0-9][0-9,\.]*", " ", title.lower())
    t = re.sub(r"[^a-z0-9\- ]", " ", t)
    toks = [w for w in t.split() if w not in _STOP and not re.fullmatch(r"\d+%?", w)]
    return " ".join(sorted(set(toks)))


def tokens(s: str):
    return set(product_key(s).split())


def similarity(a: str, b: str) -> float:
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def model_numbers(title: str):
    """Model-ish tokens: letters+digits (>=4 chars) or bare numbers >=3 digits, prices removed.
    Used as a strict gate: if both titles have them, the sets must be equal."""
    t = re.sub(r"\$\s?[0-9][0-9,\.]*", " ", title.lower())
    mixed = set(re.findall(r"\b(?=[a-z0-9\-]*\d)(?=[a-z0-9\-]*[a-z])[a-z0-9\-]{3,}\b", t))
    bare = set(re.findall(r"\b\d{3,}\b", t))
    return mixed | bare

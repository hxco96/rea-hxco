"""RSS/Atom deal-feed parser + polite fetcher (robots.txt aware)."""
from __future__ import annotations
import re
import html
import urllib.request
import urllib.robotparser
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
from typing import Optional
from ..models import Deal

UA = "deal-scanner/0.1 (personal, low-volume; contact: set DEAL_SCANNER_CONTACT)"
_PRICE = re.compile(r"\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)")
_TAG = re.compile(r"<[^>]+>")


def strip_html(s: str) -> str:
    return html.unescape(_TAG.sub(" ", s or "")).strip()


_NOISE = re.compile(r"(?:save|extra|up to|coupon|clip|\bsubtotal)\s*\$\s?[0-9][0-9,\.]*"
                    r"|\$\s?[0-9][0-9,\.]*\s*(?:off|\+|rebate|gift card|credit|back)\b", re.I)
_NOW = re.compile(r"(?:now|for|only|at|sale|price)\s*:?\s*\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)", re.I)


def parse_prices(text: str):
    """Return (price, list_price). Drops 'save $X' / '$X off' amounts, prefers 'now/for $X',
    else the first remaining $ amount; list price = largest later higher amount."""
    clean = _NOISE.sub(" ", text or "")
    vals = [float(m.replace(",", "")) for m in _PRICE.findall(clean)]
    if not vals:
        return None, None
    m = _NOW.search(clean)
    price = float(m.group(1).replace(",", "")) if m else vals[0]
    higher = [v for v in vals if v > price]
    return price, (max(higher) if higher else None)


def _txt(el, *names):
    for n in names:
        found = el.find(n)
        if found is not None and (found.text or "").strip():
            return found.text.strip()
    return ""


def parse_feed(xml_text: str, source: str):
    root = ET.fromstring(xml_text)
    out = []
    ns_atom = "{http://www.w3.org/2005/Atom}"
    items = root.findall(".//item") or root.findall(f".//{ns_atom}entry")
    for it in items:
        title = strip_html(_txt(it, "title", f"{ns_atom}title"))
        link = _txt(it, "link")
        if not link:
            le = it.find(f"{ns_atom}link")
            link = le.get("href", "") if le is not None else ""
        desc = strip_html(_txt(it, "description", f"{ns_atom}content", f"{ns_atom}summary"))
        posted = _txt(it, "pubDate", f"{ns_atom}updated")
        price, lp = parse_prices(title)
        if price is None:
            price, lp = parse_prices(desc)
        elif lp is None:
            _, lp = parse_prices(title + " " + desc)
        expired = bool(re.search(r"\b(expired|sold out|out of stock)\b", title + " " + desc, re.I))
        out.append(Deal(source=source, title=title, url=link, price=price, list_price=lp,
                        description=desc[:500], posted_at=posted, is_expired=expired))
    return out


def robots_allows(url: str, ua: str = UA, fetch=None) -> bool:
    p = urlparse(url)
    rp = urllib.robotparser.RobotFileParser()
    robots_url = f"{p.scheme}://{p.netloc}/robots.txt"
    try:
        if fetch:
            rp.parse(fetch(robots_url).splitlines())
        else:
            req = urllib.request.Request(robots_url, headers={"User-Agent": ua})
            with urllib.request.urlopen(req, timeout=15) as r:
                rp.parse(r.read().decode("utf-8", "replace").splitlines())
    except Exception:
        return False  # can't confirm permission -> don't fetch
    return rp.can_fetch(ua, url)


def fetch_feed(url: str, source: str, ua: str = UA) -> list:
    """Fetch one feed once. Refuses if robots.txt disallows or can't be read.
    No retries, no proxy rotation, no block evasion by design."""
    if not robots_allows(url, ua):
        raise PermissionError(f"robots.txt does not allow (or could not confirm) fetching {url}")
    req = urllib.request.Request(url, headers={"User-Agent": ua})
    with urllib.request.urlopen(req, timeout=20) as r:
        return parse_feed(r.read().decode("utf-8", "replace"), source)

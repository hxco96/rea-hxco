import html
import json
from .config import MAX_CAPITAL_PER_DEAL

STEPS = [
    "Open the listing link yourself (do not trust the feed's price; check it on the retailer page).",
    "Confirm exact model/variant/condition matches the comp.",
    "Check stock, purchase limit and shipping-to-you cost; compare final total to the estimate.",
    "Search the marketplace's SOLD listings for this item once more; confirm the comp.",
    "Only if the numbers still work, YOU place the order with YOUR payment method.",
    "On arrival: inspect, photograph, list it, ship with tracking.",
]


def attach_steps(a):
    a.buy_steps = list(STEPS)
    return a


def to_html(assessments, title="Deal shortlist"):
    rows = []
    for a in assessments:
        d = a.deal
        flags = "".join(f"<li>{html.escape(f)}</li>" for f in a.flags)
        profit = "n/a" if a.resale_estimate is None else f"${a.expected_profit:.2f}"
        rows.append(f"""<tr><td><a href="{html.escape(d.url if d.url.startswith(("http://", "https://")) else "#")}" rel="noopener">{html.escape(d.title)}</a>
<br><small>{html.escape(d.source)}</small></td><td>${d.price if d.price is not None else '?'}</td>
<td>{profit}</td><td>{a.confidence:.2f}</td><td><ul>{flags}</ul></td>
<td>{html.escape(a.explanation)}</td></tr>""")
    steps = "".join(f"<li>{html.escape(s)}</li>" for s in STEPS)
    return f"""<!doctype html><meta charset="utf-8"><title>{html.escape(title)}</title>
<style>body{{font:14px system-ui;margin:20px}}td,th{{border:1px solid #ccc;padding:6px;vertical-align:top}}
table{{border-collapse:collapse}}</style>
<h1>{html.escape(title)}</h1>
<p><b>Estimates are judgement, not data.</b> Nothing is bought automatically. Capital cap per deal: ${MAX_CAPITAL_PER_DEAL:.0f}.</p>
<table><tr><th>Deal</th><th>Price</th><th>Est. profit</th><th>Conf.</th><th>Flags</th><th>Why</th></tr>
{''.join(rows)}</table><h2>Buying steps (you press buy)</h2><ol>{steps}</ol>"""


def to_json(assessments):
    return json.dumps([a.to_dict() for a in assessments], indent=2, default=str)

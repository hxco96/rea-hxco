"""AI layer. The model NEVER produces prices or overrides flags: it classifies and explains.
HeuristicClassifier works offline; ClaudeClassifier is optional and falls back on any error."""
import json
import os
import urllib.request
from .flags import category_of
from .models import Assessment


class HeuristicClassifier:
    name = "heuristic"

    def classify(self, title: str) -> str:
        return category_of(title)

    def explain(self, a: Assessment) -> str:
        d = a.deal
        if a.resale_estimate is None:
            return f"Cannot judge: {', '.join(f.split(':')[0] for f in a.flags) or 'no data'}."
        parts = [f"Buy at ${d.price:.2f}; resale reference ${a.resale_estimate:.2f} "
                 f"({a.comp.kind} comp, n={a.comp.n}). After fees ${a.fees:.2f}, shipping "
                 f"${a.shipping:.2f} and risk reserve ${a.risk_margin:.2f}, estimated profit "
                 f"${a.expected_profit:.2f} ({a.roi:.0%} ROI), confidence {a.confidence:.2f} (judgement)."]
        if a.comp.kind == "asking":
            parts.append("Comp is an ASKING price, not a sale; real profit is likely lower.")
        if a.flags:
            parts.append("Risks: " + "; ".join(f.split(":")[0] for f in a.flags) + ".")
        return " ".join(parts)


class ClaudeClassifier(HeuristicClassifier):
    """Uses the Anthropic Messages API via urllib (no SDK). Requires ANTHROPIC_API_KEY.
    Only the category and wording of the explanation come from the model."""
    name = "claude"
    URL = "https://api.anthropic.com/v1/messages"

    def __init__(self, model=None, key=None, opener=None):
        self.model = model or os.environ.get("DEAL_SCANNER_MODEL", "claude-haiku-5-5")
        self.key = key or os.environ.get("ANTHROPIC_API_KEY", "")
        self.opener = opener or urllib.request.urlopen
        self._cache = {}

    def _call(self, prompt: str) -> str:
        body = json.dumps({"model": self.model, "max_tokens": 200,
                           "messages": [{"role": "user", "content": prompt}]}).encode()
        req = urllib.request.Request(self.URL, data=body, headers={
            "x-api-key": self.key, "anthropic-version": "2023-06-01",
            "content-type": "application/json"})
        with self.opener(req, timeout=30) as r:
            return json.loads(r.read())["content"][0]["text"]

    def classify(self, title):
        if not self.key:
            return super().classify(title)
        if title in self._cache:
            return self._cache[title]
        try:
            out = self._call("Classify this product title into exactly one of: electronics, clothing, "
                             "toys, tools, home, supplements, grocery, cosmetics, unknown. "
                             f"Reply with the single word only.\nTitle: {title}").strip().lower()
            cat = out if out in {"electronics", "clothing", "toys", "tools", "home", "supplements",
                                 "grocery", "cosmetics", "unknown"} else super().classify(title)
        except Exception:
            cat = super().classify(title)
        self._cache[title] = cat
        return cat

    def explain(self, a):
        base = super().explain(a)
        if not self.key or a.resale_estimate is None:
            return base
        try:
            out = self._call("Rewrite in 2 plain sentences for a reseller. Do not change any number "
                             f"or drop any risk.\n{base}").strip()
            ok = out and f"{a.expected_profit:.2f}" in out and all(
                f.split(":")[0].lower().replace("_", " ") in out.lower().replace("_", " ")
                or f.split(":")[0] in out for f in a.flags)
            return out if ok else base
        except Exception:
            return base


def get_classifier(mode: str):
    return ClaudeClassifier() if mode == "claude" else HeuristicClassifier()

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Deal:
    """A raw deal pulled from a source. Prices are in USD."""
    source: str
    title: str
    url: str                      # listing / forum thread link (human opens this)
    price: Optional[float]        # current price, if parseable
    list_price: Optional[float] = None   # claimed original price, if present
    merchant: str = ""
    posted_at: str = ""
    description: str = ""
    is_expired: bool = False
    votes: int = 0


@dataclass
class Comp:
    """A resale price reference. `kind` says how trustworthy it is."""
    key: str                      # normalized product key
    price: float
    kind: str                     # "sold" (best) | "asking" (optimistic) | "manual"
    n: int = 1
    source: str = ""


@dataclass
class Assessment:
    deal: Deal
    category: str = "unknown"
    product_key: str = ""
    comp: Optional[Comp] = None
    resale_estimate: Optional[float] = None
    fees: float = 0.0
    shipping: float = 0.0
    risk_margin: float = 0.0
    expected_profit: float = 0.0
    roi: float = 0.0
    confidence: float = 0.0       # 0..1, judgement, not a probability
    flags: list = field(default_factory=list)
    explanation: str = ""
    buy_steps: list = field(default_factory=list)

    def to_dict(self):
        d = asdict(self)
        return d

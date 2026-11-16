from . import config
from .models import Deal, Assessment
from .flags import category_of, risk_flags
from .normalize import product_key
from .comps import best_comp, effective_resale


def estimate(deal: Deal, comps, shipping=None, category=None) -> Assessment:
    cat = category or category_of(deal.title)
    a = Assessment(deal=deal, category=cat, product_key=product_key(deal.title))
    comp, sim = best_comp(deal.title, comps) if comps else (None, 0.0)
    a.comp = comp
    a.flags = risk_flags(deal.title, deal.price, comp.price if comp else None, cat,
                         deal.merchant, deal.description)
    if deal.is_expired:
        a.flags.append("EXPIRED: deal marked expired/sold out")
    if deal.price is None:
        a.flags.append("NO_PRICE: could not parse price")
        return a
    if comp is None:
        a.flags.append("NO_COMP: no resale reference found; profit unknown (add a sold comp to comps.csv)")
        return a
    resale = effective_resale(comp)
    a.resale_estimate = round(resale, 2)
    rate = config.FEE_RATE.get(cat, config.FEE_RATE["unknown"])
    a.fees = round(resale * rate + config.FIXED_FEE, 2)
    a.shipping = shipping if shipping is not None else config.SHIPPING_DEFAULT.get(cat, 10.0)
    a.risk_margin = round(resale * (config.RISK_MARGIN + config.RETURNS_RESERVE), 2)
    cost = deal.price * (1 + config.INBOUND_TAX_RATE)
    a.expected_profit = round(resale - a.fees - a.shipping - a.risk_margin - cost, 2)
    a.roi = round(a.expected_profit / cost, 3) if cost else 0.0
    # confidence: judgement. Sold comps > asking; more samples and closer match raise it;
    # flags and 'too good to be true' lower it.
    c = {"sold": 0.7, "manual": 0.6, "asking": 0.35}.get(comp.kind, 0.3)
    c += min(comp.n, 10) * 0.02
    c *= (0.5 + 0.5 * sim)
    c -= 0.12 * sum(1 for f in a.flags if f.split(":")[0] in
                    {"PRICING_ERROR_LIKELY", "COUNTERFEIT_PRONE_BRAND", "THIRD_PARTY_SELLER",
                     "CONDITION", "GATED_CATEGORY"})
    a.confidence = round(max(0.0, min(1.0, c)), 2)
    if deal.price > config.MAX_CAPITAL_PER_DEAL:
        a.flags.append(f"OVER_CAPITAL_CAP: costs more than ${config.MAX_CAPITAL_PER_DEAL:.0f} cap")
    return a


def is_actionable(a: Assessment) -> bool:
    blockers = ("EXPIRED", "GATED_CATEGORY", "NO_COMP", "NO_PRICE", "OVER_CAPITAL_CAP")
    if any(f.startswith(blockers) for f in a.flags):
        return False
    return a.expected_profit >= config.MIN_PROFIT and a.roi >= config.MIN_ROI


def rank(assessments):
    return sorted(assessments, key=lambda a: (is_actionable(a), a.expected_profit * a.confidence), reverse=True)

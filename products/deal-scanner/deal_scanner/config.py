"""Tunable assumptions. ALL numbers here are judgement, not data - check them against
your own sales. Fee rates in particular change; verify on the marketplace's fee page."""

# marketplace final-value fee fraction by category (approximate, unverified)
FEE_RATE = {"electronics": 0.1325, "clothing": 0.15, "toys": 0.1325, "home": 0.1325,
            "tools": 0.1325, "unknown": 0.15}
FIXED_FEE = 0.40
RETURNS_RESERVE = 0.05        # fraction of resale price set aside for returns/disputes
RISK_MARGIN = 0.10            # extra haircut on resale price for comp error
SHIPPING_DEFAULT = {"electronics": 8.0, "clothing": 6.0, "toys": 9.0, "home": 12.0,
                    "tools": 14.0, "unknown": 10.0}
INBOUND_TAX_RATE = 0.07       # sales tax you may pay when buying; set to your area
MIN_PROFIT = 8.0              # $ after everything
MIN_ROI = 0.25
MAX_CAPITAL_PER_DEAL = 60.0   # of a $100 bankroll
ASKING_COMP_DISCOUNT = 0.80   # asking-price comps are shaved by this

# brands that are counterfeit-prone or ungated-hard: flag, human decides
COUNTERFEIT_PRONE = {"nike", "jordan", "apple", "airpods", "rolex", "gucci", "louis vuitton",
                     "beats", "ray-ban", "oakley", "yeti", "lego"}
GATED_CATEGORIES = {"supplements", "grocery", "cosmetics", "baby", "weapons", "alcohol",
                    "medical", "pet food"}
OVERSIZE_WORDS = {"treadmill", "mattress", "sofa", "couch", "tv ", "television", "refrigerator",
                  "desk", "grill", "bike", "kayak"}
HAZMAT_WORDS = {"battery", "lithium", "aerosol", "fuel", "propane", "perfume"}
PRICING_ERROR_RATIO = 0.40    # deal price < 40% of comp -> "probably an error, may be cancelled"

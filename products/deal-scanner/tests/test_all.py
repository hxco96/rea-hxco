import os, sys, tempfile, json, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from deal_scanner.sources.rss import parse_feed, parse_prices, robots_allows
from deal_scanner.comps import load_comps_csv, best_comp
from deal_scanner.profit import estimate, is_actionable, rank
from deal_scanner.flags import category_of, risk_flags
from deal_scanner.models import Deal, Comp
from deal_scanner.ai import ClaudeClassifier, HeuristicClassifier
from deal_scanner.cli import run, main, HERE
from deal_scanner.report import to_html

FX = os.path.join(HERE, "fixtures")
DEALS = parse_feed(open(os.path.join(FX, "sample_feed.xml")).read(), "t")
COMPS = load_comps_csv(os.path.join(FX, "comps.csv"))


class T(unittest.TestCase):
    def test_prices(self):
        self.assertEqual(parse_prices("X $120 (reg $348)"), (120.0, 348.0))
        self.assertEqual(parse_prices("none"), (None, None))
        self.assertEqual(parse_prices("$1,299.99"), (1299.99, None))

    def test_parse_feed(self):
        self.assertEqual(len(DEALS), 7)
        self.assertTrue(DEALS[4].is_expired)

    def test_atom(self):
        x = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Foo $5</title><link href="http://a/b"/></entry></feed>'
        d = parse_feed(x, "a")
        self.assertEqual((d[0].price, d[0].url), (5.0, "http://a/b"))

    def test_robots(self):
        self.assertTrue(robots_allows("https://x.com/feed", fetch=lambda u: "User-agent: *\nAllow: /"))
        self.assertFalse(robots_allows("https://x.com/feed", fetch=lambda u: "User-agent: *\nDisallow: /"))
        def boom(u): raise OSError()
        self.assertFalse(robots_allows("https://x.com/feed", fetch=boom))  # fail closed

    def test_comp_match_requires_model(self):
        c, _ = best_comp("Acme Cordless Drill DCD-999 Kit", COMPS)
        self.assertIsNone(c)
        c, _ = best_comp("Acme Cordless Drill DCD-777 Kit $45", COMPS)
        self.assertEqual(c.price, 82)

    def test_profit_math(self):
        d = Deal("t", "Acme Cordless Drill DCD-777 Kit", "u", 20.0)
        a = estimate(d, COMPS)
        # 82 - (82*.1325+.4) - 14 - 82*.15 - 20*1.07
        self.assertAlmostEqual(a.expected_profit, round(82 - (82*0.1325+0.4) - 14 - 82*0.15 - 21.4, 2), delta=0.02)
        self.assertTrue(is_actionable(a))

    def test_no_comp_is_unknown_not_guess(self):
        a = estimate(DEALS[5], COMPS)
        self.assertIsNone(a.resale_estimate)
        self.assertFalse(is_actionable(a))

    def test_flags(self):
        a = estimate(DEALS[6], COMPS)
        self.assertTrue(any(f.startswith("PRICING_ERROR_LIKELY") for f in a.flags))
        self.assertTrue(any(f.startswith("COUNTERFEIT") for f in estimate(DEALS[2], COMPS).flags))
        self.assertTrue(any(f.startswith("GATED") for f in estimate(DEALS[3], COMPS).flags))
        self.assertEqual(category_of("Vitamin C"), "supplements")

    def test_asking_comp_shaved(self):
        a = estimate(Deal("t", "Nike Air Max 90", "u", 29.0), COMPS)
        self.assertEqual(a.resale_estimate, 76.0)
        self.assertLess(a.confidence, 0.4)

    def test_expired_never_actionable_and_ranked_last(self):
        r = run(DEALS, COMPS, include_all=True)
        titles = [x.deal.title for x in r]
        self.assertFalse(is_actionable(next(x for x in r if "expired" in x.deal.title)))
        self.assertEqual(r, rank(r))

    def test_claude_fallback_never_changes_numbers(self):
        def bad(*a, **k): raise OSError("net")
        c = ClaudeClassifier(key="k", opener=bad)
        self.assertEqual(c.classify("Acme drill"), "tools")
        a = estimate(Deal("t", "Acme Cordless Drill DCD-777 Kit", "u", 20.0), COMPS)
        self.assertEqual(c.explain(a), HeuristicClassifier().explain(a))
        self.assertIn(f"{a.expected_profit:.2f}", c.explain(a))

    def test_claude_no_key_offline(self):
        c = ClaudeClassifier(key="", opener=lambda *a, **k: 1 / 0)
        self.assertEqual(c.classify("Acme drill"), "tools")

    def test_cli_and_html_escape(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "o.html")
            self.assertEqual(main(["--offline", "--all", "--html", out, "--json", os.path.join(d, "o.json")]), 0)
            self.assertIn("Buying steps", open(out).read())
            json.load(open(os.path.join(d, "o.json")))
        h = to_html([estimate(Deal("t", "<script>x</script> $5", "u", 5.0), COMPS)])
        self.assertNotIn("<script>x", h)

    def test_wrong_model_no_match(self):
        comps = [("Nvidia RTX 4090 GPU", Comp("k", 1600, "sold", 5)), ("Samsung 990 Pro 2TB SSD", Comp("k", 150, "sold", 5))]
        comps = [(t, c) for t, c in comps]
        self.assertIsNone(best_comp("RTX 4060 GPU $299", comps)[0])
        self.assertIsNone(best_comp("Samsung 870 EVO 2TB SSD", comps)[0])
        self.assertIsNotNone(best_comp("Nvidia RTX 4090 GPU $900", comps)[0])

    def test_price_wording(self):
        self.assertEqual(parse_prices("Save $50 on Drill, now $99")[0], 99.0)
        self.assertEqual(parse_prices("$20 off $100+ Drill")[0], 100.0)

    def test_js_link_blocked(self):
        h = to_html([estimate(Deal("t", "x $5", "javascript:alert(1)", 5.0), COMPS)])
        self.assertNotIn("javascript:", h)

    def test_claude_explanation_dropping_risk_rejected(self):
        d = Deal("t", "Nike Air Max 90 $29", "u", 29.0)
        c = ClaudeClassifier(key="k")
        a = estimate(d, COMPS)
        c._call = lambda p: "Great deal, buy now!"
        self.assertEqual(c.explain(a), HeuristicClassifier().explain(a))

    def test_empty_exit(self):
        self.assertEqual(main([]), 1)

if __name__ == "__main__":
    unittest.main()

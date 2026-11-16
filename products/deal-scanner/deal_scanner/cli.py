import argparse
import os
import sys
from .sources.rss import parse_feed, fetch_feed
from .comps import load_comps_csv
from .profit import estimate, rank, is_actionable
from .ai import get_classifier
from .report import to_html, to_json, attach_steps

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run(deals, comps, mode="heuristic", include_all=False):
    clf = get_classifier(mode)
    out = []
    for d in deals:
        a = estimate(d, comps, category=clf.classify(d.title))
        a.explanation = clf.explain(a)
        attach_steps(a)
        out.append(a)
    ranked = rank([a for a in out if include_all or is_actionable(a)])
    return ranked


def main(argv=None):
    p = argparse.ArgumentParser(prog="deal-scanner")
    p.add_argument("--offline", action="store_true", help="use fixtures/sample_feed.xml (FAKE data)")
    p.add_argument("--feed", action="append", default=[], help="RSS/Atom URL (robots.txt checked)")
    p.add_argument("--comps", default=os.path.join(HERE, "fixtures", "comps.csv"))
    p.add_argument("--ai", choices=["heuristic", "claude"], default="heuristic")
    p.add_argument("--all", action="store_true", help="include non-actionable rows")
    p.add_argument("--html", default="shortlist.html")
    p.add_argument("--json", default="")
    a = p.parse_args(argv)
    deals = []
    if a.offline:
        with open(os.path.join(HERE, "fixtures", "sample_feed.xml"), encoding="utf-8") as f:
            deals += parse_feed(f.read(), "fixture(FAKE)")
    for u in a.feed:
        try:
            deals += fetch_feed(u, u)
        except Exception as e:
            print(f"skip {u}: {e}", file=sys.stderr)
    if not deals:
        print("no deals (use --offline or --feed URL)", file=sys.stderr)
        return 1
    ranked = run(deals, load_comps_csv(a.comps), a.ai, a.all)
    with open(a.html, "w", encoding="utf-8") as f:
        f.write(to_html(ranked))
    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            f.write(to_json(ranked))
    for r in ranked:
        print(f"${r.expected_profit:>7.2f}  conf {r.confidence:.2f}  {r.deal.title[:70]}")
    print(f"{len(ranked)} shortlisted of {len(deals)} -> {a.html}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

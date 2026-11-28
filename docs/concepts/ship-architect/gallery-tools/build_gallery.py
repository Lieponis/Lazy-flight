"""Build one gallery page holding every approved ship.

Run:  python3 docs/concepts/ship-architect/gallery-tools/build_gallery.py
Writes docs/concepts/ship-architect/gallery.html. To add a newly approved
ship, add a line to SHIPS below and run it again.

Each approved viewer's ship-building code (everything between the
addGroupPart helper and the part-list UI) is wrapped in its own function,
so ships never clash with each other's names. The gallery calls one of
those functions whenever a ship button is tapped.
"""
import re, sys, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # docs/concepts/ship-architect
SHIPS = [
    ("passenger-1", "Eggspress", "Passenger", "small"),
    ("passenger-2", "Droopliner", "Passenger", "medium"),
    ("passenger-3", "Snoozemarine", "Passenger", "large"),
    ("cargo-1", "Crate Expectations", "Cargo", "small"),
    ("cargo-2", "Haul Monty", "Cargo", "medium"),
    ("cargo-3", "Stacks McGee", "Cargo", "large"),
    ("explorer-1", "Pocket Rocket", "Explorer", "small"),
    ("explorer-2", "Wanderwedge", "Explorer", "medium"),
]

def extract(slug):
    html = open(f"{ROOT}/{slug}/viewer.html").read()
    lines = html.split("\n")
    start = next(i for i, l in enumerate(lines) if l.startswith("function addGroupPart"))
    end_fn = next(i for i in range(start, len(lines)) if lines[i] == "}")
    ui = next(i for i, l in enumerate(lines) if l.startswith("// part list UI"))
    # step back over the "// ====" separator line above the UI heading
    stop = ui - 1 if lines[ui - 1].startswith("// ====") else ui
    code = "\n".join(lines[end_fn + 1:stop])
    m = re.search(r"CAMERA_HOME = new THREE\.Vector3\(([^)]*)\)", html) or re.search(r"camera\.position\.set\(([^)]*)\)", html)
    home = [float(v) for v in m.group(1).split(",")]
    t = re.search(r"controls\.target\.set\(([^)]*)\)", html)
    target = [float(v) for v in t.group(1).split(",")]
    mn = float(re.search(r"controls\.minDistance = ([\d.]+)", html).group(1))
    mx = float(re.search(r"controls\.maxDistance = ([\d.]+)", html).group(1))
    for bad in ("scene.", "camera.", "controls.", "renderer.", "document.", "window."):
        if bad in code:
            sys.exit(f"{slug}: ship code touches {bad} — cannot wrap safely")
    return code, home, target, mn, mx

entries = []
for slug, name, cat, size in SHIPS:
    code, home, target, mn, mx = extract(slug)
    entries.append(
        f"""  {{
    slug: {json.dumps(slug)}, name: {json.dumps(name)}, cat: {json.dumps(cat)}, size: {json.dumps(size)},
    home: {json.dumps(home)}, target: {json.dumps(target)}, minD: {mn}, maxD: {mx},
    build(THREE, ship, partMaterial, addPart, addGroupPart) {{
{code}
    }},
  }}""")

page = open(os.path.join(HERE, "gallery-template.html")).read().replace("/*__SHIPS__*/", ",\n".join(entries))
open(os.path.join(ROOT, "gallery.html"), "w").write(page)
print("gallery built with", len(entries), "ships")

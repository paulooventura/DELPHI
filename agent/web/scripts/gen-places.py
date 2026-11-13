"""Build public/geo/places.json, the offline place list for place search and "where am I" (T336).

Source: GeoNames (https://www.geonames.org/), CC BY 4.0, free for commercial use with credit.
Download these three into one folder, then run:
    python -I scripts/gen-places.py <folder>
      cities5000.zip, admin1CodesASCII.txt, countryInfo.txt   (https://download.geonames.org/export/dump/)

Output: {"v":1,"src":..., "admin":[...], "country":[...], "rows":[[name, ascii, adminIdx, countryIdx, lat, lon, pop], ...]}
Rows are sorted by population (largest first) so the first match is usually the one people mean.
"""
import io
import json
import sys
import zipfile
from pathlib import Path

src = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / "public" / "geo" / "places.json"

countries = {}
for line in (src / "countryInfo.txt").read_text(encoding="utf-8").splitlines():
    if not line or line.startswith("#"):
        continue
    f = line.split("\t")
    countries[f[0]] = f[4]

admins = {}
for line in (src / "admin1CodesASCII.txt").read_text(encoding="utf-8").splitlines():
    f = line.split("\t")
    if len(f) >= 2:
        admins[f[0]] = f[1]

admin_list, admin_idx = [], {}
country_list, country_idx = [], {}

def idx(value, lst, table):
    if value not in table:
        table[value] = len(lst)
        lst.append(value)
    return table[value]

rows = []
with zipfile.ZipFile(src / "cities5000.zip") as z:
    text = io.TextIOWrapper(z.open("cities5000.txt"), encoding="utf-8")
    for line in text:
        f = line.rstrip("\n").split("\t")
        if len(f) < 15:
            continue
        name, ascii_name, lat, lon, cc, a1, pop = f[1], f[2], float(f[4]), float(f[5]), f[8], f[10], int(f[14] or 0)
        admin = admins.get(f"{cc}.{a1}", "")
        country = countries.get(cc, cc)
        rows.append([name, ascii_name if ascii_name != name else "", idx(admin, admin_list, admin_idx),
                     idx(country, country_list, country_idx), round(lat, 3), round(lon, 3), pop])

rows.sort(key=lambda r: -r[6])
out.parent.mkdir(parents=True, exist_ok=True)
data = {"v": 1, "src": "GeoNames cities5000, CC BY 4.0", "admin": admin_list, "country": country_list, "rows": rows}
out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(out, len(rows), "places", out.stat().st_size // 1024, "KB")

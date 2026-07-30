"""
Parser for the FY26 tracker's compact utility strings -> normalized values +
datapoints, matching the platform's UtilityRequirement schema.

Model: split the cell into segments, turn each into a datapoint (value in the
target unit + whether it was DERIVED via a unit/period conversion). The headline
normalizedValue is the MAX datapoint (peak load / capacity to plan for), and the
requirement is flagged iff that headline datapoint was derived or ambiguous.
Direct values already in the target unit are trusted (unflagged).

Targets:  ELECTRICITY -> MW  |  WATER/WASTEWATER -> thousand gal/day  |  GAS -> thousand ft3/day
"""
import re

NUM = r"\d[\d,]*(?:\.\d+)?"

def _num(s):
    if s is None: return None
    try: return float(str(s).replace(",", "").strip())
    except ValueError: return None

def _date(seg):
    m = re.search(r"\((\d{1,2})/(\d{4})\)", seg) or re.search(r"\bon\s+(\d{1,2})/(\d{4})", seg, re.I)
    if m: return f"{m.group(2)}-{int(m.group(1)):02d}-01"
    m = re.search(r"Q(\d)\s*/?\s*(\d{4})", seg, re.I)
    if m: return f"{m.group(2)}-{(int(m.group(1))-1)*3+1:02d}-01"
    m = re.search(r"\((\d{4})\)", seg) or re.search(r"\bby\s+(\d{4})", seg, re.I)
    if m: return f"{m.group(1)}-01-01"
    return None

def _kind(seg):
    s = seg.lower()
    for key, val in (("day-one","day-one"),("day one","day-one"),("annual","annual-peak"),
                     ("monthly","monthly"),("ramp","ramp"),("phase 1","phase-1"),
                     ("phase 2","phase-2"),("average","average"),("avg","average"),
                     ("peak","peak"),("max","peak")):
        if key in s: return val
    return None

def _segs(raw):
    return [s.strip() for s in re.split(r"[|\n]+", raw) if s.strip()]

SKIP = {"tbd", "none", "n/a", "na", "-", "–", "—", "0"}

def _finish(dps, unit, extra_flag=False, extra_note=None):
    """Pick the max datapoint as the headline; flag iff it was derived."""
    if not dps:
        return dict(normalizedValue=None, normalizedUnit=None, flagged=True,
                    assumptionNote="No numeric value recognized; left for manual entry.", datapoints=[])
    top = max(dps, key=lambda d: d["value"])
    flagged = bool(top["_derived"] or extra_flag)
    reasons = sorted({r for d in dps for r in d["_reasons"]})
    note = None
    if flagged:
        note = ("Derived — " + "; ".join(reasons) + f". Normalized = max datapoint in {unit}.") if reasons else extra_note
        if extra_note and extra_note not in (note or ""): note = (note + " " + extra_note) if note else extra_note
    for d in dps:  # strip internals before returning
        d.pop("_derived", None); d.pop("_reasons", None)
    return dict(normalizedValue=round(top["value"], 4), normalizedUnit=unit,
                flagged=flagged, assumptionNote=note, datapoints=dps)

def _skip_result(raw):
    t = raw.strip().lower()
    if t in ("none",):  return dict(normalizedValue=None, normalizedUnit=None, flagged=False,
                                    assumptionNote="Source states 'None' — not required.", datapoints=[])
    if t in ("tbd",):   return dict(normalizedValue=None, normalizedUnit=None, flagged=False,
                                    assumptionNote="Source states 'TBD' — pending.", datapoints=[])
    return dict(normalizedValue=None, normalizedUnit=None, flagged=False,
                assumptionNote="No value in source.", datapoints=[])

def _dp(seg, value, unit, derived, reasons):
    return dict(kind=_kind(seg) or "value", label=seg[:80], value=round(value, 4), unit=unit,
                date=_date(seg), rawValue=seg, flagged=bool(derived),
                assumptionNote=None, _derived=bool(derived), _reasons=list(reasons))

# --- ELECTRICITY -> MW -----------------------------------------------------
_E = re.compile(rf"({NUM})\s*(?:-\s*({NUM})\s*)?(GW|MW|kW)\b", re.I)

def parse_electric(raw):
    dps, load_only = [], 0
    for seg in _segs(raw):
        if seg.lower() in SKIP: continue
        for m in _E.finditer(seg):
            lo, hi = _num(m.group(1)), _num(m.group(2))
            unit = m.group(3).lower(); val = hi if hi is not None else lo
            reasons, derived = set(), False
            if hi is not None: reasons.add("range (used upper)"); derived = True
            if unit == "kw": val /= 1000.0; reasons.add("kW→MW"); derived = True
            elif unit == "gw": val *= 1000.0; reasons.add("GW→MW"); derived = True
            if _kind(seg) is None: load_only += 1
            dps.append(_dp(seg, val, "MW", derived, reasons))
    return _finish(dps, "MW", extra_flag=(load_only > 1),
                   extra_note=("Multiple sites in source; normalized = largest, not sum." if load_only > 1 else None))

# --- WATER / WASTEWATER -> thousand gal/day --------------------------------
_W = re.compile(rf"({NUM})\s*(?:-\s*({NUM})\s*)?(k)?\s*(MGD|gallons?|gal|ga|m3|m³)", re.I)
# Fallback: a bare "N per <period>" with no unit stated. In the water/wastewater
# columns the omitted unit is always gallons — assume it, but flag the assumption.
_Wbare = re.compile(rf"({NUM})\s*(?:-\s*({NUM})\s*)?per\s+(day|month|mo|year|yr|hour|hr)", re.I)
_PER = re.compile(r"(?:per\s+|/\s*)(day|month|mo|moth|year|yr|min|minute|hour|hr)", re.I)

def parse_water(raw):
    dps = []
    for seg in _segs(raw):
        if seg.lower() in SKIP: continue
        m = _W.search(seg)
        assumed_gal = False
        if not m:
            m = _Wbare.search(seg)
            if not m: continue
            assumed_gal = True
        lo, hi = _num(m.group(1)), _num(m.group(2))
        base = hi if hi is not None else lo
        if base is None: continue
        reasons, derived = set(), False
        if hi is not None: reasons.add("range (used upper)"); derived = True
        if assumed_gal:
            unit = "gal"; reasons.add("no unit (assumed gallons)"); derived = True
        else:
            if m.group(3): base *= 1000.0; reasons.add("k→thousands"); derived = True  # "95k"
            unit = m.group(4).lower()
        if unit in ("m3", "m³"): base *= 264.172; reasons.add("m³→gal"); derived = True
        if unit == "mgd":
            gal_day = base * 1e6
        else:
            pm = _PER.search(seg); per = pm.group(1).lower() if pm else None
            if per is None: gal_day = base; reasons.add("no period (assumed/day)"); derived = True
            elif per.startswith("day"): gal_day = base
            elif per.startswith(("month", "mo")): gal_day = base / 30.44; reasons.add("month→day"); derived = True
            elif per.startswith(("year", "yr")): gal_day = base / 365.25; reasons.add("year→day"); derived = True
            elif per.startswith("min"): gal_day = base * 1440; reasons.add("min→day"); derived = True
            elif per.startswith(("hour", "hr")): gal_day = base * 24; reasons.add("hour→day"); derived = True
            else: gal_day = base
        dps.append(_dp(seg, gal_day / 1000.0, "thousand gal/day", derived, reasons))
    return _finish(dps, "thousand gal/day")

# --- GAS -> thousand ft3/day -----------------------------------------------
_GAS_FT3 = [(r"mmcf",1_000_000),(r"mmscf",1_000_000),(r"mcf",1_000),(r"ccf",100),
            (r"mmbtu",970.0),(r"dth",970.0),(r"therms?",96.7),(r"nm³|nm3",35.3147),
            (r"scfh",1),(r"scf",1),(r"cubic\s*f(?:ee)?t|ft3|ft³|\bcf\b",1),(r"m³|m3",35.3147)]
_ENERGY = ("mmbtu", "dth", "therm")

def parse_gas(raw):
    dps = []
    for seg in _segs(raw):
        low = seg.lower()
        if low in SKIP: continue
        hit = None
        for pat, factor in _GAS_FT3:
            m = re.search(rf"({NUM})\s*(?:-\s*({NUM})\s*)?(?:{pat})", seg, re.I)
            if m: hit = (m, factor, re.search(pat, low).group(0)); break
        if not hit: continue
        m, factor, utok = hit
        lo, hi = _num(m.group(1)), _num(m.group(2))
        base = hi if hi is not None else lo
        if base is None: continue
        reasons, derived = set(), True  # gas headline almost always converted -> flag
        if hi is not None: reasons.add("range (used upper)")
        ft3 = base * factor
        if factor != 1: reasons.add(f"{utok}→ft³")
        if any(e in utok for e in _ENERGY): reasons.add(f"energy unit {utok}→ft³ (approx NG heat rate)")
        if "scfh" in low or re.search(r"/\s*h(?:r|our)?\b|per hour", low):
            ft3_day = ft3 * 24; reasons.add("hour→day")
        elif re.search(r"annually|per year|/\s*yr|/\s*year", low):
            ft3_day = ft3 / 365.25; reasons.add("year→day")
        elif re.search(r"/\s*mo(?:nth)?|per month", low):
            ft3_day = ft3 / 30.44; reasons.add("month→day")
        elif re.search(r"/\s*day|per day", low):
            ft3_day = ft3; reasons.discard("month→day")
            if factor == 1 and not hi: derived = False  # literal ft3/day = trustworthy
        else:
            ft3_day = ft3 / 30.44; reasons.add("no period (assumed/month)")
        dps.append(_dp(seg, ft3_day / 1000.0, "thousand ft3/day", derived, reasons))
    return _finish(dps, "thousand ft3/day")

def parse_utility(utype, raw):
    if not raw or str(raw).strip().lower() in SKIP:
        return _skip_result(str(raw or ""))
    if utype == "ELECTRICITY": return parse_electric(raw)
    if utype in ("WATER", "WASTEWATER"): return parse_water(raw)
    if utype == "GAS": return parse_gas(raw)
    return _skip_result(str(raw))

if __name__ == "__main__":
    import json, sys
    from collections import Counter
    d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "import.json", encoding="utf-8"))
    seen, stats, flagged = set(), Counter(), Counter()
    for p in d["projects"]:
        for u in p["utilities"]:
            t, raw = u["type"], u["rawValue"]
            key = (t, raw[:70])
            if key in seen: continue
            seen.add(key)
            r = parse_utility(t, raw)
            ok = r["normalizedValue"] is not None
            stats[t + ("/parsed" if ok else "/none")] += 1
            if r["flagged"]: flagged[t] += 1
            f = "F" if r["flagged"] else " "
            print(f"[{f}] {t:11} {str(r['normalizedValue']):>11} {r['normalizedUnit'] or '':16} << {raw.replace(chr(10),' // ')[:70]}")
    print("\nStats:", dict(stats))
    print("Flagged:", dict(flagged))

"""Rebuild the public KIIT atlas from an OSM API export and the official tour catalog."""
import argparse
import gzip
from collections import Counter, defaultdict
import json
import math
from pathlib import Path
import re
import struct
import subprocess
import tempfile
import zlib
import xml.etree.ElementTree as ET

ORIGIN = (85.816, 20.353)
MX = math.cos(math.radians(ORIGIN[1])) * 111320
MY = 111320
OUTPUT = Path(__file__).resolve().parents[1] / "frontend/src/world/data"


def xy(lon, lat):
    return [round((float(lon) - ORIGIN[0]) * MX), round((ORIGIN[1] - float(lat)) * MY)]


def tags(element):
    return {t.get("k"): t.get("v") for t in element.findall("tag")}


def classify(t):
    if t.get("building") not in (None, "no") or t.get("building:part") == "yes":
        return "building"
    if "highway" in t:
        road = t["highway"]
        if road in ("construction", "proposed", "platform", "bus_stop"):
            return None
        if road in ("footway", "path", "pedestrian", "cycleway", "steps", "bridleway"):
            return "path"
        if road in ("primary", "secondary", "trunk", "motorway", "tertiary") or road.endswith("_link"):
            return "avenue"
        return "lane" if road in ("service", "track") else "street"
    if t.get("natural") == "water" or "water" in t or t.get("landuse") in ("reservoir", "basin"):
        return "water"
    if t.get("waterway") in ("stream", "river", "canal", "drain"):
        return "stream"
    if t.get("leisure") in ("pitch", "stadium", "track", "sports_centre"):
        return "sport"
    if t.get("landuse") in ("forest", "orchard") or t.get("natural") in ("wood", "scrub"):
        return "wood"
    if t.get("leisure") in ("garden", "park") or t.get("landuse") in ("grass", "meadow", "recreation_ground", "farmland"):
        return "green"
    if t.get("amenity") in ("university", "college", "school", "hospital"):
        return "campus"
    if t.get("railway") == "rail":
        return "rail"
    return None


def building_height(t):
    height = re.fullmatch(r"(\d+(?:\.\d+)?)\s*m?", t.get("height", "").strip())
    if height:
        return max(1, round(float(height[1])))
    levels = re.fullmatch(r"\d+(?:\.\d+)?", t.get("building:levels", ""))
    return max(1, round(float(levels[0]) * 3.2)) if levels else 0


def stitch(segments):
    segments = [part[:] for part in segments if part]
    rings = []
    while segments:
        chain = segments.pop()
        while chain[0] != chain[-1]:
            match = next((i for i, p in enumerate(segments) if chain[-1] in (p[0], p[-1])), None)
            if match is None:
                break
            part = segments.pop(match)
            chain.extend((part if part[0] == chain[-1] else part[::-1])[1:])
        if len(chain) >= 4 and chain[0] == chain[-1]:
            rings.append(chain)
    return rings


def geography(source):
    root = ET.parse(source).getroot()
    nodes = {n.get("id"): xy(n.get("lon"), n.get("lat")) for n in root.findall("node")}
    ways = {w.get("id"): [p.get("ref") for p in w.findall("nd")] for w in root.findall("way")}
    bounds = root.find("bounds")
    extent = xy(bounds.get("minlon"), bounds.get("maxlat")) + xy(bounds.get("maxlon"), bounds.get("minlat"))
    features, positions = [], {}
    # Only destination IDs used by the public visitor directory are exported as anchors.
    landmarks = set("w1109132946 w1415871974 w1384184361 w1133129493 w1133134578 w1383668015 w1415871975 w1264588348 w1383663640 w1383667721 w1133129896 w1264588325 w1264588326 w1264588330 w1264588331 r19083628 n7078964748 n4578805794".split())

    def add(kind, parts, t):
        rings = []
        for part in parts:
            coords = []
            for ref in part:
                point = nodes.get(ref)
                if point is None:
                    return
                if not coords or point != coords[-1]:
                    coords.append(point)
            if len(coords) >= 2:
                rings.append([v for point in coords for v in point])
        if not rings:
            return
        area = kind not in ("street", "avenue", "lane", "path", "rail", "stream")
        if area and (len(rings[0]) < 8 or rings[0][:2] != rings[0][-2:]):
            return
        detail = building_height(t) if kind == "building" else t.get("sport", "") if kind == "sport" else ""
        features.append([kind, detail, rings])

    relation_ways = set()
    for r in root.findall("relation"):
        t = tags(r)
        kind = classify(t)
        if t.get("type") != "multipolygon" or not kind:
            continue
        members = [(m.get("role"), m.get("ref")) for m in r.findall("member") if m.get("type") == "way"]
        parts = [ring for role in ("outer", "inner") for ring in stitch([ways[i] for k, i in members if k == role and i in ways])]
        if parts and "r"+r.get("id") in landmarks:
            pts = [nodes[k] for ring in parts for k in ring]
            positions["r"+r.get("id")] = [round((min(v)+max(v))/2) for v in zip(*pts)]
        if parts:
            add(kind, parts, t)
            relation_ways.update((i, kind) for _, i in members)
    for w in root.findall("way"):
        i = w.get("id")
        t = tags(w)
        kind = classify(t)
        if kind and (i, kind) not in relation_ways:
            add(kind, [ways[i]], t)
        if "w"+i in landmarks:
            pts = [nodes[k] for k in ways[i]]
            # A bounding-box centre places the marker consistently inside a site's extents.
            positions["w"+i] = [round((min(v)+max(v))/2) for v in zip(*pts)]
    for n in root.findall("node"):
        i = n.get("id")
        if "n"+i in landmarks:
            positions["n"+i] = nodes[i]
        if tags(n).get("natural") == "tree":
            features.append(["tree", "", [nodes[i]]])
    assert positions.keys() == landmarks
    print("Mapped features:", Counter(f[0] for f in features))
    return dict(origin=ORIGIN, metresPerDegree=[MX, MY], bounds=extent, anchors=positions, features=features)


def footprint_gaps(source, osm):
    """Fill gaps conservatively. Prefer surveyed OSM outlines wherever boxes intersect."""
    def box(ring):
        x, y = ring[::2], ring[1::2]
        return min(x), min(y), max(x), max(y)

    def cells(b):
        for x in range(b[0] // 80, b[2] // 80 + 1):
            for y in range(b[1] // 80, b[3] // 80 + 1):
                yield x, y

    grid = defaultdict(list)
    for kind, _, rings in osm["features"]:
        if kind == "building":
            for ring in rings:
                b = box(ring)
                for cell in cells(b):
                    grid[cell].append(b)
    west, north, east, south = osm["bounds"]
    added = []
    with gzip.open(source, "rt") as lines:
        for line in lines:
            feature = json.loads(line)
            geom = feature["geometry"]
            if geom["type"] != "Polygon":
                continue
            lon, lat = geom["coordinates"][0][0]
            x, y = xy(lon, lat)
            if not (west <= x <= east and north <= y <= south):
                continue
            rings = [[v for p in ring for v in xy(*p)] for ring in geom["coordinates"]]
            b = box(rings[0])
            if any(b[0] < e and w < b[2] and b[1] < s and n < b[3]
                   for key in cells(b) for w, n, e, s in grid.get(key, ())):
                continue
            estimated = feature["properties"].get("height") or 0
            added.append(["building", max(0, round(estimated)), rings])
    print("Additional imagery-derived footprints:", len(added))
    return added


def cover_image(tile):
    # Preserve ESA class codes as grayscale samples. GDAL crops its georeferenced tile.
    width, height = 600, 708
    with tempfile.TemporaryDirectory() as work:
        output = Path(work) / "land.bin"
        subprocess.run(["gdal_translate", "-q", "-of", "ENVI", "-ot", "Byte", "-projwin",
                        "85.793", "20.387", "85.843", "20.328", "-outsize", str(width),
                        str(height), str(tile), str(output)], check=True)
        pixels = output.read_bytes()
    assert len(pixels) == width * height
    def chunk(kind, payload):
        return (struct.pack(">I", len(payload)) + kind + payload +
                struct.pack(">I", zlib.crc32(kind + payload)))
    rows = b"".join(b"\0" + pixels[i:i+width] for i in range(0, len(pixels), width))
    png = (b"\x89PNG\r\n\x1a\n" +
           chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, 0, 0, 0, 0)) +
           chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))
    (OUTPUT / "landcover.png").write_bytes(png)


def tour(playlist, locale):
    script = playlist.read_text()
    decoder = json.JSONDecoder()
    # The provider embeds localized string calls in an otherwise JSON definitions array.
    # Substitute their keys as strings so this importer never executes downloaded JavaScript.
    start = script.index("[{", script.index('"definitions"'))
    manifest = re.sub(r":trans\('([^']+)'\)", lambda m: ":" + json.dumps(m[1]), script[start:])
    definitions = {v["id"]: v for v in decoder.raw_decode(manifest)[0] if "id" in v}
    labels = dict(re.findall(r"^(\w+\.label) = (.+)$", locale.read_text(), re.M))

    def playlist_items(playlist_id):
        for item in definitions[playlist_id]["items"]:
            if isinstance(item, str):
                item = definitions[item.removeprefix("this.")]
            yield item["media"].removeprefix("this.")

    def thumbnail_lists(container_id, visited):
        if container_id in visited or container_id not in definitions:
            return []
        visited.add(container_id)
        obj = definitions[container_id]
        if obj["class"] == "ThumbnailList":
            return [obj["playList"].removeprefix("this.")]
        return [p for child in obj.get("children", []) if isinstance(child, str)
                for p in thumbnail_lists(child.removeprefix("this."), visited)]

    groups = defaultdict(list)
    for id_, button in definitions.items():
        caption = labels.get(id_ + ".label", "").strip()
        if button["class"] != "Button" or "mobile" in id_ or not caption.endswith(">"):
            continue
        panels = re.findall(r"visibleFunc\(this\.(Container_\w+)\)", button.get("click", ""))
        lists = thumbnail_lists(panels[-1], set()) if panels else []
        # Only use menus that lead directly to one scene playlist.
        if len(lists) != 1:
            continue
        group = caption[:-1].strip().title().replace("Engg", "Engineering")
        for abbr in ("Kiit", "Ict", "Tbi", "Iti"):
            group = group.replace(abbr, abbr.upper())
        for media in playlist_items(lists[0]):
            if group not in groups[media]:
                groups[media].append(group)
    scenes = [[labels[media + ".label"].strip(), *groups[media]] for media in playlist_items("mainPlayList")]
    assert scenes and scenes[0][0] == "Main Gate" and all(view[0] for view in scenes)
    print("Official tour views:", len(scenes), "with official menu groups:", sum(len(v)>1 for v in scenes))
    # Store the hosted medium-resolution cubemap URLs, leaving the photography with KIIT.
    cubes = []
    for media in playlist_items("mainPlayList"):
        levels = definitions[media]["frames"][0]["cube"]["levels"]
        level = next(v for v in levels if v.get("rowCount") == 2 and v.get("colCount") == 12)
        assert level["url"].startswith("media/") and "{face}" in level["url"]
        camera = definitions.get(media+"_camera", {}).get("initialPosition", {})
        cubes.append([level["url"], camera.get("yaw", 0), camera.get("pitch", 0)])
    (OUTPUT / "panoramas.json").write_text(json.dumps(cubes, separators=(",", ":")) + "\n")
    return scenes


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("osm", "playlist", "locale", "footprints", "worldcover"):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    osm = geography(args.osm)
    cover_image(args.worldcover)
    for name, data in (("geography", osm["features"]), ("atlas", {k:v for k,v in osm.items() if k != "features"}),
                       ("imagery-buildings", footprint_gaps(args.footprints, osm)),
                       ("scenes", tour(args.playlist, args.locale))):
        (OUTPUT / (name + ".json")).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")

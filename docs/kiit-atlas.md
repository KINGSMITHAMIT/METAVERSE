# KIIT campus atlas

The public map covers approximately 34.3 km² in the Patia district of Bhubaneswar, Odisha. Bounds are 85.793–85.843° E and 20.328–20.387° N. The atlas opens near KIIT’s central library, main campus and cricket ground. Its isometric viewport moves across locally bundled geography. The multiplayer team interior is a separate space.

## Sources and reuse

| Layer | Source and license | Treatment |
| --- | --- | --- |
| Buildings, roads, paths, grounds and landmark anchors | [OpenStreetMap contributors, ODbL 1.0](https://www.openstreetmap.org/copyright) | The local extract contains 3,697 building features. Named sites use a mapped point or the centre of a mapped outline. The derived data in `atlas.json` and `geography.json` are available under the ODbL. |
| Additional building outlines | [Microsoft Global ML Building Footprints](https://github.com/microsoft/GlobalMLBuildingFootprints), [CDLA Permissive 2.0](../frontend/src/world/data/CDLA-Permissive-2.0.txt) | The November 12, 2026 India release supplied 7,185 additional image-derived outlines. A conservative bounding-box intersection test gives mapped OSM buildings priority. The additional outline data are in `imagery-buildings.json`. |
| Tree cover, grass, crops, water and wetland | [ESA WorldCover 2021 v200, Zanaga et al.](https://doi.org/10.5281/zenodo.7254221), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Cropped the 10 m classifications to the map bounds, encoded them in `landcover.png`, and recoloured them at display time. Tree symbols sample the tree-cover class. Contains modified Copernicus Sentinel data (2021). |
| Panoramas and scene names | [KIIT official virtual tour](https://kiit.ac.in/tour/) and its [hosted player](https://www.immersivetourz.com/kiit/index.html) | The directory preserves all 519 playlist positions, including repeated names. Where the published menu associates a scene with a school or facility, searches use that association. The in-app 360° viewer requests the selected scene’s cube faces directly from the university’s tour provider. The full official player is linked alongside each scene. |
| Navigation reference | [HackerRank Interns 2026](https://www.hackerrank.com/interns/2026) | The original atlas adapts destination shortcuts, day and night themes, and keyboard exploration to KIIT geography. |

The map uses measured heights or storeys where available. Other heights and all façade details are illustrative. Aerial imagery, the 2021 land-cover survey and community mapping represent different dates. The university’s panoramic photography shows the appearance of photographed places at capture time.

## Refresh the data

Use Python 3.9+, GDAL with `gdal_translate` available, and a working directory for the downloads. The checked-in outputs support the usual build without fetching any mapping service. Run the following from the repository root to refresh.

```sh
mkdir -p target/atlas-sources
cd target/atlas-sources
curl -fL 'https://api.openstreetmap.org/api/0.6/map?bbox=85.793,20.328,85.843,20.387' -o kiit.osm
curl -fL 'https://www.immersivetourz.com/kiit/script_general.js' -o playlist.js
curl -fL 'https://www.immersivetourz.com/kiit/locale/en.txt' -o en.txt
curl -fL 'https://bfppub.z5.web.core.windows.net/2026-11-12/global-buildings.geojsonl/RegionName=India/quadkey=123311030/part-00044-4b4e6876-7466-49a9-940f-834dab87ccde.c000.csv.gz' -o india.gz
curl -fL 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N18E084_Map.tif' -o worldcover.tif
python3 ../../scripts/import_kiit.py kiit.osm playlist.js en.txt india.gz worldcover.tif
```

Geometry uses integer metre offsets from 85.816° E, 20.353° N, with positive Y running south. Each feature stores its kind, source height or sport detail, and rings of alternating X/Y values. The importer reads the remote tour definition as data. Review place-to-view associations against the current playlist after a refresh, since the provider controls its ordering.

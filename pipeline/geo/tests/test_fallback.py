import h3
import networkx as nx
from pyproj import Transformer
from shapely.geometry import Polygon, box

from oswoj_geo.access_osmnx import compute_walk
from oswoj_geo.isochrones import bands, polygons

TO_2180 = Transformer.from_crs("EPSG:4326", "EPSG:2180", always_xy=True).transform


def street_graph(points):
    """A straight footway through the given (lon, lat) points, as a projected osmnx-like graph."""
    g = nx.MultiDiGraph(crs="EPSG:2180")
    xy = [TO_2180(lon, lat) for lon, lat in points]
    for i, (x, y) in enumerate(xy):
        g.add_node(i, x=x, y=y)
    for i in range(len(xy) - 1):
        length = ((xy[i][0] - xy[i + 1][0]) ** 2 + (xy[i][1] - xy[i + 1][1]) ** 2) ** 0.5
        g.add_edge(i, i + 1, length=length)
        g.add_edge(i + 1, i, length=length)
    return g


def test_walking_fallback_keeps_the_15_minute_budget():
    origin = h3.latlng_to_cell(50.06, 19.94, 9)
    near, far = sorted(h3.grid_ring(origin, 1))[0], sorted(h3.grid_ring(origin, 5))[0]
    cells = [origin, near, far]
    centres = [(lng, lat) for lat, lng in (h3.cell_to_latlng(c) for c in cells)]
    # footway origin → near → far; the far cell is ~1.5 km away: beyond 15 min at 4.8 km/h (1200 m)
    graph = street_graph([centres[0], centres[1], centres[2]])
    places = [
        {"coords": list(centres[1]), "category": "przedszkole"},
        {"coords": list(centres[2]), "category": "park"},
    ]
    reach = compute_walk(cells, places, None, 4.8, 15, graph=graph)
    assert reach["walk"][0]["c"] == [0, 1]
    assert [p for p, _ in reach["walk"][0]["p"]] == [0]
    (x0, y0), (x1, y1) = TO_2180(*centres[0]), TO_2180(*centres[1])
    metres = ((x0 - x1) ** 2 + (y0 - y1) ** 2) ** 0.5  # ~300 m between neighbouring res-9 centres
    assert reach["walk"][0]["p"][0][1] == round(metres / 80)
    assert reach["transit"] is reach["walk"]  # no transit in the fallback


def test_points_far_from_any_footway_are_not_routed():
    origin = h3.latlng_to_cell(50.06, 19.94, 9)
    lat, lng = h3.cell_to_latlng(origin)
    graph = street_graph([(lng + 0.02, lat), (lng + 0.021, lat)])  # 1.4 km east of the cell centre
    assert compute_walk([origin], [], None, 4.8, 15, graph=graph)["walk"] == {}


def test_isochrone_bands_are_disjoint_rings_inside_the_city():
    to_wgs = Transformer.from_crs("EPSG:2180", "EPSG:4326", always_xy=True).transform
    x, y = TO_2180(19.94, 50.06)

    def square(half):
        return Polygon(
            [
                to_wgs(x + dx, y + dy)
                for dx, dy in ((-half, -half), (half, -half), (half, half), (-half, half), (-half, -half))
            ]
        )

    collection = {
        "features": [
            {"geometry": square(100).__geo_interface__, "properties": {"cost_level": 100}},
            {"geometry": square(300).__geo_interface__, "properties": {"cost_level": 200}},
        ]
    }
    city = box(19.9, 50.0, 20.0, 50.1)
    result = bands(collection, city)
    assert [(a, b) for a, b, _ in result] == [(0, 100), (100, 200)]
    inner, ring = result[0][2], result[1][2]
    assert abs(inner.area - 200 * 200) < 1 and abs(ring.area - (600 * 600 - 200 * 200)) < 1
    assert inner.intersection(ring).area < 1e-6
    assert len(polygons(ring)) == 1

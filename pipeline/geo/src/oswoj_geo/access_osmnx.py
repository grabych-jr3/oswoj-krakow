"""Walking-only fallback for the 15-minute analysis (PLAN.md §6.A, A8b): no Java, no r5py.

The OSM pedestrian network of Kraków (osmnx, Overpass, cached) and Dijkstra from every H3 cell
centre with a 15-minute budget at the same walking speed as r5py. Distances include the walk from
the point to the nearest network node and from the last node to the destination. Transit is not
computed: the "transit" mode repeats the walking reach and says so in ``method``.
"""

from collections import defaultdict
from typing import Any

from shapely.geometry import Point

from .fetch import CACHE_DIR

SNAP_MAX_M = 500  # a point farther from any footway than this is not routable (as r5py)


def walking_graph(city: Any, buffer_m: float = 1500) -> Any:
    """Projected OSM walk network of the city plus a margin (paths just outside the border count)."""
    import osmnx as ox

    ox.settings.use_cache = True
    ox.settings.cache_folder = str(CACHE_DIR / "osmnx")
    ox.settings.log_console = False
    area = ox.projection.project_geometry(city, to_latlong=False)[0].buffer(buffer_m)
    area_wgs = ox.projection.project_geometry(
        area, crs=ox.projection.project_geometry(city)[1], to_latlong=True
    )[0]
    graph = ox.graph_from_polygon(area_wgs, network_type="walk", simplify=True, retain_all=False)
    return ox.project_graph(graph)


def compute_walk(
    cells: list[str],
    places: list[dict[str, Any]],
    city: Any,
    walk_kmh: float,
    minutes: int,
    graph: Any | None = None,
) -> dict[str, dict[int, dict[str, list]]]:
    """Same structure as ``access.compute``: mode → origin cell index → {"c": [...], "p": [[i, min]...]}."""
    import h3
    import networkx as nx
    import osmnx as ox
    from pyproj import Transformer

    graph = graph if graph is not None else walking_graph(city)
    to_graph = Transformer.from_crs("EPSG:4326", graph.graph["crs"], always_xy=True).transform
    metres_per_min = walk_kmh * 1000 / 60
    budget_m = minutes * metres_per_min

    def snap(points: list[Point]) -> tuple[list[Any], list[float]]:
        if not points:
            return [], []
        xs, ys = zip(*(to_graph(p.x, p.y) for p in points), strict=True)
        nodes, dists = ox.distance.nearest_nodes(graph, list(xs), list(ys), return_dist=True)
        return list(nodes), list(dists)

    cell_points = [Point(lng, lat) for lat, lng in (h3.cell_to_latlng(c) for c in cells)]
    cell_nodes, cell_dist = snap(cell_points)
    place_nodes, place_dist = snap([Point(*p["coords"]) for p in places])

    # destinations hanging off each node: (kind, index, metres from the node)
    at_node: dict[Any, list[tuple[str, int, float]]] = defaultdict(list)
    for i, (node, dist) in enumerate(zip(cell_nodes, cell_dist, strict=True)):
        if dist <= SNAP_MAX_M:
            at_node[node].append(("c", i, dist))
    for i, (node, dist) in enumerate(zip(place_nodes, place_dist, strict=True)):
        if dist <= SNAP_MAX_M:
            at_node[node].append(("p", i, dist))

    reach: dict[int, dict[str, list]] = {}
    for origin, (node, dist) in enumerate(zip(cell_nodes, cell_dist, strict=True)):
        if dist > SNAP_MAX_M:
            continue
        lengths = nx.single_source_dijkstra_path_length(graph, node, cutoff=budget_m - dist, weight="length")
        r: dict[str, list] = {"c": [], "p": []}
        for n, path_m in lengths.items():
            for kind, i, tail in at_node.get(n, ()):
                total = dist + path_m + tail
                if total <= budget_m:
                    if kind == "c":
                        r["c"].append(i)
                    else:
                        r["p"].append([i, round(total / metres_per_min)])
        r["c"].sort()
        r["p"].sort(key=lambda pm: (pm[1], pm[0]))
        reach[origin] = r
    return {"walk": reach, "transit": reach}

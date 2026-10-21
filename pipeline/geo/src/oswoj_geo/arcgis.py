"""Paginated GeoJSON download from an ArcGIS FeatureServer layer (PLAN.md §3.2 p.8)."""

from typing import Any

import httpx

PAGE_SIZE = 2000
MAX_PAGES = 500


class ArcGisError(RuntimeError):
    pass


def object_id_field(client: httpx.Client, layer_url: str) -> str:
    """Name of the layer's id field ("OBJECTID", "FID", …), for a stable page order."""
    response = client.get(layer_url.rstrip("/"), params={"f": "json"})
    if response.status_code != 200:
        raise ArcGisError(f"{layer_url} → {response.status_code}: {response.text[:200]}")
    meta = response.json()
    if "error" in meta:
        raise ArcGisError(f"{layer_url}: {meta['error']}")
    return meta.get("objectIdField") or "OBJECTID"


def fetch_layer(client: httpx.Client, layer_url: str, page_size: int = PAGE_SIZE) -> dict[str, Any]:
    """All features of a layer as one FeatureCollection in EPSG:4326."""
    id_field = object_id_field(client, layer_url)
    features: list[dict[str, Any]] = []
    for page in range(MAX_PAGES):
        params = {
            "where": "1=1",
            "outFields": "*",
            "outSR": "4326",
            "orderByFields": id_field,
            "resultOffset": str(page * page_size),
            "resultRecordCount": str(page_size),
            "f": "geojson",
        }
        response = client.get(f"{layer_url.rstrip('/')}/query", params=params)
        if response.status_code != 200:
            raise ArcGisError(f"{layer_url} → {response.status_code}: {response.text[:200]}")
        data = response.json()
        if "error" in data:
            raise ArcGisError(f"{layer_url}: {data['error']}")
        batch = data.get("features", [])
        features.extend(batch)
        more = data.get("exceededTransferLimit") or data.get("properties", {}).get("exceededTransferLimit")
        if not batch or not more:
            return {"type": "FeatureCollection", "features": features}
    raise ArcGisError(f"{layer_url}: more than {MAX_PAGES} pages")

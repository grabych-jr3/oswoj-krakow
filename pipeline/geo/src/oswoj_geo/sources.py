"""Registry of stream A sources (PLAN.md §3.1, rows 3–17).

Table names were checked against ``/metadata`` on 2026-10-19; URL paths are the
lower-case, hyphenated ``object_name`` (except ``opendata-kluby/Kluby``).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PortalTable:
    name: str
    api: str
    table: str


@dataclass(frozen=True)
class FileDownload:
    name: str
    url: str
    filename: str
    large: bool = False  # skipped with --skip-large


@dataclass(frozen=True)
class ArcGisLayer:
    name: str
    url: str


Source = PortalTable | FileDownload | ArcGisLayer

_EDU = "opendata-oswiata"
_ARCGIS = "https://services-eu1.arcgis.com/svTzSt3AvH7sK6q9/arcgis/rest/services"

SOURCES: tuple[Source, ...] = (
    # 3–5 education, school year 2025/26
    PortalTable("przedszkola_samorzadowe", f"{_EDU}-przedszkola-liczba-dzieci",
                "liczba-dzieci-przedszkola-samorzadowe-2025-2026"),
    PortalTable("przedszkola_niesamorzadowe", f"{_EDU}-przedszkola-liczba-dzieci",
                "liczba-dzieci-przedszkola-niesamorzadowe-2025-2026"),
    PortalTable("szkoly_podstawowe_samorzadowe", f"{_EDU}-szkoly-podstawowe-liczba-uczniow",
                "uczniowie-szkoly-podstawowe-samorzadowe-2025-2026"),
    PortalTable("szkoly_podstawowe_niesamorzadowe", f"{_EDU}-szkoly-podstawowe-liczba-uczniow",
                "uczniowie-szkoly-podstawowe-niesamorzadowe-2025-2026"),
    PortalTable("szkoly_ponadpodstawowe_samorzadowe", f"{_EDU}-szkoly-ponadpodstawowe-liczba-uczniow",
                "uczniowie-szkoly-ponadpodstawowe-samorzadowe-2025-2026"),
    PortalTable("szkoly_ponadpodstawowe_niesamorzadowe", f"{_EDU}-szkoly-ponadpodstawowe-liczba-uczniow",
                "uczniowie-szkoly-ponadpodstawowe-niesamorzadowe-2025-2026"),
    # 6–8 childcare
    PortalTable("zlobki_samorzadowe", "opendata-zdrowie-zlobki-samorzadowe", "zlobki-samorzadowe"),
    PortalTable("zlobki_prywatne", "opendata-zdrowie-zlobki-prywatne", "zlobki-prywatne"),
    PortalTable("zlobki_zlecenie_gmk", "opendata-zdrowie-zlobki-gmk", "zlobki-zlecenie-gmk"),
    PortalTable("kluby_dzieciece", "opendata-zdrowie-kluby-dzieciece", "kluby-dzieciece"),
    PortalTable("kluby_rodzicow", "opendata-kluby", "Kluby"),
    # 9–10 libraries, parks
    PortalTable("biblioteki", "opendata-kultura-lista-bibliotek", "biblioteka-krakow-filie"),
    PortalTable("parki_miejskie", "opendata-srodowisko-parki-miejskie", "parki-miejskie-powierzchnia"),
    PortalTable("parki_kieszonkowe", "opendata-srodowisko-parki-kieszonkowe",
                "parki-kieszonkowe-powierzchnia"),
    # 11–12 residents by district, 31.12.2025
    PortalTable("cudzoziemcy_czasowy", "opendata-mieszkancy-cudzoziemcy-pobyt-czasowy",
                "cudzoziemcy-zameldowani-na-pobyt-czasowy-ob-31-12-2025"),
    PortalTable("cudzoziemcy_staly", "opendata-mieszkancy-cudzoziemcy-pobyt-staly",
                "cudzoziemcy-zameldowani-na-pobyt-staly-ob-31-12-2025"),
    PortalTable("mieszkancy_czasowy", "opendata-mieszkancy-pobyt-czasowy",
                "zameldowani-na-pobyt-czasowy-km-31-12-2025"),
    PortalTable("mieszkancy_staly", "opendata-mieszkancy-pobyt-staly",
                "zameldowani-na-pobyt-staly-km-31-12-2025"),
    # 13–14 MSIP (EPSG:2178)
    FileDownload("emuia_adresy", "https://msip.um.krakow.pl/Dane/Adresy_JSON.zip", "Adresy_JSON.zip"),
    FileDownload("dzielnice", "https://msip.um.krakow.pl/Dane/Dzielnice_JSON.zip", "Dzielnice_JSON.zip"),
    # 15 GTFS (A buses, T trams, M — to check)
    FileDownload("gtfs_a", "https://gtfs.ztp.krakow.pl/GTFS_KRK_A.zip", "GTFS_KRK_A.zip"),
    FileDownload("gtfs_t", "https://gtfs.ztp.krakow.pl/GTFS_KRK_T.zip", "GTFS_KRK_T.zip"),
    FileDownload("gtfs_m", "https://gtfs.ztp.krakow.pl/GTFS_KRK_M.zip", "GTFS_KRK_M.zip"),
    # 16 ZTP ArcGIS
    ArcGisLayer("przystanki_kmk", f"{_ARCGIS}/Przystanki_Komunikacji_Miejskiej_w_Krakowie/FeatureServer/0"),
    ArcGisLayer("park_and_ride", f"{_ARCGIS}/Park_and_Ride/FeatureServer/0"),
    # 17 OSM
    FileDownload("osm_malopolskie", "https://download.geofabrik.de/europe/poland/malopolskie-latest.osm.pbf",
                 "malopolskie-latest.osm.pbf", large=True),
)

BY_NAME: dict[str, Source] = {s.name: s for s in SOURCES}

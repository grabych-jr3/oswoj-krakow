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
    page: str | None = None  # dataset page slug on otwartedane.um.krakow.pl (shown as the source)
    as_of: str | None = None  # "Stan danych na …" from that page, ISO date


PORTAL_PAGE = "https://otwartedane.um.krakow.pl/zbiory-danych/{page}"
_EDU_AS_OF = "2025-09-30"  # "Stan danych na 30 września każdego roku szkolnego", school year 2025/26


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
    page: str | None = None  # public item page on arcgis.com (shown as the source)
    as_of: str | None = None  # "modified" date of that item, ISO


ARCGIS_ITEM = "https://www.arcgis.com/home/item.html?id={id}"


Source = PortalTable | FileDownload | ArcGisLayer

_EDU = "opendata-oswiata"
_ARCGIS = "https://services-eu1.arcgis.com/svTzSt3AvH7sK6q9/arcgis/rest/services"

SOURCES: tuple[Source, ...] = (
    # 3–5 education, school year 2025/26
    PortalTable("przedszkola_samorzadowe", f"{_EDU}-przedszkola-liczba-dzieci",
                "liczba-dzieci-przedszkola-samorzadowe-2025-2026",
                "przedszkola-w-krakowie-liczba-dzieci", _EDU_AS_OF),
    PortalTable("przedszkola_niesamorzadowe", f"{_EDU}-przedszkola-liczba-dzieci",
                "liczba-dzieci-przedszkola-niesamorzadowe-2025-2026",
                "przedszkola-w-krakowie-liczba-dzieci", _EDU_AS_OF),
    PortalTable("szkoly_podstawowe_samorzadowe", f"{_EDU}-szkoly-podstawowe-liczba-uczniow",
                "uczniowie-szkoly-podstawowe-samorzadowe-2025-2026",
                "szkoly-podstawowe-w-krakowie-liczba-dzieci", _EDU_AS_OF),
    PortalTable("szkoly_podstawowe_niesamorzadowe", f"{_EDU}-szkoly-podstawowe-liczba-uczniow",
                "uczniowie-szkoly-podstawowe-niesamorzadowe-2025-2026",
                "szkoly-podstawowe-w-krakowie-liczba-dzieci", _EDU_AS_OF),
    PortalTable("szkoly_ponadpodstawowe_samorzadowe", f"{_EDU}-szkoly-ponadpodstawowe-liczba-uczniow",
                "uczniowie-szkoly-ponadpodstawowe-samorzadowe-2025-2026",
                "szkoly-ponadpodstawowe-w-krakowie-liczba-uczniow", _EDU_AS_OF),
    PortalTable("szkoly_ponadpodstawowe_niesamorzadowe", f"{_EDU}-szkoly-ponadpodstawowe-liczba-uczniow",
                "uczniowie-szkoly-ponadpodstawowe-niesamorzadowe-2025-2026",
                "szkoly-ponadpodstawowe-w-krakowie-liczba-uczniow", _EDU_AS_OF),
    # 6–8 childcare
    PortalTable("zlobki_samorzadowe", "opendata-zdrowie-zlobki-samorzadowe", "zlobki-samorzadowe",
                "zlobki-samorzadowe-w-krakowie", "2026-10-19"),
    PortalTable("zlobki_prywatne", "opendata-zdrowie-zlobki-prywatne", "zlobki-prywatne",
                "zlobki-prywatne-w-krakowie", "2026-07-22"),
    PortalTable("zlobki_zlecenie_gmk", "opendata-zdrowie-zlobki-gmk", "zlobki-zlecenie-gmk",
                "zlobki-niesamorzadowe-prowadzone-na-zlecenie-gminy-miejskiej-krakow", "2026-07-22"),
    PortalTable("kluby_dzieciece", "opendata-zdrowie-kluby-dzieciece", "kluby-dzieciece",
                "kluby-dzieciece-w-krakowie", "2026-07-22"),
    PortalTable("kluby_rodzicow", "opendata-kluby", "Kluby", "kluby-rodzicow-z-dziecmi-do-lat-3-w-krakowie"),
    # 9–10 libraries, parks
    PortalTable("biblioteki", "opendata-kultura-lista-bibliotek", "biblioteka-krakow-filie",
                "lista-bibliotek-miejskich-biblioteki-krakow"),
    PortalTable("parki_miejskie", "opendata-srodowisko-parki-miejskie", "parki-miejskie-powierzchnia",
                "parki-miejskie-w-krakowie"),
    PortalTable("parki_kieszonkowe", "opendata-srodowisko-parki-kieszonkowe",
                "parki-kieszonkowe-powierzchnia", "parki-kieszonkowe-w-krakowie"),
    # 11–12 residents by district, 31.12.2025
    PortalTable("cudzoziemcy_czasowy", "opendata-mieszkancy-cudzoziemcy-pobyt-czasowy",
                "cudzoziemcy-zameldowani-na-pobyt-czasowy-ob-31-12-2025"),
    PortalTable("cudzoziemcy_staly", "opendata-mieszkancy-cudzoziemcy-pobyt-staly",
                "cudzoziemcy-zameldowani-na-pobyt-staly-ob-31-12-2025"),
    PortalTable("mieszkancy_czasowy", "opendata-mieszkancy-pobyt-czasowy",
                "zameldowani-na-pobyt-czasowy-km-31-12-2025"),
    PortalTable("mieszkancy_staly", "opendata-mieszkancy-pobyt-staly",
                "zameldowani-na-pobyt-staly-km-31-12-2025"),
    # same populations in detail (birth / registration year): cross-check of the district sums (A4)
    PortalTable("mieszkancy_staly_szczegoly", "opendata-mieszkancy-pobyt-staly",
                "zameldowani-na-pobyt-staly-31-12-2025"),
    PortalTable("mieszkancy_czasowy_szczegoly", "opendata-mieszkancy-pobyt-czasowy",
                "zameldowani-na-pobyt-czasowy-31-12-2025"),
    PortalTable("cudzoziemcy_staly_szczegoly", "opendata-mieszkancy-cudzoziemcy-pobyt-staly",
                "cudzoziemcy-zameldowani-na-pobyt-staly-31-12-2025"),
    PortalTable("cudzoziemcy_czasowy_szczegoly", "opendata-mieszkancy-cudzoziemcy-pobyt-czasowy",
                "cudzoziemcy-zameldowani-na-pobyt-czasowy-31-12-2025"),
    # 13–14 MSIP (EPSG:2178)
    FileDownload("emuia_adresy", "https://msip.um.krakow.pl/Dane/Adresy_JSON.zip", "Adresy_JSON.zip"),
    FileDownload("dzielnice", "https://msip.um.krakow.pl/Dane/Dzielnice_JSON.zip", "Dzielnice_JSON.zip"),
    # 15 GTFS (A buses, T trams, M — to check)
    FileDownload("gtfs_a", "https://gtfs.ztp.krakow.pl/GTFS_KRK_A.zip", "GTFS_KRK_A.zip"),
    FileDownload("gtfs_t", "https://gtfs.ztp.krakow.pl/GTFS_KRK_T.zip", "GTFS_KRK_T.zip"),
    FileDownload("gtfs_m", "https://gtfs.ztp.krakow.pl/GTFS_KRK_M.zip", "GTFS_KRK_M.zip"),
    # 16 ZTP ArcGIS
    ArcGisLayer("przystanki_kmk", f"{_ARCGIS}/Przystanki_Komunikacji_Miejskiej_w_Krakowie/FeatureServer/0",
                ARCGIS_ITEM.format(id="73cfc1778d0d4305a643ef0d2cb13e1f"), "2026-10-01"),
    ArcGisLayer("park_and_ride", f"{_ARCGIS}/Park_and_Ride/FeatureServer/0",
                ARCGIS_ITEM.format(id="ad56306213d640ada0a65598b8592827"), "2024-10-02"),
    # pocket parks as polygons, published by the city with the open data (A5)
    ArcGisLayer("parki_kieszonkowe_zasieg",
                f"{_ARCGIS}/Otwarte_Dane___Parki_Kieszonkowe_Krak%C3%B3w_WFL1/FeatureServer/0"),
    # 17 OSM
    FileDownload("osm_malopolskie", "https://download.geofabrik.de/europe/poland/malopolskie-latest.osm.pbf",
                 "malopolskie-latest.osm.pbf", large=True),
)

BY_NAME: dict[str, Source] = {s.name: s for s in SOURCES}

"""Build and export scenarios in PL, UK, EN strictly following the Scenario contract."""

import json
from pathlib import Path

SCENARIOS_DATA = [
    {
        "id": "przeprowadzka-pl",
        "sources": [
            "https://www.bip.krakow.pl/uslugi/SA-14",
            "https://www.bip.krakow.pl/uslugi/KM-8",
        ],
        "pl": {
            "title": "Przeprowadzka do Krakowa (dla obywateli Polski)",
            "forWhom": "Obywatele Polski zmieniający miejsce zamieszkania i przeprowadzający się do Krakowa.",
            "steps": [
                {
                    "order": 1,
                    "title": "Zameldowanie na pobyt stały lub czasowy",
                    "why": "Obowiązek meldunkowy wynikający z ustawy. Pozwala m.in. na korzystanie z Krakowskiej Karty Miejskiej ze zniżkami oraz przypisanie do obwodu wyborczego i placówek edukacyjnych.",
                    "when": "Najpóźniej w 30. dniu od dnia przybycia do nowego miejsca zamieszkania",
                    "procedureSymbols": ["SA-14"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Aktualizacja adresu w dowodzie rejestracyjnym pojazdu",
                    "why": "Konieczność zachowania zgodności danych rejestracyjnych pojazdu z aktualnym miejscem zamieszkania właściciela.",
                    "when": "W terminie 30 dni od dnia zmiany adresu zamieszkania",
                    "procedureSymbols": ["KM-8"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Wybór lekarza podstawowej opieki zdrowotnej (POZ)",
                    "why": "Zapewnienie bezpłatnej opieki medycznej w ramach NFZ blisko nowego miejsca zamieszkania.",
                    "when": None,
                    "procedureSymbols": [],
                    "placeCategories": [],
                    "external": [
                        {
                            "title": "Internetowe Konto Pacjenta (pacjent.gov.pl)",
                            "url": "https://pacjent.gov.pl",
                        }
                    ],
                },
            ],
        },
        "uk": {
            "title": "Переїзд до Кракова (для громадян Польщі)",
            "forWhom": "Громадяни Польщі, які змінюють місце проживання та переїжджають до Кракова.",
            "steps": [
                {
                    "order": 1,
                    "title": "Реєстрація місця проживання (zameldowanie)",
                    "why": "Обов'язок реєстрації згідно із законодавством. Дозволяє користуватися пільгами Картки Краків'янина, голосувати та записувати дітей до навчальних закладів.",
                    "when": "Не пізніше 30-го дня з моменту прибуття на нове місце проживання",
                    "procedureSymbols": ["SA-14"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Оновлення адреси в техпаспорті автомобіля",
                    "why": "Необхідність відповідності реєстраційних даних транспортного засобу актуальному місцю проживання власника.",
                    "when": "Протягом 30 днів від дати зміни адреси проживання",
                    "procedureSymbols": ["KM-8"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Вибір лікаря первинної медичної допомоги (POZ)",
                    "why": "Забезпечення медичного обслуговування за програмою NFZ поруч із новим місцем проживання.",
                    "when": None,
                    "procedureSymbols": [],
                    "placeCategories": [],
                    "external": [
                        {
                            "title": "Інтернет-кабінет пацієнта (pacjent.gov.pl)",
                            "url": "https://pacjent.gov.pl",
                        }
                    ],
                },
            ],
        },
        "en": {
            "title": "Moving to Kraków (for Polish citizens)",
            "forWhom": "Polish citizens relocating and moving their residence to Kraków.",
            "steps": [
                {
                    "order": 1,
                    "title": "Registration of permanent or temporary residence (zameldowanie)",
                    "why": "Statutory registration obligation. Enables access to Kraków City Card discounts, voter lists, and school district assignments.",
                    "when": "No later than the 30th day from arriving at the new address",
                    "procedureSymbols": ["SA-14"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Update address in vehicle registration certificate",
                    "why": "Requirement to keep vehicle registration records aligned with the owner's actual residence.",
                    "when": "Within 30 days from the change of residential address",
                    "procedureSymbols": ["KM-8"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Select a primary care physician (POZ)",
                    "why": "Ensuring public NFZ healthcare coverage close to the new place of residence.",
                    "when": None,
                    "procedureSymbols": [],
                    "placeCategories": [],
                    "external": [
                        {
                            "title": "Patient Online Account (pacjent.gov.pl)",
                            "url": "https://pacjent.gov.pl",
                        }
                    ],
                },
            ],
        },
    },
    {
        "id": "cudzoziemiec-ue",
        "sources": [
            "https://www.bip.krakow.pl/uslugi/SA-12",
            "https://malopolska.uw.gov.pl",
        ],
        "pl": {
            "title": "Pierwsze kroki dla obywateli Unii Europejskiej (UE/EOG/Szwajcaria)",
            "forWhom": "Obywatele państw członkowskich Unii Europejskiej, EOG oraz Szwajcarii i członkowie ich rodzin.",
            "steps": [
                {
                    "order": 1,
                    "title": "Zameldowanie cudzoziemca na pobyt stały lub czasowy",
                    "why": "Realizacja ustawowego obowiązku meldunkowego dla cudzoziemców przebywających w Polsce.",
                    "when": "Najpóźniej w 30. dniu od dnia przybycia, jeśli pobyt przekracza 30 dni",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Zarejestrowanie pobytu obywatela UE w Urzędzie Wojewódzkim",
                    "why": "Formalny wymóg legalizacyjny dla pobytów obywateli UE w Polsce przekraczających 3 miesiące (sprawa w gestii Wojewody Małopolskiego).",
                    "when": "W kolejnym dniu po upływie 3 miesięcy od dnia wjazdu na terytorium RP",
                    "procedureSymbols": [],
                    "placeCategories": [],
                    "external": [
                        {
                            "title": "Wydział Spraw Cudzoziemców Małopolskiego Urzędu Wojewódzkiego",
                            "url": "https://malopolska.uw.gov.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Karta miejska i transport publiczny w Krakowie",
                    "why": "Zakup biletów okresowych KMK lub wyrobienie Krakowskiej Karty Miejskiej w celu sprawnego poruszania się po mieście.",
                    "when": None,
                    "procedureSymbols": [],
                    "placeCategories": ["przystanek"],
                    "external": [
                        {
                            "title": "Zarząd Transportu Publicznego w Krakowie (ZTP)",
                            "url": "https://ztp.krakow.pl",
                        }
                    ],
                },
            ],
        },
        "uk": {
            "title": "Перші кроки для громадян ЄС (ЄС/ЄЕЗ/Швейцарія)",
            "forWhom": "Громадяни країн-членів ЄС, ЄЕЗ та Швейцарії та члени їхніх сімей у Кракові.",
            "steps": [
                {
                    "order": 1,
                    "title": "Реєстрація місця проживання іноземця (zameldowanie)",
                    "why": "Виконання обов'язку реєстрації для іноземців, які перебувають у Польщі понад 30 днів.",
                    "when": "Не пізніше 30-го дня від дати прибуття до нового місця проживання",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Реєстрація перебування громадянина ЄС у Воєводському управлінні",
                    "why": "Вимога закону при перебуванні в Польщі понад 3 місяці (компетенція Малопольського воєводи).",
                    "when": "Наступного дня після спливу 3 місяців від дня в'їзду до Польщі",
                    "procedureSymbols": [],
                    "placeCategories": [],
                    "external": [
                        {
                            "title": "Відділ у справах іноземців Малопольського воєводського управління",
                            "url": "https://malopolska.uw.gov.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Міський транспорт і проїзні квитки у Кракові",
                    "why": "Оформлення міської карти або проїзних квитків KMK для зручного пересування містом.",
                    "when": None,
                    "procedureSymbols": [],
                    "placeCategories": ["przystanek"],
                    "external": [
                        {
                            "title": "Управління міського транспорту Кракова (ZTP)",
                            "url": "https://ztp.krakow.pl",
                        }
                    ],
                },
            ],
        },
        "en": {
            "title": "First Steps for EU Citizens (EU/EEA/Switzerland)",
            "forWhom": "Citizens of EU/EEA member states and Switzerland and their family members.",
            "steps": [
                {
                    "order": 1,
                    "title": "Registration of foreigner residence (zameldowanie)",
                    "why": "Fulfillment of statutory residence registration for foreigners staying in Poland for more than 30 days.",
                    "when": "No later than the 30th day from arrival",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Register EU citizen stay at the Voivodship Office",
                    "why": "Legal requirement for EU citizen stays exceeding 3 months (administered by Małopolska Voivode).",
                    "when": "On the day following the end of 3 months from entry into Poland",
                    "procedureSymbols": [],
                    "placeCategories": [],
                    "external": [
                        {
                            "title": "Department for Foreigners of the Małopolska Voivodship Office",
                            "url": "https://malopolska.uw.gov.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Public transport card and getting around Kraków",
                    "why": "Purchasing public transit passes or applying for Kraków City Card for local mobility.",
                    "when": None,
                    "procedureSymbols": [],
                    "placeCategories": ["przystanek"],
                    "external": [
                        {
                            "title": "Public Transport Authority in Kraków (ZTP)",
                            "url": "https://ztp.krakow.pl",
                        }
                    ],
                },
            ],
        },
    },
    {
        "id": "cudzoziemiec-spoza-ue",
        "sources": [
            "https://www.bip.krakow.pl/uslugi/SA-34",
            "https://www.bip.krakow.pl/uslugi/SA-12",
            "https://www.bip.krakow.pl/uslugi/MOPS-21",
            "https://malopolska.uw.gov.pl",
        ],
        "pl": {
            "title": "Pierwsze kroki dla cudzoziemców spoza Unii Europejskiej",
            "forWhom": "Obywatele państw trzecich (spoza UE/EOG) przyjeżdżający do Krakowa do pracy, nauki lub z rodziną.",
            "steps": [
                {
                    "order": 1,
                    "title": "Uzyskanie numeru PESEL na wniosek",
                    "why": "Kluczowy numer identyfikacyjny w kontaktach z urzędami, bankami, opieką zdrowotną oraz przy rozliczeniach podatkowych.",
                    "when": "Po przybyciu do Polski w przypadku posiadania podstawy prawnej",
                    "procedureSymbols": ["SA-34"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Meldunek czasowy lub stały cudzoziemca",
                    "why": "Potwierdzenie legalnego adresu zamieszkania w Krakowie, niezbędne m.in. w procedurach legalizacji pobytu.",
                    "when": "Najpóźniej w 4. dniu od dnia przybycia, jeśli pobyt przekracza 30 dni",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Legalizacja pobytu — Karta Pobytu w Urzędzie Wojewódzkim",
                    "why": "Złożenie wniosku o zezwolenie na pobyt czasowy w Małopolskim Urzędzie Wojewódzkim (poza kompetencją Urzędu Miasta).",
                    "when": "Najpóźniej w ostatnim dniu legalnego pobytu na terytorium RP",
                    "procedureSymbols": [],
                    "placeCategories": [],
                    "external": [
                        {
                            "title": "Małopolski Urząd Wojewódzki — Sprawy Cudzoziemców",
                            "url": "https://malopolska.uw.gov.pl",
                        }
                    ],
                },
                {
                    "order": 4,
                    "title": "Wsparcie integracyjne i poradnictwo socjalne (MOPS)",
                    "why": "Konsultacje, pomoc doradcza i integracyjna oferowana przez Miejski Ośrodek Pomocy Społecznej w Krakowie.",
                    "when": None,
                    "procedureSymbols": ["MOPS-21"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
        "uk": {
            "title": "Перші кроки для іноземців з-поза меж ЄС",
            "forWhom": "Громадяни третіх країн (не члени ЄС/ЄЕЗ), які прибувають до Кракова на роботу, навчання або до родини.",
            "steps": [
                {
                    "order": 1,
                    "title": "Отримання номера PESEL за заявою",
                    "why": "Головний ідентифікаційний номер для банків, податкової, медицини та офіційних установ.",
                    "when": "Після прибуття до Польщі за наявності правової підстави",
                    "procedureSymbols": ["SA-34"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Реєстрація місця проживання (zameldowanie)",
                    "why": "Офіційне підтвердження адреси в Кракові, необхідне для подальшої легалізації перебування.",
                    "when": "Не пізніше 4-го дня від прибуття, якщо планований термін перебування понад 30 днів",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Легалізація перебування — Карта побиту у Воєводському управлінні",
                    "why": "Подання заяви на дозвіл на тимчасове перебування до Малопольського воєводського управління (компетенція Воєводи).",
                    "when": "Не пізніше останнього дня легального перебування в Польщі",
                    "procedureSymbols": [],
                    "placeCategories": [],
                    "external": [
                        {
                            "title": "Малопольське воєводське управління — Справи іноземців",
                            "url": "https://malopolska.uw.gov.pl",
                        }
                    ],
                },
                {
                    "order": 4,
                    "title": "Інтеграційна підтримка та консультації (MOPS)",
                    "why": "Консультації, інформаційна та соціальна підтримка від Міського осередку соціальної допомоги Кракова.",
                    "when": None,
                    "procedureSymbols": ["MOPS-21"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
        "en": {
            "title": "First Steps for Non-EU Foreigners",
            "forWhom": "Third-country nationals (non-EU/EEA) relocating to Kraków for work, study, or family.",
            "steps": [
                {
                    "order": 1,
                    "title": "Obtaining a PESEL number upon application",
                    "why": "Crucial national identification number required for banking, taxation, healthcare, and public administration.",
                    "when": "Upon arrival in Poland with a legal basis",
                    "procedureSymbols": ["SA-34"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Foreigner residence registration (zameldowanie)",
                    "why": "Official confirmation of address in Kraków, required for residence permit procedures.",
                    "when": "No later than the 4th day from arrival if staying more than 30 days",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Legalization of residence — Residence Card (Urząd Wojewódzki)",
                    "why": "Submitting a temporary residence permit application to the Małopolska Voivodship Office (state administration).",
                    "when": "No later than the last day of legal stay in Poland",
                    "procedureSymbols": [],
                    "placeCategories": [],
                    "external": [
                        {
                            "title": "Małopolska Voivodship Office — Foreigners Affairs",
                            "url": "https://malopolska.uw.gov.pl",
                        }
                    ],
                },
                {
                    "order": 4,
                    "title": "Integration support and social counselling (MOPS)",
                    "why": "Advisory support and integration assistance provided by the Municipal Social Welfare Centre in Kraków.",
                    "when": None,
                    "procedureSymbols": ["MOPS-21"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
    },
    {
        "id": "obywatel-ua",
        "sources": [
            "https://www.bip.krakow.pl/uslugi/SA-65",
            "https://www.bip.krakow.pl/uslugi/SA-12",
            "https://www.bip.krakow.pl/uslugi/MOPS-21",
            "https://www.bip.krakow.pl/uslugi/GUP-1",
            "https://www.bip.krakow.pl/uslugi/GUP-2",
            "https://gupkrakow.praca.gov.pl",
        ],
        "pl": {
            "title": "Pierwsze kroki dla obywateli Ukrainy objętych ochroną czasową",
            "forWhom": "Obywatele Ukrainy oraz członkowie ich rodzin przybyli do Polski w związku z działaniami wojennymi.",
            "steps": [
                {
                    "order": 1,
                    "title": "Nadanie numeru PESEL ze statusem UKR",
                    "why": "Potwierdzenie ochrony czasowej, legalnego pobytu oraz dostęp do opieki medycznej, rynku pracy i świadczeń.",
                    "when": "Niezwłocznie po przybyciu do Polski (zgodnie z przepisami ustawy o pomocy obywatelom Ukrainy)",
                    "procedureSymbols": ["SA-65"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Zameldowanie i zgłoszenie adresu zamieszkania",
                    "why": "Oficjalna rejestracja miejsca zamieszkania w Krakowie ułatwiająca rekrutację do przedszkoli i szkół.",
                    "when": "Najpóźniej w 30. dniu od przybycia",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Rejestracja w Grodzkim Urzędzie Pracy w Krakowie",
                    "why": "Pomoc w znalezieniu zatrudnienia, staży zawodowych oraz dostęp do bezpłatnych kursów języka polskiego.",
                    "when": None,
                    "procedureSymbols": ["GUP-1", "GUP-2"],
                    "placeCategories": ["urzad"],
                    "external": [
                        {
                            "title": "Grodzki Urząd Pracy w Krakowie",
                            "url": "https://gupkrakow.praca.gov.pl",
                        }
                    ],
                },
                {
                    "order": 4,
                    "title": "Wsparcie socjalne i pomoc integracyjna (MOPS)",
                    "why": "Skorzystanie z programów wsparcia socjalnego, poradnictwa psychologicznego i pomocy rzeczowej dla uchodźców.",
                    "when": None,
                    "procedureSymbols": ["MOPS-21"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
        "uk": {
            "title": "Перші кроки для громадян України під тимчасовим захистом",
            "forWhom": "Громадяни України та члени їхніх сімей, які прибули до Кракова у зв'язку з війною.",
            "steps": [
                {
                    "order": 1,
                    "title": "Отримання номера PESEL зі статусом UKR",
                    "why": "Підтвердження тимчасового захисту, легальності перебування, права на безкоштовну медицину, роботу та допомоги.",
                    "when": "Одразу після прибуття до Польщі",
                    "procedureSymbols": ["SA-65"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Реєстрація місця проживання (zameldowanie)",
                    "why": "Підтвердження адреси проживання в Кракові, що значно спрощує запис дітей до садочків і шкіл за місцем проживання.",
                    "when": "Не пізніше 30 днів від прибуття",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Реєстрація у Міському центрі зайнятості (GUP Kraków)",
                    "why": "Допомога з працевлаштуванням, стажуваннями та запис на безкоштовні курси польської мови.",
                    "when": None,
                    "procedureSymbols": ["GUP-1", "GUP-2"],
                    "placeCategories": ["urzad"],
                    "external": [
                        {
                            "title": "Міський центр зайнятості у Кракові (GUP)",
                            "url": "https://gupkrakow.praca.gov.pl",
                        }
                    ],
                },
                {
                    "order": 4,
                    "title": "Соціальна підтримка та інтеграційна допомога (MOPS)",
                    "why": "Отримання консультацій, психологічної допомоги та соціальних послуг через осередки MOPS.",
                    "when": None,
                    "procedureSymbols": ["MOPS-21"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
        "en": {
            "title": "First Steps for Citizens of Ukraine Under Temporary Protection",
            "forWhom": "Ukrainian citizens and their family members arriving in Kraków due to war.",
            "steps": [
                {
                    "order": 1,
                    "title": "Obtaining PESEL number with UKR status",
                    "why": "Confirmation of temporary protection, legal stay, public healthcare eligibility, and access to work and benefits.",
                    "when": "Promptly upon entry into Poland",
                    "procedureSymbols": ["SA-65"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Address registration (zameldowanie)",
                    "why": "Official proof of local residence simplifying kindergarten and school enrolment.",
                    "when": "No later than 30 days from arrival",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Registration at the Municipal Labour Office (GUP Kraków)",
                    "why": "Assistance with employment, traineeships, and free Polish language courses.",
                    "when": None,
                    "procedureSymbols": ["GUP-1", "GUP-2"],
                    "placeCategories": ["urzad"],
                    "external": [
                        {
                            "title": "Municipal Labour Office in Kraków (GUP)",
                            "url": "https://gupkrakow.praca.gov.pl",
                        }
                    ],
                },
                {
                    "order": 4,
                    "title": "Social welfare and integration assistance (MOPS)",
                    "why": "Social support services, counseling, and integration assistance provided by MOPS Kraków.",
                    "when": None,
                    "procedureSymbols": ["MOPS-21"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
    },
    {
        "id": "rodzina-z-dzieckiem",
        "sources": [
            "https://www.bip.krakow.pl/uslugi/SO-20",
            "https://www.bip.krakow.pl/uslugi/MOPS-45",
            "https://portaledukacyjny.krakow.pl",
        ],
        "pl": {
            "title": "Rodzina z dzieckiem: opieka, edukacja i wsparcie",
            "forWhom": "Rodzice i opiekunowie prawni z dziećmi do lat 18 zamieszkujący w Krakowie.",
            "steps": [
                {
                    "order": 1,
                    "title": "Wybór i zapis dziecka do żłobka, klubu dziecięcego lub przedszkola",
                    "why": "Zapewnienie opieki nad najmłodszymi dziećmi. Rekrutacja prowadzona jest przez scentralizowany miejski system elektroniczny.",
                    "when": "Zgodnie z harmonogramem miejskiej rekrutacji wiosną lub w miarę wolnych miejsc w ciągu roku",
                    "procedureSymbols": [],
                    "placeCategories": ["zlobek", "klub_dzieciecy", "przedszkole", "klub_rodzica"],
                    "external": [
                        {
                            "title": "Krakowski Portal Edukacyjny",
                            "url": "https://portaledukacyjny.krakow.pl",
                        }
                    ],
                },
                {
                    "order": 2,
                    "title": "Zapisanie dziecka do szkoły podstawowej lub ponadpodstawowej",
                    "why": "Realizacja ustawowego obowiązku szkolnego i nauki. Dzieci zamieszkałe w obwodzie danej szkoły przyjmowane są z urzędu.",
                    "when": "Przed rozpoczęciem roku szkolnego lub w dowolnym momencie w trakcie roku",
                    "procedureSymbols": [],
                    "placeCategories": ["szkola_podstawowa", "szkola_ponadpodstawowa"],
                    "external": [
                        {
                            "title": "Wydział Edukacji UMK — Rekrutacja",
                            "url": "https://portaledukacyjny.krakow.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Zasiłek rodzinny i dodatki do zasiłku rodzinnego",
                    "why": "Miejskie wsparcie finansowe dla rodzin o niższych dochodach na częściowe pokrycie wydatków na utrzymanie dziecka.",
                    "when": "Wnioski przyjmowane są na bieżący okres zasiłkowy",
                    "procedureSymbols": ["SO-20"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 4,
                    "title": "Stypendium szkolne o charakterze socjalnym",
                    "why": "Pomoc materialna dla uczniów znajdujących się w trudnej sytuacji materialnej na zakup podręczników i pomocy naukowych.",
                    "when": "Od 1 do 15 września danego roku szkolnego",
                    "procedureSymbols": ["MOPS-45"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
        "uk": {
            "title": "Сім'я з дитиною: опіка, навчання та допомога",
            "forWhom": "Батьки та опікуни з дітьми до 18 років, які проживають у Кракові.",
            "steps": [
                {
                    "order": 1,
                    "title": "Запис дитини до ясел, дитячого клубу або дитсадка",
                    "why": "Забезпечення догляду та розвитку малечі. Набір відбувається через міську електронну систему рекрутації.",
                    "when": "Згідно з графіком весняного набору або за наявності вільних місць упродовж року",
                    "procedureSymbols": [],
                    "placeCategories": ["zlobek", "klub_dzieciecy", "przedszkole", "klub_rodzica"],
                    "external": [
                        {
                            "title": "Краківський освітній портал",
                            "url": "https://portaledukacyjny.krakow.pl",
                        }
                    ],
                },
                {
                    "order": 2,
                    "title": "Запис дитини до початкової або середньої школи",
                    "why": "Реалізація обов'язку шкільної освіти. За місцем проживання школа закріплена за адресою і зобов'язана прийняти учня.",
                    "when": "Перед початком навчального року або в будь-який момент упродовж року",
                    "procedureSymbols": [],
                    "placeCategories": ["szkola_podstawowa", "szkola_ponadpodstawowa"],
                    "external": [
                        {
                            "title": "Департамент освіти Кракова",
                            "url": "https://portaledukacyjny.krakow.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Сімейна допомога та доплати до неї (Zasiłek rodzinny)",
                    "why": "Міська фінансова підтримка сімей з невисоким рівнем доходу для покриття витрат на дитину.",
                    "when": "Заяви подаються на відповідний виплатний період",
                    "procedureSymbols": ["SO-20"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 4,
                    "title": "Шкільна соціальна стипендія",
                    "why": "Матеріальна допомога учням у скрутному становищі на купівлю шкільного приладдя та підручників.",
                    "when": "З 1 по 15 вересня поточного навчального року",
                    "procedureSymbols": ["MOPS-45"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
        "en": {
            "title": "Family with Children: Childcare, Education, and Support",
            "forWhom": "Parents and legal guardians residing in Kraków with children under 18.",
            "steps": [
                {
                    "order": 1,
                    "title": "Enrolment in nurseries, kids clubs, or kindergartens",
                    "why": "Early childhood care and preschool education via Kraków's centralized electronic recruitment system.",
                    "when": "According to the spring admission calendar or upon available slots during the year",
                    "procedureSymbols": [],
                    "placeCategories": ["zlobek", "klub_dzieciecy", "przedszkole", "klub_rodzica"],
                    "external": [
                        {
                            "title": "Kraków Educational Portal",
                            "url": "https://portaledukacyjny.krakow.pl",
                        }
                    ],
                },
                {
                    "order": 2,
                    "title": "Enrolment in primary or secondary school",
                    "why": "Fulfilling statutory school obligation. District primary schools are guaranteed for children residing in the school's catchment area.",
                    "when": "Before the school year starts or anytime throughout the year",
                    "procedureSymbols": [],
                    "placeCategories": ["szkola_podstawowa", "szkola_ponadpodstawowa"],
                    "external": [
                        {
                            "title": "Education Department — City of Kraków",
                            "url": "https://portaledukacyjny.krakow.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Family allowance and supplements",
                    "why": "Municipal financial assistance for families with eligible income thresholds to support childcare costs.",
                    "when": "Applications accepted for the applicable benefit period",
                    "procedureSymbols": ["SO-20"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 4,
                    "title": "School social scholarship",
                    "why": "Financial assistance for students in need to cover educational supplies and school books.",
                    "when": "September 1 to September 15 of each school year",
                    "procedureSymbols": ["MOPS-45"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
    },
    {
        "id": "praca",
        "sources": [
            "https://www.bip.krakow.pl/uslugi/GUP-1",
            "https://www.bip.krakow.pl/uslugi/GUP-2",
            "https://www.bip.krakow.pl/uslugi/GUP-10",
            "https://gupkrakow.praca.gov.pl",
        ],
        "pl": {
            "title": "Poszukiwanie pracy i rozwój zawodowy w Krakowie",
            "forWhom": "Osoby poszukujące zatrudnienia, bezrobotne lub planujące zmianę i podniesienie kwalifikacji zawodowych.",
            "steps": [
                {
                    "order": 1,
                    "title": "Rejestracja ze statusem osoby poszukującej pracy",
                    "why": "Uzyskanie dostępu do bazy ofert pracy, pomocy doradcy zawodowego oraz udziału w wybranych programach aktywizacyjnych.",
                    "when": None,
                    "procedureSymbols": ["GUP-1"],
                    "placeCategories": ["urzad"],
                    "external": [
                        {
                            "title": "Grodzki Urząd Pracy w Krakowie",
                            "url": "https://gupkrakow.praca.gov.pl",
                        }
                    ],
                },
                {
                    "order": 2,
                    "title": "Rejestracja ze statusem osoby bezrobotnej",
                    "why": "Nabycie prawa do ubezpieczenia zdrowotnego, zasiłku dla bezrobotnych (przy spełnieniu warunków stażowych) oraz pełnego pakietu form wsparcia.",
                    "when": "W dowolnym momencie po ustaniu zatrudnienia",
                    "procedureSymbols": ["GUP-2"],
                    "placeCategories": ["urzad"],
                    "external": [
                        {
                            "title": "Grodzki Urząd Pracy w Krakowie",
                            "url": "https://gupkrakow.praca.gov.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Szkolenia i przekwalifikowanie zawodowe",
                    "why": "Możliwość sfinansowania przez urząd pracy kursów, szkoleń podnoszących kwalifikacje oraz uzyskania stypendium szkoleniowego.",
                    "when": "W trakcie trwania naborów wniosków na szkolenia",
                    "procedureSymbols": ["GUP-10"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
        "uk": {
            "title": "Пошук роботи та професійний розвиток у Кракові",
            "forWhom": "Особи, які шукають роботу, безробітні або планують підвищити свою кваліфікацію.",
            "steps": [
                {
                    "order": 1,
                    "title": "Реєстрація зі статусом шукача роботи",
                    "why": "Отримання доступу до вакансій, консультацій кар'єрного радника та спеціальних міських програм.",
                    "when": None,
                    "procedureSymbols": ["GUP-1"],
                    "placeCategories": ["urzad"],
                    "external": [
                        {
                            "title": "Міський центр зайнятості у Кракові",
                            "url": "https://gupkrakow.praca.gov.pl",
                        }
                    ],
                },
                {
                    "order": 2,
                    "title": "Реєстрація зі статусом безробітного",
                    "why": "Отримання медичного страхування, допомоги по безробіттю (за наявності страхового стажу) та повного пакету підтримки.",
                    "when": "У будь-який час після завершення роботи",
                    "procedureSymbols": ["GUP-2"],
                    "placeCategories": ["urzad"],
                    "external": [
                        {
                            "title": "Міський центр зайнятості у Кракові",
                            "url": "https://gupkrakow.praca.gov.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Курси та перекваліфікація (Szkolenia)",
                    "why": "Можливість безкоштовного проходження сертифікованих навчальних курсів коштом фонду праці та отримання стипендії на час навчання.",
                    "when": "Під час дії оголошених наборів на навчання",
                    "procedureSymbols": ["GUP-10"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
        "en": {
            "title": "Job Search and Career Development in Kraków",
            "forWhom": "Individuals seeking employment, unemployed residents, or professionals looking to upskill.",
            "steps": [
                {
                    "order": 1,
                    "title": "Registration as a jobseeker",
                    "why": "Access to local vacancies database, career advisory services, and activation events.",
                    "when": None,
                    "procedureSymbols": ["GUP-1"],
                    "placeCategories": ["urzad"],
                    "external": [
                        {
                            "title": "Municipal Labour Office in Kraków",
                            "url": "https://gupkrakow.praca.gov.pl",
                        }
                    ],
                },
                {
                    "order": 2,
                    "title": "Registration as unemployed",
                    "why": "Public health insurance coverage, unemployment benefits (subject to statutory eligibility), and vocational programs.",
                    "when": "Anytime following termination of previous employment",
                    "procedureSymbols": ["GUP-2"],
                    "placeCategories": ["urzad"],
                    "external": [
                        {
                            "title": "Municipal Labour Office in Kraków",
                            "url": "https://gupkrakow.praca.gov.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Professional trainings and reskilling",
                    "why": "Funding opportunities for certified courses, professional qualifications, and training stipends.",
                    "when": "During open recruitment windows for training programs",
                    "procedureSymbols": ["GUP-10"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
    },
    {
        "id": "samochod",
        "sources": [
            "https://www.bip.krakow.pl/uslugi/KM-2",
            "https://www.bip.krakow.pl/uslugi/KM-8",
            "https://www.bip.krakow.pl/uslugi/KM-14",
        ],
        "pl": {
            "title": "Samochód i pojazdy: rejestracja i formalności w Krakowie",
            "forWhom": "Właściciele pojazdów przeprowadzający się do Krakowa lub nabywający pojazd w kraju bądź z zagranicy.",
            "steps": [
                {
                    "order": 1,
                    "title": "Rejestracja pojazdu używanego zarejestrowanego w Polsce",
                    "why": "Przerejestrowanie nabytego pojazdu na dane nowego właściciela i przypisanie do krakowskiego urzędu.",
                    "when": "W terminie 30 dni od dnia nabycia pojazdu",
                    "procedureSymbols": ["KM-2"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Rejestracja pojazdu sprowadzonego z zagranicy",
                    "why": "Dopuszczenie do ruchu w Polsce pojazdu importowanego z innego kraju po opłaceniu akcyzy i badaniu technicznym.",
                    "when": "W terminie 30 dni od dnia sprowadzenia pojazdu z terytorium państwa członkowskiego UE",
                    "procedureSymbols": ["KM-14"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Zgłoszenie zmiany danych i adresu w dowodzie rejestracyjnym",
                    "why": "Aktualizacja miejsca zamieszkania właściciela w dokumentach zarejestrowanego już wcześniej pojazdu.",
                    "when": "W terminie 30 dni od zaistnienia zmiany",
                    "procedureSymbols": ["KM-8"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
        "uk": {
            "title": "Автомобіль і транспорт: реєстрація та формальності у Кракові",
            "forWhom": "Власники автомобілів, які переїжджають до Кракова або купують транспортний засіб у Польщі чи з-за кордону.",
            "steps": [
                {
                    "order": 1,
                    "title": "Реєстрація авто, раніше зареєстрованого в Польщі",
                    "why": "Переоформлення купленого або набутого транспортного засобу на нового власника у Кракові.",
                    "when": "Протягом 30 днів від дати придбання",
                    "procedureSymbols": ["KM-2"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Реєстрація ввезеного з-за кордону автомобіля",
                    "why": "Офіційний допуск до руху в Польщі авто, імпортованого з іншої країни після сплати акцизу та техогляду.",
                    "when": "Протягом 30 днів від дати ввезення авто з території ЄС",
                    "procedureSymbols": ["KM-14"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Внесення змін до техпаспорта при зміні адреси",
                    "why": "Оновлення адреси проживання власника у документах на автомобіль після переїзду.",
                    "when": "Протягом 30 днів від моменту зміни адреси",
                    "procedureSymbols": ["KM-8"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
        "en": {
            "title": "Vehicle Registration and Formalities in Kraków",
            "forWhom": "Vehicle owners relocating to Kraków or acquiring a vehicle in Poland or from abroad.",
            "steps": [
                {
                    "order": 1,
                    "title": "Registration of a used vehicle purchased in Poland",
                    "why": "Transfer of vehicle registration title to the new owner's details in Kraków.",
                    "when": "Within 30 days from acquiring the vehicle",
                    "procedureSymbols": ["KM-2"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Registration of a vehicle imported from abroad",
                    "why": "Official road registration in Poland following technical inspection and excise duty payment.",
                    "when": "Within 30 days from bringing the vehicle into Poland from the EU",
                    "procedureSymbols": ["KM-14"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 3,
                    "title": "Update of address in vehicle registration document",
                    "why": "Reflecting the owner's updated address of residence in vehicle records.",
                    "when": "Within 30 days of the change",
                    "procedureSymbols": ["KM-8"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
            ],
        },
    },
    {
        "id": "student",
        "sources": [
            "https://www.bip.krakow.pl/uslugi/SA-12",
            "https://ztp.krakow.pl",
            "https://biblioteka.krakow.pl",
        ],
        "pl": {
            "title": "Przewodnik dla studenta w Krakowie",
            "forWhom": "Studenci uczelni wyższych (UJ, AGH, PK, UEK, UR i in.) przybywający do Krakowa na studia.",
            "steps": [
                {
                    "order": 1,
                    "title": "Meldunek czasowy w akademiku lub wynajmowanym mieszkaniu",
                    "why": "Wypełnienie obowiązku meldunkowego dla osób studiujących w Krakowie (w tym studentów zagranicznych).",
                    "when": "W terminie 30 dni od przybycia (obywatele RP) lub najpóźniej w 4./30. dniu (cudzoziemcy)",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Studencki bilet okresowy KMK i Karta Krakowska",
                    "why": "Korzystanie z 50% ulgi ustawowej na przejazdy tramwajami i autobusami oraz zniżek miejskich dla studentów.",
                    "when": "Przed rozpoczęciem regularnego korzystania z komunikacji miejskiej",
                    "procedureSymbols": [],
                    "placeCategories": ["przystanek"],
                    "external": [
                        {
                            "title": "Zarząd Transportu Publicznego w Krakowie (Bilety)",
                            "url": "https://ztp.krakow.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Zapisanie się do Biblioteki Kraków i filii osiedlowych",
                    "why": "Darmowy dostęp do zbiorów naukowych, literatury, czytelni oraz przestrzeni do nauki w filiach w całym mieście.",
                    "when": None,
                    "procedureSymbols": [],
                    "placeCategories": ["biblioteka"],
                    "external": [
                        {
                            "title": "Biblioteka Kraków",
                            "url": "https://biblioteka.krakow.pl",
                        }
                    ],
                },
            ],
        },
        "uk": {
            "title": "Гід для студента у Кракові",
            "forWhom": "Студенти краківських університетів (UJ, AGH, PK, UEK тощо), які приїжджають на навчання.",
            "steps": [
                {
                    "order": 1,
                    "title": "Тимчасова реєстрація (zameldowanie) в гуртожитку або орендованій квартирі",
                    "why": "Виконання вимоги реєстрації місця проживання для студентів, зокрема іноземних.",
                    "when": "У межах 30 днів від заселення",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Студентський проїзний квиток KMK та Картка Краків'янина",
                    "why": "50% студентська пільга на проїзд трамваями й автобусами Кракова за наявності студентського квитка (legitymacja).",
                    "when": "Перед початком регулярних поїздок містом",
                    "procedureSymbols": [],
                    "placeCategories": ["przystanek"],
                    "external": [
                        {
                            "title": "Квитки та тарифи ZTP Kraków",
                            "url": "https://ztp.krakow.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Запис до мережі Бібліотеки Кракова",
                    "why": "Безкоштовний доступ до фондів книг, наукової літератури, читальних залів і коворкінг-зон біля дому.",
                    "when": None,
                    "procedureSymbols": [],
                    "placeCategories": ["biblioteka"],
                    "external": [
                        {
                            "title": "Biblioteka Kraków",
                            "url": "https://biblioteka.krakow.pl",
                        }
                    ],
                },
            ],
        },
        "en": {
            "title": "Student Guide to Kraków",
            "forWhom": "Higher education students (UJ, AGH, PK, UEK, etc.) moving to Kraków for their studies.",
            "steps": [
                {
                    "order": 1,
                    "title": "Temporary residence registration in dorm or rental apartment",
                    "why": "Statutory address registration for local and international students staying in Kraków.",
                    "when": "Within 30 days of arrival (or 4/30 days for foreign nationals)",
                    "procedureSymbols": ["SA-12"],
                    "placeCategories": ["urzad"],
                    "external": [],
                },
                {
                    "order": 2,
                    "title": "Student public transit pass (KMK) & City Card",
                    "why": "Accessing 50% statutory student fare discount on buses and trams using a valid student ID.",
                    "when": "Before starting daily commute in the city",
                    "procedureSymbols": [],
                    "placeCategories": ["przystanek"],
                    "external": [
                        {
                            "title": "Public Transport Authority Kraków (Tickets)",
                            "url": "https://ztp.krakow.pl",
                        }
                    ],
                },
                {
                    "order": 3,
                    "title": "Registration with Kraków Library branches",
                    "why": "Free access to literature, academic databases, quiet study rooms, and local neighborhood branches.",
                    "when": None,
                    "procedureSymbols": [],
                    "placeCategories": ["biblioteka"],
                    "external": [
                        {
                            "title": "Biblioteka Kraków",
                            "url": "https://biblioteka.krakow.pl",
                        }
                    ],
                },
            ],
        },
    },
]


def build_and_save():
    root_dir = Path(__file__).resolve().parents[3]
    content_dir = root_dir / "content" / "scenarios"
    app_data_dir = root_dir / "app" / "data" / "kb"

    content_dir.mkdir(parents=True, exist_ok=True)
    app_data_dir.mkdir(parents=True, exist_ok=True)

    locales = ["pl", "uk", "en"]
    bundles = {loc: [] for loc in locales}

    for item in SCENARIOS_DATA:
        scenario_id = item["id"]
        sources = item["sources"]

        # Save single master scenario file in content/scenarios
        scenario_file = content_dir / f"{scenario_id}.json"
        with open(scenario_file, "w", encoding="utf-8") as f:
            json.dump(item, f, ensure_ascii=False, indent=2)

        # Build locale-specific Scenario objects for app/data/kb/scenarios.<locale>.json
        for loc in locales:
            localized_data = item[loc]
            scenario_obj = {
                "id": scenario_id,
                "locale": loc,
                "title": localized_data["title"],
                "forWhom": localized_data["forWhom"],
                "steps": localized_data["steps"],
                "sources": sources,
            }
            bundles[loc].append(scenario_obj)

    for loc in locales:
        bundle_file = app_data_dir / f"scenarios.{loc}.json"
        with open(bundle_file, "w", encoding="utf-8") as f:
            json.dump(bundles[loc], f, ensure_ascii=False, indent=2)
        print(f"Wrote {len(bundles[loc])} scenarios to {bundle_file}")


if __name__ == "__main__":
    build_and_save()

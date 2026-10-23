# Możliwości rozwoju

Oswój Kraków działa jako kompletny prototyp na danych miasta z października 2026 r. Poniżej opisujemy, jak rozwinąć go w usługę miejską – od kroków na pierwsze tygodnie po skalowanie na inne miasta.

## 1. Wdrożenie w mieście (pierwsze 3 miesiące)

- **Pilotaż z Urzędem Miasta Krakowa.** Osadzenie asystenta i mapy w serwisach miejskich (np. strona dla nowych mieszkańców, Centrum Obsługi Mieszkańców, punkty dla cudzoziemców) jako widżet lub osobna podstrona.
- **Bezpośrednie linki do rezerwacji wizyt.** System umawiania wizyt UMK zmienił adresy podstron wydziałów. Po uzgodnieniu stabilnych linków karta procedury może prowadzić od razu do terminu w konkretnym wydziale.
- **Automatyczna aktualizacja danych.** Uruchamianie potoków według harmonogramu (np. co tydzień) z automatycznym sprawdzeniem jakości. Karty BIP mają wersje i daty publikacji, więc można aktualizować tylko zmienione karty.
- **Płatny plan modelu językowego** lub model udostępniony przez miasto. Aplikacja zmienia dostawcę jedną zmienną konfiguracji; koszt jednej odpowiedzi w płatnym planie to ułamek grosza.

## 2. Nowe dane i funkcje

- **Więcej warstw z Otwartych Danych:** przychodnie i apteki (we współpracy z NFZ), punkty nieodpłatnej pomocy prawnej, punkty selektywnej zbiórki odpadów, wypożyczalnie rowerów, obiekty sportowe i kultury.
- **Komunikacja w czasie rzeczywistym:** odjazdy z najbliższych przystanków (GTFS-Realtime ZTP) w panelu „15 minut”.
- **Więcej trybów „15 minut”:** rower, różne pory dnia, dostępność dla osób z niepełnosprawnościami (np. przystanki niskopodłogowe).
- **Personalizacja „Pierwszych kroków”:** zapamiętanie sytuacji (np. „rodzina z dzieckiem, obywatelstwo UA”) i lista zadań do odhaczania w przeglądarce, bez kont i bez danych na serwerze.
- **Kolejne języki:** rosyjski, białoruski, hindi, wietnamski – zgodnie ze statystyką obywatelstw cudzoziemców w Krakowie. Interfejs ma już trzy języki i dodanie kolejnego to plik tłumaczeń.
- **Wyszukiwanie semantyczne** jako uzupełnienie obecnego wyszukiwania pełnotekstowego – lepsze rozumienie pytań zadanych potocznym językiem.
- **Aplikacja instalowalna (PWA)** z dostępem offline do zapisanych kart usług.

## 3. Wartość dla planowania miasta

Warstwa „Indeks 15 minut – całe miasto” już teraz pokazuje, gdzie brakuje żłobków, przedszkoli, bibliotek czy zieleni w zasięgu spaceru. Rozwinięcie:

- **Narzędzie analityczne dla wydziałów miasta:** porównanie dzielnic, symulacja „co jeśli” (nowe przedszkole w danym miejscu – jak zmieni się indeks i ilu mieszkańców zyska dostęp).
- **Połączenie z danymi o liczbie mieszkańców** w siatce H3 – ile osób mieszka w obszarach z niskim indeksem.
- **Anonimowe statystyki pytań** (bez treści i danych osobowych): które sprawy sprawiają nowym mieszkańcom najwięcej trudności. To wskazówka, które karty BIP warto uprościć lub przetłumaczyć.

## 4. Model biznesowy i skalowanie

- **B2G – miasta i gminy.** Rozwiązanie opiera się na otwartych standardach (GTFS, GeoJSON, H3, OpenStreetMap) i może być przeniesione do każdego miasta, które publikuje karty usług i dane przestrzenne. Potoki danych są oddzielone od aplikacji, więc nowe miasto to głównie nowe źródła w potokach.
- **B2B – pracodawcy i uczelnie.** Firmy zatrudniające cudzoziemców (BPO, IT) i uczelnie mogą udostępniać asystenta pracownikom i studentom jako część pakietu relokacyjnego.
- **Portale nieruchomości.** Widżet „Indeks 15 minut” przy ogłoszeniu najmu lub sprzedaży mieszkania.
- **Koszty utrzymania** są niskie: hosting statyczny, brak bazy danych, model językowy płatny za użycie.

## 5. Kierunki techniczne

- Rozszerzenie ewaluacji asystenta o więcej pytań i automatyczne uruchamianie przy każdej zmianie bazy wiedzy.
- Dalsze przyspieszenie mapy na słabszych telefonach (lżejszy podkład, ładowanie warstw według widoku).
- Moduł uwag mieszkańców: zgłoszenie „ta informacja jest nieaktualna” z linkiem do karty BIP – sygnał dla wydziału odpowiedzialnego za kartę.

# Design-Plan: Redesign Web + App

Ziel: modern, ruhig, funktional. Gerätesteuerung mit einem Blick und einem Tipp; Admin-Bereich übersichtlich.
Web zuerst, danach übernimmt die App dieselbe Sprache (Tokens aus `packages/theme`).

## Stil
- **Schrift:** Inter (Web: `@fontsource-variable/inter`, App: `@expo-google-fonts/inter`). Zahlen mit `tabular-nums`.
- **Flächen:** heller, leicht kühler Hintergrund; Karten weiß mit weichem Schatten, kein harter Rahmen. Dark Mode: tiefes Blau-Grau, Karten durch Helligkeit abgesetzt.
- **Akzent:** Indigo/Blau (`accent`), eingeschaltete Geräte mit warmem Bernstein (`on`) als getönte Kartenfläche (`onSoft`) und farbigem Icon-Kreis, nicht nur Rahmen.
- **Ecken:** Karten 18 px, Buttons/Inputs 12 px, Chips pill.
- **Icons:** Lucide überall (Web `lucide-react`, App `lucide-react-native`), Zuordnung über `icons` in `packages/theme`.
- **Bewegung:** kurze Übergänge (150–200 ms) für Toggle, Hover, Dialoge; `prefers-reduced-motion` respektieren.

## Neue/geänderte Tokens (packages/theme, Entwickler A)
Farben je light/dark zusätzlich: `accentSoft` (getönter Akzent-Hintergrund), `onSoft` (getönte Fläche für "an"),
`okSoft`, `warnSoft`, `dangerSoft`, `overlay` (Dialog-Hintergrund). Radius: `sm 8, md 12, lg 18, pill 999`.
CSS-Namen wie bisher kebab-case: `--accent-soft`, `--on-soft`, `--ok-soft`, `--warn-soft`, `--danger-soft`, `--overlay`.
Zusätzlich `--shadow-lg` (Dialoge/Popover). Bestehende Namen bleiben erhalten.

## Web-Layout
- **Desktop (≥ 900 px):** linke Seitenleiste (Logo "Smart Home", Live-Status, Navigation: Geräte, Konto, Admin mit Unterpunkten; unten Design-Umschalter + Abmelden). Inhalt max. 1200 px.
- **Mobil (< 900 px):** schlanke Kopfzeile + untere Tab-Leiste (Geräte, Konto, Admin).
- **Login/Setup:** zentrierte Karte auf dezentem Verlaufshintergrund, Logo-Icon oben.
- **Geräte-Seite:** Kopf mit Begrüßung + Zusammenfassung ("3 Geräte an · 20,8 °C Wohnzimmer"), Raum-Chips zum Filtern ("Alle", Räume), darunter Raumgruppen als responsives Grid (`auto-fill, minmax(300px, 1fr)`).
- **Gerätekarte:** Icon-Kreis + Name + Typ/Raum, Schalter (Radix Switch) oben rechts; Slider (Radix Slider) mit Wert; Thermostat mit großem Sollwert und runden −/+; Modus als Segmented Control; Messwerte als kleine Kacheln mit Icon. Gesperrte Aktionen mit Schloss-Badge. Ganze Kopfzeile klickbar zum Schalten.
- **Bestätigungen:** Radix Dialog; ausstehende Anfragen als Banner oben.
- **Toasts:** `sonner` (ersetzt eigene Toasts, API `useToast` bleibt als dünne Hülle).
- **Admin:** Tabellen mit ruhigen Zeilen, Aktionen in Dropdown-Menü (Radix), Formulare in Dialogen, Status als Badges.
- **Lade- und Leerzustände:** Skeleton-Karten statt "Lädt…", freundliche Leerzustände mit Icon.

## Verständliche Werte (packages/core, Entwickler B)
Rohwerte werden übersetzt, in Web und App gleich: Modi (`off`→Aus, `auto`→Automatik, `heat`→Heizen, `cool`→Kühlen),
Zustände (`idle`→Inaktiv, `heat`/`heating`→Heizt), Farbtemperatur in Kelvin (`1 000 000 / mired`, gerundet auf 50 K) mit Beschriftung warm/kalt.

## App (Phase 2)
Gleiche Tokens, Inter, Lucide-Icons, gleiche Karten. Kopfzeile mit Live-Punkt und Zahnrad-Icon, Raum-Chips horizontal scrollbar,
Pull-to-Refresh, Haptik beim Schalten (`expo-haptics`), Skeletons, Dark Mode.

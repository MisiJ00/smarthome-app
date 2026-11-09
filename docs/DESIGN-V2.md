# Design-Plan v2: anpassbares Dashboard, Farbwelten, Widgets

Baut auf docs/DESIGN.md auf. Ziel: kräftiger, jünger, verspielter – und alles einstellbar.
Reihenfolge: Web zuerst, dann App (inkl. Android-Homescreen-Widget).

## 1. Farbwelten (packages/theme)
- **Presets** `palettes` (je `light` und `dark`): `klassik` (heutiges Indigo, ruhig), `neon` (Cyan → Magenta, sehr dunkler Violett-Grund),
  `sunset` (Orange → Pink), `lime` (Acid-Grün → Gelb), `ozean` (Türkis → Blau), `bubblegum` (Pink → Lila, pastell).
  Jedes Preset: `accent`, `accent2` (Verlaufsende), `on` (Farbe "eingeschaltet"), optional eigene `bg`/`surface`-Töne.
- **Eigene Farben:** Nutzer wählt `accent` und `accent2` frei (Web: `react-colorful`, App: `reanimated-color-picker`).
- **Ableitung** `deriveColors(palette, scheme, custom?) → Colors` (rein, getestet): Soft-Töne, `accentText` mit ausreichendem Kontrast
  (WCAG ≥ 4.5 für Text auf accent; sonst dunkel/hell umschalten), `gradient` = `[accent, accent2]`.
- **Modus:** `system | light | dark | black` (black = AMOLED: bg #000, surfaces leicht abgehoben).
- **Stil-Schalter:** `vivid` (Verläufe auf aktiven Kacheln, Glow-Schatten in der Akzentfarbe, Hintergrund mit weichem Farbverlauf/Blobs) oder `calm` (wie v1, flach).
- Typ `Appearance = { palette: PaletteId | 'custom', custom?: { accent: string; accent2: string }, mode, style: 'vivid' | 'calm' }`, Default `{ palette: 'neon', mode: 'system', style: 'vivid' }`.
- Web wendet die Farben zur Laufzeit als CSS-Variablen an (inkl. `--accent-2`, `--gradient`), App über einen Theme-Context.

## 2. Dashboard-Layout (packages/core)
- Typ `DashboardLayout = { version: 1, order: string[], sizes: Record<string, TileSize>, hidden: string[], widget: string[], grouping: 'rooms' | 'custom' }`,
  `TileSize = 's' | 'm' | 'l'`.
- Reine Funktionen mit Tests: `arrangeDevices(devices, layout)` → sichtbare Geräte in Reihenfolge (neue Geräte hinten, entfernte ignorieren),
  bei `grouping: 'rooms'` gruppiert nach Raum unter Beibehaltung der relativen Reihenfolge; `moveDevice(layout, id, toIndex)`, `setTileSize`,
  `toggleHidden`, `toggleWidget` (max. 4), `defaultTileSize(device)` (Licht/Steckdose/Schalter → `s`, Thermostat → `m`, sonst `m`), `parseLayout(json)` (robust gegen Müll → Default).
- `primaryAction(device)`: was ein Tipp auf eine kleine Kachel tut (Licht/Steckdose/Schalter: an/aus; Schloss: nichts → Details; Sensor: Details).
- Speicherung lokal pro Benutzer (Web `localStorage`, App `AsyncStorage`), Schlüssel `smarthome.layout.<userId>` bzw. `smarthome.appearance`.

## 3. Kacheln
- **S (klein, 1×1, quadratisch):** großes Icon, Name (2 Zeilen), Zustand ("An · 80 %", "21,5 °C"). Tipp = `primaryAction`.
  An = Verlauf/Glow (vivid) bzw. getönte Fläche (calm), kurze Feder-Animation. **Langes Drücken (450 ms) / Rechtsklick / Taste "Kontextmenü"** öffnet das Detail-Sheet.
- **M (2×1):** Icon, Name, Zustand, Hauptsteuerung inline (Schalter + Helligkeits-Balken bzw. Thermostat −/Soll/+). Langes Drücken → Details.
- **L (2×2 bzw. volle Breite):** die bisherige volle Gerätekarte.
- **Detail-Sheet:** Web Radix Dialog (auf Mobil-Breite als Bottom-Sheet), App Bottom-Sheet mit allen Steuerungen (bestehende DeviceCard-Inhalte wiederverwenden).
- Barrierefreiheit: Kachel ist ein Button mit aria-label "Flurlampe, an. Tippen zum Ausschalten, lange drücken für Optionen"; Details zusätzlich per kleinem "⋯"-Button erreichbar (Tastatur/Screenreader).
- **Grid:** Web `grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`, `grid-auto-flow: dense`; S = 1 Spalte, M = 2, L = 2 Spalten × 2 Zeilen (mobil volle Breite). App: 2 Spalten; S = halbe Breite, M/L = volle Breite.

## 4. Bearbeiten-Modus
- Button "Anpassen" im Kopf der Startseite. Im Modus: Kacheln wackeln leicht, Drag & Drop zum Sortieren (Web `@dnd-kit/sortable`, App `react-native-reorderable-list`),
  je Kachel Größenwahl S/M/L, Augen-Symbol zum Ausblenden, Stern "Im Widget" (App), Umschalter "Nach Räumen / Eigene Reihenfolge". "Fertig" speichert.
  Ausgeblendete Geräte erscheinen im Bearbeiten-Modus unten unter "Ausgeblendet".
- Tastatur (Web): dnd-kit KeyboardSensor.

## 5. Darstellung-Einstellungen
- Web: neue Seite "Darstellung" (Navigation), App: Abschnitt in Einstellungen bzw. eigener Bildschirm.
  Preset-Karten mit Live-Vorschau (Mini-Kacheln), "Eigene Farben" mit zwei Farbwählern, Modus (System/Hell/Dunkel/Schwarz), Stil (Kräftig/Ruhig). Änderungen wirken sofort.

## 6. Android-Widget (Phase 2)
- `react-native-android-widget` (Config-Plugin). Widget "Schnellschalter" (2×2 bis 4×2): bis zu 4 Geräte aus `layout.widget`, je Icon + Name + Zustand, Tipp schaltet.
  Klick-Handler im Headless-Task: Session aus SecureStore, JWT holen, Befehl senden, Widget neu zeichnen. Farben aus der gewählten Farbwelt.
  App aktualisiert das Widget bei Live-Events und beim Verlassen. Ohne Anmeldung: Hinweis "In der App anmelden".

## Bibliotheken
Web: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-colorful`, `motion` (Animationen; reduced-motion respektieren).
App: `react-native-reanimated`, `react-native-gesture-handler`, `react-native-reorderable-list`, `reanimated-color-picker`, `expo-linear-gradient`,
`@react-native-async-storage/async-storage`, `react-native-android-widget`.

> Update 9.11.: the widget selection now lives on the server (`/api/me/widgets`), not in `layout.widget`; see README.

> Update 9.11.: second widget "Einzelgerät" (one device per instance, chosen when adding, stored on the phone by widget id and device id, data from `GET /api/devices/{id}`); see README.

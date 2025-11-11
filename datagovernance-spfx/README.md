# Data Governance SPFx Webpart

## Übersicht

Diese SharePoint Framework (SPFx) Webpart-Lösung ist eine vollständige Konvertierung der ursprünglichen Data Governance Web-Anwendung für die sichere Integration in SharePoint Online (365).

## Änderungen und Anpassungen

### 1. Code-Konvertierung

- **Von**: Klassischer HTML/CSS/JavaScript-Aufbau
- **Nach**: SharePoint Framework (SPFx) mit React und TypeScript

#### Hauptänderungen:
- HTML-Struktur wurde in React-Komponenten umgewandelt
- Vanilla JavaScript wurde in TypeScript konvertiert
- Modulare Komponentenstruktur erstellt:
  - `DataGovernance.tsx` - Hauptkomponente
  - `TopBar/` - Navigationleiste
  - `Sidebar/` - Seitenleiste
  - `MainContent/` - Hauptinhaltsbereich

### 2. Sicherheit

✅ **Alle Inline-JavaScript und -CSS entfernt**
- Keine inline `onclick` oder `style` Attribute mehr
- Alle Event-Handler sind nun React-Event-Handler
- Alle Styles sind in SCSS-Module ausgelagert

✅ **Kein globales DOM-Zugriff**
- Alle DOM-Manipulationen sind auf den Webpart-Container beschränkt
- Verwendung von React-Refs statt `document.getElementById()`

### 3. Bibliotheken

Alle erforderlichen Bibliotheken werden über NPM verwaltet:

```json
{
  "@microsoft/sp-core-library": "1.18.2",
  "@microsoft/sp-webpart-base": "1.18.2",
  "react": "17.0.1",
  "react-dom": "17.0.1"
}
```

**Hinweis**: Chart.js muss noch als npm-Paket hinzugefügt werden, sobald die Dashboard-Komponente implementiert wird:
```bash
npm install chart.js react-chartjs-2
```

### 4. SharePoint-Kompatibilität

- ✅ Keine globalen DOM-Manipulationen außerhalb des Containers
- ✅ Verwendung von SharePoint-Framework APIs
- ✅ Kompatibel mit SharePoint Online, Teams und SharePoint 2019
- ✅ Theme-Varianten werden unterstützt

### 5. Konfigurierbarkeit

Die Webpart-Eigenschaften können über das Property Pane konfiguriert werden:

- **Description**: Beschreibung des Webparts
- **Enable Local Storage**: Aktiviert localStorage für Datenpersistenz
- **Enable SharePoint Lists**: (Zukünftig) Verwendet SharePoint-Listen statt localStorage

Property Pane-Konfiguration in `DataGovernanceWebPart.ts`:
```typescript
PropertyPaneTextField('description', {
  label: 'Description'
}),
PropertyPaneToggle('enableLocalStorage', {
  label: 'Use Local Storage',
  onText: 'Enabled',
  offText: 'Disabled'
})
```

### 6. Deployment

#### Voraussetzungen
- Node.js 16.x oder 18.x
- npm 7.x oder höher
- SharePoint Online Tenant (oder SharePoint 2019 on-premises)

#### Installation und Build

1. **Abhängigkeiten installieren**:
   ```bash
   cd datagovernance-spfx
   npm install
   ```

2. **Entwicklungsserver starten**:
   ```bash
   npm run serve
   ```
   Dies öffnet den SharePoint Workbench auf localhost:4321

3. **Production Build**:
   ```bash
   npm run ship
   ```
   Dies erstellt:
   - Optimierte Bundle-Dateien in `./dist/`
   - Deployable `.sppkg` Paket in `./sharepoint/solution/`

4. **Paket deployen**:
   - Navigieren Sie zum App-Katalog Ihrer SharePoint-Tenant
   - Laden Sie die `.sppkg` Datei hoch: `./sharepoint/solution/datagovernance-spfx.sppkg`
   - Vertrauen Sie der App, wenn Sie dazu aufgefordert werden
   - Fügen Sie das Webpart zu einer SharePoint-Seite hinzu

#### Build-Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `npm run build` | Entwicklungs-Build erstellen |
| `npm run clean` | Build-Artefakte löschen |
| `npm run serve` | Lokalen Entwicklungsserver starten |
| `npm run ship` | Production-Build und .sppkg erstellen |

### 7. Datenspeicherung

#### Aktuell
- Verwendet `localStorage` für Client-seitige Datenpersistenz (optional aktivierbar)
- Daten werden im Browser des Benutzers gespeichert

#### Zukünftige Erweiterung
Die Anwendung ist vorbereitet für SharePoint-Listen-Integration:
- Felder → SharePoint-Liste "Data Fields"
- Systeme → SharePoint-Liste "Systems"
- Glossar → SharePoint-Liste "Glossary Terms"
- Mappings → SharePoint-Liste "Field Mappings"

## Projektstruktur

```
datagovernance-spfx/
├── config/                          # SPFx Konfigurationsdateien
│   ├── config.json                  # Bundle-Konfiguration
│   ├── package-solution.json        # Lösungspaket-Konfiguration
│   ├── serve.json                   # Dev-Server-Konfiguration
│   └── write-manifests.json         # Manifest-Konfiguration
├── src/
│   └── webparts/
│       └── dataGovernance/
│           ├── components/          # React-Komponenten
│           │   ├── TopBar/         # Navigationsleiste
│           │   ├── Sidebar/        # Seitenmenü
│           │   ├── MainContent/    # Hauptbereich
│           │   ├── DataGovernance.tsx
│           │   ├── DataGovernance.module.scss
│           │   └── styles.scss     # Konvertierte Original-Styles
│           ├── context/            # React Context (State Management)
│           │   └── AppContext.ts
│           ├── types/              # TypeScript-Typdefinitionen
│           │   └── index.ts
│           ├── loc/                # Lokalisierung
│           │   ├── en-us.js
│           │   └── mystrings.d.ts
│           ├── DataGovernanceWebPart.ts
│           └── DataGovernanceWebPart.manifest.json
├── package.json
├── tsconfig.json
├── gulpfile.js
└── README.md
```

## Bekannte Einschränkungen

### Im Vergleich zum klassischen Webhosting:

1. **localStorage-Beschränkungen**
   - localStorage ist auf 5-10 MB begrenzt
   - Daten sind benutzerspezifisch pro Browser
   - **Empfehlung**: Migration zu SharePoint-Listen für produktive Nutzung

2. **Chart.js Integration**
   - Dashboard-Charts müssen noch vollständig implementiert werden
   - Wird über npm-Paket `chart.js` und `react-chartjs-2` integriert

3. **Komplexe Features noch nicht vollständig konvertiert**
   - Data Map (SVG-basierte Visualisierung)
   - Glossar-Versionierung
   - Mapping-Editor mit komplexen Formularen
   - Diese sind als Platzhalter vorhanden und müssen schrittweise implementiert werden

4. **Dialoge und Modals**
   - Native HTML `<dialog>` Elemente müssen durch SharePoint Fabric UI-Komponenten ersetzt werden
   - **Empfehlung**: Verwendung von `@fluentui/react` Dialog-Komponenten

5. **Performance**
   - Bei sehr großen Datenmengen (>10.000 Felder) kann die Client-seitige Filterung langsam werden
   - **Empfehlung**: Server-seitige Filterung über SharePoint REST API

## Nächste Schritte

### Kurzfristig (MVP):
- [ ] Chart.js npm-Paket installieren und Dashboard-Charts implementieren
- [ ] Fluent UI Dialoge für Formulare integrieren
- [ ] Grundlegende CRUD-Operationen für Felder implementieren
- [ ] Testen in SharePoint Online Workbench

### Mittelfristig:
- [ ] SharePoint-Listen-Integration für Datenpersistenz
- [ ] Admin-Bereich vollständig implementieren
- [ ] Glossar-Komponente mit Suchfunktion
- [ ] Mapping-Editor vollständig umsetzen

### Langfristig:
- [ ] Data Map mit SVG-Visualisierung in React
- [ ] Erweiterte Berechtigungsprüfungen
- [ ] Export-Funktionen (Excel, PDF)
- [ ] Multi-Language-Support
- [ ] Offline-Fähigkeit (Service Worker)

## Support und Dokumentation

### Hilfreiche Links:
- [SharePoint Framework Dokumentation](https://docs.microsoft.com/sharepoint/dev/spfx/sharepoint-framework-overview)
- [React Dokumentation](https://reactjs.org/docs/getting-started.html)
- [Fluent UI React](https://developer.microsoft.com/fluentui#/controls/web)
- [SPFx Yeoman Generator](https://github.com/SharePoint/generator-sharepoint)

### Entwickler-Hinweise:
- Verwenden Sie `npm run serve` für Live-Entwicklung
- Alle Änderungen werden hot-reloaded
- Browser-Console zeigt detaillierte Fehler
- SharePoint Workbench ermöglicht einfaches Testen

## Lizenz

Dieses Projekt ist proprietär und für die interne Verwendung bei LEONI bestimmt.

## Autoren

Konvertiert von der klassischen Web-App zu SPFx Webpart.
Ursprüngliche Anwendung: Data Governance Application

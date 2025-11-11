# Migration Guide - From Classic Web App to SPFx

## Übersicht

Dieser Leitfaden dokumentiert die wichtigsten Änderungen bei der Konvertierung der klassischen Data Governance Web-Anwendung zu einem SharePoint Framework (SPFx) Webpart.

## Architektur-Änderungen

### Vorher (Klassische Web-App)
```
index.html (Single Page)
├── <head>
│   └── <link rel="stylesheet" href="styles.css">
├── <body>
│   ├── Inline HTML mit allen Views
│   └── <script type="module" src="js/main.js">
└── js/
    ├── main.js (7000+ Zeilen)
    ├── state.js
    ├── storage.js
    ├── constants.js
    └── permissions.js
```

### Nachher (SPFx Webpart)
```
DataGovernanceWebPart.ts (Entry Point)
└── DataGovernance.tsx (React Root Component)
    ├── context/
    │   └── AppContext.ts (Global State)
    ├── types/
    │   └── index.ts (TypeScript Interfaces)
    ├── components/
    │   ├── TopBar/
    │   ├── Sidebar/
    │   └── MainContent/
    └── styles.scss (Modular Styles)
```

## Code-Transformationen

### 1. HTML zu React Komponenten

#### Vorher (HTML):
```html
<header class="topbar" role="banner">
  <div class="topbar-inner">
    <button id="sidebarToggle" onclick="toggleSidebar()">☰</button>
    <nav class="topnav">
      <button class="topnav-item" onclick="showDashboard()">Dashboard</button>
    </nav>
  </div>
</header>
```

#### Nachher (React):
```tsx
export const TopBar: React.FC<ITopBarProps> = ({ onViewChange, onToggleSidebar }) => {
  return (
    <header className="topbar" role="banner">
      <div className="topbar-inner">
        <button onClick={onToggleSidebar}>☰</button>
        <nav className="topnav">
          <button onClick={() => onViewChange('dashboard')}>Dashboard</button>
        </nav>
      </div>
    </header>
  );
};
```

### 2. JavaScript zu TypeScript

#### Vorher (JavaScript):
```javascript
function findFieldById(id) {
  return state.fields.find(f => f.id === id);
}
```

#### Nachher (TypeScript):
```typescript
export function findFieldById(id: string): IField | undefined {
  return getAllFields().find(f => f.id === id);
}

// Mit TypeScript Interface
export interface IField {
  id: string;
  name: string;
  system: string;
  // ... weitere Properties
}
```

### 3. Event Handling

#### Vorher (Vanilla JS):
```javascript
document.getElementById('btnGlobalNew').addEventListener('click', () => {
  openFieldDialog();
});
```

#### Nachher (React):
```tsx
<button onClick={handleNewField}>New</button>
```

### 4. State Management

#### Vorher (Global State):
```javascript
// state.js
export const state = {
  fields: [],
  systems: [],
  // ...
};

// Direkter Zugriff überall
state.fields.push(newField);
```

#### Nachher (React Context):
```tsx
// AppContext.ts
export const AppContext = React.createContext<IAppState>({
  fields: [],
  systems: [],
  // ...
});

// Verwendung in Komponenten
const { fields, systems } = useAppContext();
```

### 5. DOM-Manipulation

#### Vorher (Direkter DOM-Zugriff):
```javascript
document.getElementById('fieldsBody').innerHTML = '';
fields.forEach(field => {
  const row = document.createElement('tr');
  row.innerHTML = `<td>${field.name}</td>...`;
  document.getElementById('fieldsBody').appendChild(row);
});
```

#### Nachher (React Rendering):
```tsx
<tbody>
  {fields.map(field => (
    <tr key={field.id}>
      <td>{field.name}</td>
      {/* ... */}
    </tr>
  ))}
</tbody>
```

### 6. Styling

#### Vorher (Globales CSS):
```css
/* styles.css */
.topbar {
  background: linear-gradient(...);
}
```

#### Nachher (Module SCSS):
```scss
// DataGovernance.module.scss
.dataGovernance {
  // Alle Styles sind nun im Webpart-Scope
  @import './styles.scss';
}
```

### 7. LocalStorage Zugriff

#### Vorher (Direkter Zugriff):
```javascript
localStorage.setItem('gdf_fields_v2', JSON.stringify(fields));
```

#### Nachher (Kontrollierter Zugriff):
```typescript
private loadFromLocalStorage = (): void => {
  if (this.props.enableLocalStorage) {
    const fields = localStorage.getItem('gdf_fields_v2');
    if (fields) {
      this.setState({ fields: JSON.parse(fields) });
    }
  }
}
```

## Sicherheits-Verbesserungen

### 1. Content Security Policy (CSP)

**Entfernt:**
- ❌ Inline JavaScript (`onclick="..."`)
- ❌ Inline Styles (`style="..."`)
- ❌ `eval()` oder `Function()` Konstruktoren

**Implementiert:**
- ✅ Alle Event-Handler als React-Events
- ✅ Alle Styles in externen SCSS-Dateien
- ✅ Strikte TypeScript-Typisierung

### 2. XSS-Schutz

**Vorher:**
```javascript
element.innerHTML = userInput; // Potentielles XSS-Risiko
```

**Nachher:**
```tsx
<div>{escape(userInput)}</div> // Automatisches Escaping durch React
```

### 3. Isolation

- Webpart läuft in isoliertem Container
- Kein Zugriff auf globales `window` Objekt außerhalb des Webparts
- Keine Konflikte mit anderen Webparts auf der Seite

## Property Pane Konfiguration

### Neue Konfigurationsmöglichkeiten

```typescript
protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
  return {
    pages: [
      {
        groups: [
          {
            groupFields: [
              PropertyPaneTextField('description', {
                label: 'Description'
              }),
              PropertyPaneToggle('enableLocalStorage', {
                label: 'Use Local Storage'
              })
            ]
          }
        ]
      }
    ]
  };
}
```

Diese Eigenschaften können von SharePoint-Administratoren konfiguriert werden, ohne Code zu ändern.

## Build und Deployment Prozess

### Vorher (Klassisch):
1. Dateien auf Webserver hochladen
2. Fertig

### Nachher (SPFx):
1. `npm install` - Abhängigkeiten installieren
2. `npm run build` - TypeScript kompilieren
3. `gulp bundle --ship` - Production Bundle erstellen
4. `gulp package-solution --ship` - .sppkg Paket erstellen
5. .sppkg zum App-Katalog hochladen
6. Webpart auf SharePoint-Seite einfügen

## Datenmigration

### LocalStorage Keys bleiben kompatibel:
```typescript
// Gleiche Keys wie in der klassischen App
const STORAGE_KEY_FIELDS = 'gdf_fields_v2';
const STORAGE_KEY_GLOSSARY = 'gdf_glossary_v1';
const STORAGE_KEY_SYSTEMS = 'gdf_systems_v1';
```

**Vorteil:** Bestehende Daten können übernommen werden, wenn localStorage aktiviert ist.

## Testing-Strategie

### Entwicklung:
```bash
gulp serve
```
- Öffnet SharePoint Workbench
- Live-Reload bei Code-Änderungen
- Debugging mit Browser DevTools

### Testing:
1. Lokaler Workbench: `https://localhost:4321/temp/workbench.html`
2. SharePoint Workbench: `https://tenant.sharepoint.com/_layouts/workbench.aspx`
3. Production: Auf echter SharePoint-Seite

## Performance-Optimierungen

### Bundle Splitting:
SPFx erstellt automatisch optimierte Bundles:
- Vendor-Bundle (React, etc.)
- Webpart-Bundle (eigener Code)
- Lazy-Loading für große Komponenten möglich

### Code Splitting Beispiel:
```typescript
// Lazy load komplexe Komponenten
const DataMapComponent = React.lazy(() => import('./DataMap/DataMap'));

// Verwendung mit Suspense
<React.Suspense fallback={<div>Loading...</div>}>
  <DataMapComponent />
</React.Suspense>
```

## Bekannte Herausforderungen und Lösungen

### 1. Chart.js Integration

**Problem:** Chart.js benötigt Canvas-Element und direkten DOM-Zugriff

**Lösung:** Verwende `react-chartjs-2` Wrapper
```bash
npm install chart.js react-chartjs-2
```

```tsx
import { Line, Bar } from 'react-chartjs-2';

<Bar data={chartData} options={chartOptions} />
```

### 2. Dialoge

**Problem:** Native `<dialog>` Element ist nicht SharePoint-kompatibel

**Lösung:** Verwende Fluent UI React Dialoge
```tsx
import { Dialog } from '@fluentui/react';

<Dialog hidden={!isDialogOpen} onDismiss={closeDialog}>
  {/* Dialog Content */}
</Dialog>
```

### 3. SVG Data Map

**Problem:** Komplexe SVG-Manipulation und Panning/Zooming

**Lösung:** React-basierte SVG-Bibliothek oder D3.js mit React-Wrapper
```bash
npm install react-svg-pan-zoom
```

### 4. File Export

**Problem:** Kein direkter Dateisystem-Zugriff

**Lösung:** Blob-basierter Download
```typescript
const blob = new Blob([csvContent], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'export.csv';
link.click();
```

## Rollback-Plan

Falls Probleme auftreten:
1. Klassische Web-App bleibt als Backup verfügbar
2. .sppkg kann jederzeit aus App-Katalog entfernt werden
3. Keine Datenmigration erforderlich (localStorage bleibt erhalten)

## Checkliste für Deployment

- [ ] npm install durchgeführt
- [ ] `npm run build` erfolgreich
- [ ] Keine TypeScript Fehler
- [ ] `npm run ship` erstellt .sppkg
- [ ] .sppkg im App-Katalog hochgeladen
- [ ] App vertraut und deployed
- [ ] Webpart auf Test-Seite getestet
- [ ] Funktionalität validiert
- [ ] Performance akzeptabel
- [ ] Dokumentation aktualisiert

## Weiterführende Ressourcen

- [SPFx Tutorial](https://docs.microsoft.com/sharepoint/dev/spfx/web-parts/get-started/build-a-hello-world-web-part)
- [React Best Practices](https://reactjs.org/docs/thinking-in-react.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Fluent UI Components](https://developer.microsoft.com/fluentui)

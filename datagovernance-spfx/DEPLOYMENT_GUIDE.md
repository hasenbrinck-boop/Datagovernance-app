# Deployment Guide - Data Governance SPFx Webpart

## Voraussetzungen

### Software-Anforderungen
- **Node.js**: Version 18.17.1 (erforderlich für SPFx 1.18.2)
- **npm**: Version 8.x oder höher
- **Git**: Für Versionskontrolle
- **SharePoint Online**: Tenant mit App-Katalog oder SharePoint 2019 on-premises

### Berechtigungen
- **SharePoint Admin**: Zugriff auf App-Katalog erforderlich
- **Site Collection Admin**: Zum Hinzufügen des Webparts zu Seiten

## Schritt-für-Schritt Anleitung

### Phase 1: Entwicklungsumgebung einrichten

#### 1.1 Node.js Installation

**Windows:**
```bash
# Node Version Manager für Windows installieren
# Download von: https://github.com/coreybutler/nvm-windows/releases

# Nach Installation:
nvm install 18.17.1
nvm use 18.17.1
node --version  # Sollte v18.17.1 zeigen
```

**macOS/Linux:**
```bash
# NVM installieren
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Terminal neu starten, dann:
nvm install 18.17.1
nvm use 18.17.1
node --version  # Sollte v18.17.1 zeigen
```

#### 1.2 Projekt klonen und Abhängigkeiten installieren

```bash
# Repository klonen
git clone https://github.com/hasenbrinck-boop/Datagovernance-app.git
cd Datagovernance-app/datagovernance-spfx

# Abhängigkeiten installieren
npm install --legacy-peer-deps
```

**Hinweis:** Das Flag `--legacy-peer-deps` wird benötigt wegen einiger Peer-Dependency-Konflikte in SPFx 1.18.

### Phase 2: Lokale Entwicklung und Testing

#### 2.1 SharePoint Workbench starten

```bash
# Entwicklungsserver starten
npm run serve
```

Dies startet:
- Lokalen HTTPS-Server auf `https://localhost:4321`
- Öffnet automatisch die lokale Workbench
- Live-Reload bei Code-Änderungen

#### 2.2 Testen im lokalen Workbench

1. Browser öffnet automatisch `https://localhost:4321/temp/workbench.html`
2. Zertifikat-Warnung akzeptieren (nur bei localhost)
3. Webpart zum Canvas hinzufügen:
   - Klicken Sie auf "+" Symbol
   - Suchen Sie nach "Data Governance"
   - Webpart einfügen

#### 2.3 Testen im SharePoint Online Workbench

```bash
# In der config/serve.json die initialPage anpassen:
"initialPage": "https://ihr-tenant.sharepoint.com/_layouts/workbench.aspx"

# Dann Server starten:
npm run serve
```

Dies öffnet den SharePoint Workbench mit Zugriff auf echte SharePoint-Daten.

### Phase 3: Production Build erstellen

#### 3.1 Projekt bauen

```bash
# Clean build
npm run clean

# Production build erstellen
npm run ship
```

Dies führt aus:
1. `gulp clean` - Löscht alte Build-Artefakte
2. `gulp bundle --ship` - Erstellt optimierte Bundles
3. `gulp package-solution --ship` - Erstellt .sppkg Paket

**Erfolgreiche Build-Ausgabe:**
```
Build target: SHIP
[... Build-Schritte ...]
Created package at: /sharepoint/solution/datagovernance-spfx.sppkg
```

#### 3.2 Build-Artefakte prüfen

Nach erfolgreichem Build sollten folgende Dateien existieren:

```
datagovernance-spfx/
├── dist/                           # Optimierte JavaScript-Bundles
│   └── data-governance.bundle.js
├── lib/                            # Kompilierter TypeScript-Code
│   └── webparts/
├── sharepoint/
│   └── solution/
│       └── datagovernance-spfx.sppkg  # Deployment-Paket
└── temp/                           # Temporäre Build-Dateien
```

**Paketgröße prüfen:**
```bash
ls -lh sharepoint/solution/*.sppkg
# Sollte ~1-3 MB sein
```

### Phase 4: Deployment zu SharePoint

#### 4.1 Zugriff auf App-Katalog

**SharePoint Online:**
1. Öffnen Sie SharePoint Admin Center: `https://ihr-tenant-admin.sharepoint.com`
2. Navigieren Sie zu: **More features** > **Apps** > **Open**
3. Klicken Sie auf **App Catalog**

**Wenn kein App-Katalog existiert:**
1. Klicken Sie **Create a new app catalog site**
2. Folgen Sie dem Wizard
3. Warten Sie 10-15 Minuten bis der Katalog bereit ist

#### 4.2 .sppkg Paket hochladen

1. Im App-Katalog: **Apps for SharePoint** auswählen
2. Klicken Sie **Upload** oder ziehen Sie die .sppkg Datei
3. Datei auswählen: `datagovernance-spfx/sharepoint/solution/datagovernance-spfx.sppkg`

#### 4.3 Deployment-Dialog

Ein Dialog erscheint mit folgenden Optionen:

**Wichtige Einstellungen:**
- ✅ **Make this solution available to all sites in the organization**
  - Aktivieren für organisationsweites Deployment
  
- ✅ **This app has the potential to access external data**
  - Wird möglicherweise angezeigt, akzeptieren

- **Deploy to:** Wählen Sie "Deploy"

**Beispiel-Dialog:**
```
Do you trust datagovernance-spfx.sppkg?

Name: Data Governance Application
Version: 1.0.0.0
Developer: LEONI

☑ Make this solution available to all sites
☐ Enable app in Teams (optional)

[Deploy] [Cancel]
```

Klicken Sie **Deploy**.

#### 4.4 Deployment-Status prüfen

1. Das Paket sollte in der Liste erscheinen mit Status "Deployed"
2. Überprüfen Sie:
   - **Name:** Data Governance Application
   - **Status:** Deployed
   - **App Version:** 1.0.0.0
   - **Enabled:** Yes

### Phase 5: Webpart zu SharePoint-Seite hinzufügen

#### 5.1 Neue Seite erstellen

1. Navigieren Sie zu Ihrer SharePoint-Site
2. Klicken Sie **+ New** > **Page**
3. Wählen Sie ein Template (z.B. "Blank")
4. Geben Sie einen Titel ein: "Data Governance"

#### 5.2 Webpart hinzufügen

1. Klicken Sie auf **+** Symbol im Canvas
2. Im Webpart-Picker:
   - Suchen Sie nach "Data Governance" oder
   - Schauen Sie unter **Advanced** Kategorie
3. Klicken Sie auf das Webpart-Icon
4. Webpart wird eingefügt

#### 5.3 Webpart konfigurieren

1. Klicken Sie auf **Edit** (Stift-Icon) am Webpart
2. Klicken Sie auf **Configure** (Zahnrad-Icon)
3. Property Pane öffnet sich rechts:

**Verfügbare Einstellungen:**
- **Description**: Webpart-Beschreibung
- **Use Local Storage**: Toggle für localStorage-Nutzung
- **Use SharePoint Lists**: Toggle für SharePoint-Listen (zukünftig)

4. Konfigurieren Sie nach Bedarf
5. Änderungen werden sofort angezeigt

#### 5.4 Seite veröffentlichen

1. Klicken Sie **Publish** oben rechts
2. Optional: Fügen Sie Kommentare hinzu
3. Klicken Sie **Publish**

Die Seite ist nun für alle Benutzer mit Zugriff verfügbar.

### Phase 6: Berechtigungen und Zugriff

#### 6.1 Site-Berechtigungen

Das Webpart nutzt die Standard-SharePoint-Berechtigungen:
- **Read**: Benutzer können Daten sehen
- **Edit**: Benutzer können Daten bearbeiten (falls implementiert)
- **Full Control**: Admins können alles verwalten

#### 6.2 App-Berechtigungen

Aktuell benötigt das Webpart keine speziellen App-Berechtigungen, da es localStorage nutzt.

**Zukünftig (SharePoint-Listen Integration):**
- Das Webpart wird Listen-Lese/Schreibrechte benötigen
- Diese werden automatisch beim Hinzufügen zur Seite angefragt

### Phase 7: Wartung und Updates

#### 7.1 Neue Version deployen

Wenn Sie Updates haben:

1. **Versionsnummer erhöhen** in `package-solution.json`:
   ```json
   "version": "1.0.1.0"
   ```

2. **Neu bauen**:
   ```bash
   npm run clean
   npm run ship
   ```

3. **Im App-Katalog**:
   - Laden Sie die neue .sppkg hoch
   - Wählen Sie **Replace** statt neue App
   - Bestätigen Sie das Update

4. **Auf Sites aktualisieren**:
   - Updates werden automatisch übernommen
   - Oder: Site Contents > Data Governance App > **Get updates**

#### 7.2 Webpart entfernen

**Von einer Seite:**
1. Seite bearbeiten
2. Webpart auswählen
3. Klicken Sie auf **Delete** (Mülleimer-Icon)
4. Seite speichern

**Aus App-Katalog:**
1. App-Katalog öffnen
2. App auswählen
3. **Delete** klicken
4. Bestätigen

**Wichtig:** Entfernen aus dem App-Katalog entfernt die App von ALLEN Sites!

### Phase 8: Fehlerbehebung

#### Problem: "Cannot connect to localhost"

**Lösung:**
```bash
# Zertifikat neu generieren
npm run serve -- --nobrowser

# Bei Aufforderung Zertifikat installieren
# Dann Browser manuell öffnen: https://localhost:4321
```

#### Problem: "Node version not supported"

**Lösung:**
```bash
# Richtige Node-Version verwenden
nvm use 18.17.1

# Oder global setzen
nvm alias default 18.17.1
```

#### Problem: "Build failed with TypeScript errors"

**Lösung:**
```bash
# Cache löschen
npm run clean
rm -rf node_modules package-lock.json

# Neu installieren und bauen
npm install --legacy-peer-deps
npm run build
```

#### Problem: "Package deployment failed"

**Lösung:**
1. Prüfen Sie SharePoint Admin-Berechtigungen
2. Prüfen Sie ob App-Katalog existiert
3. Versuchen Sie erneutes Hochladen nach 5 Minuten
4. Prüfen Sie Browser Console auf Fehler

#### Problem: "Webpart shows error on page"

**Lösung:**
1. Öffnen Sie Browser DevTools (F12)
2. Schauen Sie in Console-Tab
3. Häufige Ursachen:
   - localStorage blockiert (Inkognito-Modus)
   - Fehlende Daten
   - JavaScript-Fehler

**Debug-Modus aktivieren:**
```
# URL-Parameter hinzufügen:
?debugManifestsFile=https://localhost:4321/temp/manifests.js
```

### Alternative: Docker-basiertes Deployment

Wenn Sie nicht die richtige Node-Version lokal haben:

```bash
# Dockerfile nutzen
cd datagovernance-spfx
docker build -t spfx-builder .
docker run --rm -v $(pwd):/workspace spfx-builder

# .sppkg ist nun in sharepoint/solution/
```

### Alternative: GitHub Actions

Das Projekt enthält einen GitHub Actions Workflow:

1. **Pushen Sie Code** zu GitHub
2. **Workflow** startet automatisch bei Push zu `main` oder `develop`
3. **Artifact** wird erstellt mit .sppkg
4. **Herunterladen** von GitHub Actions Artifacts
5. **Deployen** wie in Phase 4 beschrieben

## Checkliste für Production Deployment

- [ ] Node.js 18.17.1 installiert
- [ ] Abhängigkeiten installiert (`npm install`)
- [ ] Lokaler Test durchgeführt (`npm run serve`)
- [ ] Production Build erfolgreich (`npm run ship`)
- [ ] .sppkg Datei existiert in `sharepoint/solution/`
- [ ] App-Katalog-Zugriff vorhanden
- [ ] .sppkg hochgeladen und deployed
- [ ] Test auf SharePoint-Seite durchgeführt
- [ ] Berechtigungen geprüft
- [ ] Dokumentation an Team verteilt

## Support und Hilfe

### Logs prüfen
- **Build-Logs**: `datagovernance-spfx/temp/build.log`
- **Server-Logs**: Console-Ausgabe von `npm run serve`
- **Browser-Logs**: F12 DevTools > Console

### Hilfreiche Commands

```bash
# Build-Cache löschen
npm run clean

# Entwicklungsserver ohne Browser
npm run serve -- --nobrowser

# Ausführliches Build-Logging
gulp bundle --verbose

# TypeScript-Prüfung ohne Build
npx tsc --noEmit

# Package-Info anzeigen
npm run package-info
```

### Dokumentation

- [SPFx Docs](https://learn.microsoft.com/sharepoint/dev/spfx/)
- [Troubleshooting Guide](https://learn.microsoft.com/sharepoint/dev/spfx/toolchain/troubleshoot)
- [Project README](./README.md)
- [Migration Guide](./MIGRATION_GUIDE.md)

## Produktive Nutzung - Best Practices

1. **Backup**: Sichern Sie localStorage-Daten vor Updates
2. **Testing**: Testen Sie auf Test-Site vor Production
3. **Versionierung**: Verwenden Sie semantische Versionierung
4. **Monitoring**: Überwachen Sie Browser-Console auf Fehler
5. **Updates**: Planen Sie regelmäßige Updates ein

## Nächste Schritte nach Deployment

1. **Benutzer-Schulung**: Einführung für End-User
2. **SharePoint-Listen**: Migration von localStorage zu Listen
3. **Berechtigungen**: Feinabstimmung der Zugriffsrechte
4. **Monitoring**: Nutzungs-Analytics einrichten
5. **Feedback**: User-Feedback sammeln und einarbeiten

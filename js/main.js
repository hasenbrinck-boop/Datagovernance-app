import { state } from './state.js';
import { ICON_EDIT, ICON_TRASH, GLOSSARY_TYPES } from './constants.js';
import {
  saveLeSystems,
  loadLeSystems,
  saveSystems,
  loadSystems,
  saveColumns,
  loadColumns,
  saveFields,
  loadFields,
  savePositions,
  loadPositions,
  saveFilters,
  loadFilters,
  saveGlossary,
  loadGlossary,
} from './storage.js';

console.log('[main.js] Modul geladen');

const dataDomains = state.dataDomains;
const systems = state.systems;
const dataObjects = state.dataObjects;
let fields = state.fields;
const fieldColumns = state.fieldColumns;
const legalEntities = state.legalEntities;
const leSystemMap = state.leSystemMap;
const glossaryTerms = state.glossaryTerms;

let currentSystem = state.currentSystem;
let editDataObjectIndex = state.editDataObjectIndex;
let editFieldIndex = state.editFieldIndex;
let editSystemIndex = state.editSystemIndex;
let editFoundationIndex = state.editFoundationIndex;
let editColumnIndex = state.editColumnIndex;
let editDomainIndex = state.editDomainIndex;
let editLegalIndex = state.editLegalIndex;
let editGlossaryIndex = state.editGlossaryIndex;
let glossaryTypeFilter = state.glossaryTypeFilter;
const nodeCollapsed = state.nodeCollapsed;
const mapTransformState = state.mapTransformState;
let mapFilters = state.mapFilters;
let mapPositions = state.mapPositions;
let selectedFieldRef = state.selectedFieldRef;
let editingLeIndexForSystems = state.editingLeIndexForSystems;
let globalSort = state.globalSort;
let showGlobalFilters = state.showGlobalFilters;
let showLocalFilters = state.showLocalFilters;
let isPanning = state.isPanning;
let panStart = state.panStart;

// === Data Object Dialog / Form (können initial null sein, Guards sind unten eingebaut)
const dataObjectDialog = document.getElementById('dataObjectDialog');
const dataObjectForm = document.getElementById('dataObjectForm');

// Renderfunktion für Data Objects Tabelle
function renderDataObjects() {
  const table = document.getElementById('dataObjectsTable');
  if (!table) return;

  table.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Data Domain</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${dataObjects
        .map(
          (obj, i) => `
        <tr>
          <td>${obj.id}</td>
          <td>${obj.name}</td>
          <td>${obj.domain}</td>
          <td class="table-actions">
            <button class="dbo-edit" data-index="${i}" title="Edit">
              <svg viewBox="0 0 20 20"><path fill="currentColor" d="M14.69 2.86a1.5 1.5 0 0 1 2.12 2.12L7.62 14.17l-3.03.9.9-3.03L14.69 2.86z"/></svg>
            </button>
            <button class="dbo-delete" data-index="${i}" title="Delete">
              <svg viewBox="0 0 20 20"><path fill="currentColor" d="M6 6h8v10H6V6zm9-2H5v2h10V4z"/></svg>
            </button>
          </td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  `;

  // Events für Stift/Mülleimer
  table.querySelectorAll('.dbo-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      openDataObjectDialog(i);
    });
  });
  table.querySelectorAll('.dbo-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      deleteDataObject(i);
    });
  });
}

/* ===== Data Object: Dialog öffnen/speichern ===== */
function openDataObjectDialog(index = null) {
  if (!dataObjectDialog || !dataObjectForm) {
    showErrorBanner(
      'Data Object dialog not found in DOM. Bitte das <dialog id="dataObjectDialog"> in index.html einfügen.'
    );
    return;
  }

  editDataObjectIndex = index;
  state.editDataObjectIndex = editDataObjectIndex;
  dataObjectForm.reset();

  // Data Domain-Options dynamisch aus aktiven Domains befüllen
  const domainSelect = dataObjectForm.elements.domain;
  if (domainSelect) {
    const options = getDomainNames()
      .map((n) => `<option value="${n}">${n}</option>`)
      .join('');
    domainSelect.innerHTML =
      options || `<option value="">(no active domains)</option>`;
  }

  if (index !== null) {
    const obj = dataObjects[index];
    dataObjectForm.elements.id.value = obj.id;
    dataObjectForm.elements.name.value = obj.name;
    dataObjectForm.elements.domain.value = obj.domain || '';
  } else {
    const nextId =
      Math.max(0, ...dataObjects.map((o) => Number(o.id) || 0)) + 1;
    dataObjectForm.elements.id.value = nextId;
  }

  openDialog(dataObjectDialog);
}

dataObjectForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(dataObjectForm);
  const rec = {
    id: Number(fd.get('id')),
    name: String(fd.get('name') || '').trim(),
    domain: String(fd.get('domain') || '').trim(),
  };
  if (!rec.name) {
    alert('Name is required.');
    return;
  }
  if (!rec.domain) {
    alert('Please pick a Data Domain.');
    return;
  }

  if (editDataObjectIndex !== null) {
    dataObjects[editDataObjectIndex] = rec;
  } else {
    dataObjects.push(rec);
  }
  refreshFoundationSelect(); // hält das Foundation-Select synchron
  renderFieldsTable(); // aktualisiert Felderliste
  renderDataObjects(); // aktualisiert DO-Tabelle
  closeDialog(dataObjectDialog);
});

/* Alte CRUD-Funktionen, jetzt auf Dialog geführt */
function addDataObject() {
  openDataObjectDialog(null);
}
window.addDataObject = addDataObject; // optional global
function editDataObject(i) {
  openDataObjectDialog(i);
}
function deleteDataObject(i) {
  const obj = dataObjects[i];
  if (!obj) return;
  if (!confirm(`Delete data object "${obj.name}" (ID ${obj.id})?`)) return;
  dataObjects.splice(i, 1);
  refreshFoundationSelect();
  renderFieldsTable();
  renderDataObjects();
}

/* ================= DOM Helpers ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const byId = (id) => document.getElementById(id);
const uid = (p = 'id') => p + '-' + Math.random().toString(36).slice(2, 9);

/* ================= Elements ================= */
const systemListEl = byId('systemList');
const foundationSelect = byId('fld-foundation');
const fieldsBody = byId('fieldsBody');
const localFieldsBody = byId('localFieldsBody');
const systemsTable = byId('systemsTable');
const columnsTable = byId('columnsTable');
const domainsTable = byId('domainsTable');
const legalTable = byId('legalTable');

/* Field dialog elements */
const fieldDialog = byId('fieldDialog');
const fieldForm = byId('fieldForm');
const systemSelect = byId('fld-system');
const sourceSystemSelect = byId('fld-source-system');
const sourceFieldSelect = byId('fld-source-field');
const glossarySelect = byId('fld-glossary'); // NEU

/* Felder für Auswahl der LEs bei lokalen Feldern */
const legalEntitySelect = byId('fld-legal-entity');
const legalEntityHint = byId('fld-legal-entity-hint');
// Hinweiszeile unter "Legal Entity" entfernen, damit nichts mehr verschiebt
legalEntityHint?.remove();

/* Systems dialog */
const systemDialog = byId('systemDialog');
const systemForm = byId('systemForm');
const systemDomainSelect = byId('sys-domain');

/* Column dialog */
const columnDialog = byId('columnDialog');
const columnForm = byId('columnForm');

/* Domain dialog */
const domainDialog = byId('domainDialog');
const domainForm = byId('domainForm');

/* Legal dialogs */
const legalDialog = byId('legalDialog');
const legalForm = byId('legalForm');
const addLegalBtn = byId('addLegalBtn');
const leSystemsDialog = byId('leSystemsDialog');
const leSystemsForm = byId('leSystemsForm');
const leSystemsLegend = byId('leSystemsLegend');
const leSystemsList = byId('leSystemsList');

/* Glossary */
const glossaryTable = byId('glossaryTable');
const glossaryDialog = byId('glossaryDialog');
const glossaryForm = byId('glossaryForm');
const addGlossaryBtn = byId('addGlossaryBtn');
const glossaryFieldRef = byId('gls-fieldRef');

/* Top tabs & map */
const topTabs = byId('topTabs');
const adminTabs = byId('adminTabs');

/* Data Map */
const mapCanvas = byId('mapCanvas');
const mapViewport = byId('mapViewport');
const mapEdgesSvg = byId('mapEdges');
const mapNodesLayer = byId('mapNodes');
const mapFitBtn = byId('mapFitBtn');

/* Filter Overlay */
const filterOverlay = byId('filterOverlay');
const openFilterPanelBtn = byId('openFilterPanel');
const filterCloseBtn = byId('filterCloseBtn');
const filterDone = byId('filterDone');
const filterClear = byId('filterClear');
const chipSystems = byId('chipSystems');
const chipDomains = byId('chipDomains');
const scopeGlobal = byId('scopeGlobal');
const scopeLocal = byId('scopeLocal');
const mapSearch = byId('mapSearch');
/*Ende Teil 1*/
/*Teil 2 Zeilen 309-603*/
/* ===== Glossary: Spalten-Definition (einzige Stelle, die du später änderst) ===== */
const GLOSSARY_COLUMNS = [
  { key: 'term', label: 'Term' },
  { key: 'type', label: 'Type' },
  { key: 'definition', label: 'Definition' },
  { key: 'info', label: 'Additional Information' },
  { key: 'owner', label: 'Responsible Process Owner' },
  { key: 'fieldRef', label: 'Linked Data Field' },
];

/* Fallback-Utils (nur einfügen, wenn bei dir nicht vorhanden) */
function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        m
      ])
  );
}

/* ===== Header dynamisch rendern (einmal pro Ansicht) ===== */
function renderGlossaryHead() {
  const headRow = document.getElementById('glossaryHeadRow');
  if (!headRow) return;
  headRow.innerHTML = [
    ...GLOSSARY_COLUMNS.map((c) => `<th>${esc(c.label)}</th>`),
    '<th>Actions</th>',
  ].join('');
}

/* ===== Sicherheitscheck (Konsole warnt bei Missmatch) ===== */
function verifyGlossaryColumns() {
  const headCols = document.querySelectorAll('#glossaryView thead th').length;
  const firstRow = document.querySelector('#glossaryTable tr');
  const bodyCols = firstRow ? firstRow.children.length : 0;
  if (bodyCols && headCols !== bodyCols) {
    console.warn(
      `Glossary column mismatch: header=${headCols}, row=${bodyCols}`
    );
  }
}

/* ================= Utilities ================= */

function safeDrawAllEdges() {
  try { drawSystemEdges(); } catch (e) {
    console.error('[edges]', e);
    if (typeof clearSelectionVisuals === 'function') clearSelectionVisuals();
  }
}
// Merkt sich das aktuell fokussierte Filter-Input und stellt Fokus + Caret nach Re-Render wieder her.
function preserveFilterInputFocus(rerenderFn) {
  const active = document.activeElement;
  const isFilter =
    active &&
    active.tagName === 'INPUT' &&
    active.type === 'search' &&
    active.dataset &&
    active.dataset.col;
  const colKey = isFilter ? active.dataset.col : null;
  let start = null,
    end = null;
  if (isFilter && typeof active.selectionStart === 'number') {
    start = active.selectionStart;
    end = active.selectionEnd;
  }
  // Re-Render ausführen
  rerenderFn();

  // Fokus wiederherstellen (Global-Tab)
  if (colKey) {
    const newInp = document.querySelector(
      `thead input[type="search"][data-col="${colKey}"]`
    );
    if (newInp) {
      newInp.focus({ preventScroll: true });
      const len = newInp.value.length;
      const s = start != null ? start : len;
      const e = end != null ? end : len;
      try {
        newInp.setSelectionRange(s, e);
      } catch {}
    }
  }
}

function systemByName(name) {
  return systems.find((s) => s.name === name) || null;
}
function systemIdByName(name) {
  const s = systemByName(name);
  return s ? s.id : null;
}

function getDataObjectById(id) {
  if (id == null || id === '') return null;
  return dataObjects.find((o) => String(o.id) === String(id)) || null;
}
function getDataObjectByName(name) {
  if (!name) return null;
  return dataObjects.find((o) => o.name === name) || null;
}
function foundationLabelForField(f) {
  const obj = getDataObjectById(f.foundationObjectId);
  return obj ? obj.name : '-';
}

function eligibleForLE(systemName, isLocal) {
  // LE-Zuordnung erlaubt, wenn Feld lokal ODER System nicht 'global' ist
  const s = systemByName(systemName);
  const scope = s?.scope || 'both';
  return !!(isLocal || scope !== 'global');
}
function leLabel(num) {
  if (!num) return '—';
  const le = legalEntities.find((x) => x.number === num);
  return le ? `${le.number} — ${le.name}` : num;
}
function leName(num) {
  if (!num) return 'Unassigned';
  const le = legalEntities.find((x) => x.number === num);
  return le ? le.name : 'Unassigned';
}
function assignedLEsForSystem(systemName) {
  // LEs, die diesem System (über die system.id) zugeordnet sind
  const sid = systemIdByName(systemName);
  if (!sid) return [];
  return legalEntities.filter((le) =>
    (leSystemMap[le.number] || []).includes(sid)
  );
}
function populateLESelectForSystem(systemName, isLocal, selectedNumber = '') {
  if (!legalEntitySelect) return;
  const allowed = eligibleForLE(systemName, isLocal);
  const list = allowed ? assignedLEsForSystem(systemName) : [];
  const opts = ['<option value="">(none)</option>'].concat(
    list.map(
      (le) => `<option value="${le.number}">${le.number} — ${le.name}</option>`
    )
  );
  legalEntitySelect.innerHTML = opts.join('');
  legalEntitySelect.disabled = !allowed || list.length === 0;

  if (selectedNumber && list.some((le) => le.number === selectedNumber)) {
    legalEntitySelect.value = selectedNumber;
  } else {
    legalEntitySelect.value = '';
  }
}

function refreshFoundationSelect() {
  if (!foundationSelect) return;
  foundationSelect.innerHTML = dataObjects
    .map((o) => `<option value="${o.id}">${o.name}</option>`)
    .join('');
}

const isValidSystemName = (n) => systems.some((s) => s.name === n);
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const getFieldsBySystem = (n) => fields.filter((f) => f.system === n);
const getDomainNames = () =>
  dataDomains.filter((d) => d.active !== false).map((d) => d.name);
const getSystemsByDomain = (d) =>
  systems.filter((s) => (s.dataDomain || '') === d);
const domainByName = (n) => dataDomains.find((d) => d.name === n);

function normalizeColumns() {
  const required = ['Field Name', 'System'];
  required.forEach((r, i) => {
    const f = fieldColumns.find((c) => c.name === r);
    if (!f) fieldColumns.push({ name: r, visible: true, order: i + 1 });
    else {
      f.visible = true;
      if (f.order == null) f.order = i + 1;
    }
  });
  let max = Math.max(...fieldColumns.map((c) => c.order ?? 0), 8);
  fieldColumns.forEach((c) => {
    if (c.order == null) c.order = ++max;
  });
}
function visibleColumns() {
  normalizeColumns();
  return fieldColumns.filter((c) => c.visible).sort(byOrder);
}

function getGlossaryById(id) {
  if (!id) return null;
  return glossaryTerms.find((g) => g.id === id) || null;
}

function cellValue(name, f) {
  switch (name) {
    case 'Field Name':
      return f.name ?? '-';
    case 'Legal Entity':
      return leLabel(f.legalEntityNumber || '');
    case 'System':
      return f.system ?? '-';
    case 'Mandatory':
      return f.mandatory ? 'Yes' : 'No';
    case 'Mapping':
      return f.mapping || '-';

    // NEU: „Data Object“ (und Altname weiterhin unterstützt)
    case 'Data Object':
    case 'Foundation Data':
      return foundationLabelForField(f);

    case 'Definition': {
      const def = fieldDefinitionText(f);
      if (!f.glossaryId) return '—';
      if (!def) return '(no definition)';
      return def;
    }
    default:
      return f[name] ?? '-';
  }
}
/* Ende Teil 2*/
/* Teil 3 Zeilen 604-921*/
/* ===== Sort/Filter State ===== */
const localSortByLe = Object.create(null); // je LE-Tabelle: { [leNumber]: {key,dir} }
const columnFilters = Object.create(null); // globale Spaltenfilter: { [ColumnName]: query }

/* Data-Object-Name für Sortierung */
function dataObjectNameForField(f) {
  const obj = getDataObjectById?.(f.foundationObjectId);
  return obj ? obj.name : '';
}

/* Column-Name → Sort-Key */
function mapColToSortKey(colName) {
  switch (colName) {
    case 'Field Name':
      return 'name';
    case 'System':
      return 'system';
    case 'Data Object':
    case 'Foundation Data':
      return 'dataObject';
    case 'Mandatory':
      return 'mandatory';
    default:
      return colName; // Fallback: Cell-Text
  }
}

/* Wert für Sortierung je Schlüssel */
function valueForSort(key, f) {
  switch (key) {
    case 'name':
      return (f.name || '').toLowerCase();
    case 'system':
      return (f.system || '').toLowerCase();
    case 'dataObject':
      return (dataObjectNameForField(f) || '').toLowerCase();
    case 'mandatory':
      return f.mandatory ? '1' : '0';
    default: {
      // Fallback: nimm den Zellwert der angezeigten Spalte (falls vorhanden)
      const displayName = key; // bei Fallback entspricht key dem Spaltentitel
      const v = cellValue ? cellValue(displayName, f) : f[displayName] ?? '';
      return String(v ?? '').toLowerCase();
    }
  }
}

/* Standardsortierung: System → Data Object → Feldname */
function sortFieldsDefault(list) {
  return [...list].sort((a, b) => {
    const s = valueForSort('system', a).localeCompare(
      valueForSort('system', b)
    );
    if (s) return s;
    const d = valueForSort('dataObject', a).localeCompare(
      valueForSort('dataObject', b)
    );
    if (d) return d;
    return valueForSort('name', a).localeCompare(valueForSort('name', b));
  });
}

/* Benutzersortierung (per Klick) */
function sortFieldsCustom(list, sortSpec) {
  if (!sortSpec) return sortFieldsDefault(list);
  const { key, dir } = sortSpec;
  return [...list].sort((a, b) => {
    const va = valueForSort(key, a);
    const vb = valueForSort(key, b);
    let cmp = va.localeCompare(vb, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (dir === 'desc') cmp = -cmp;
    return cmp;
  });
}

/* Spaltenfilter anwenden */
function applyColumnFilters(list, cols) {
  const active = Object.entries(columnFilters).filter(
    ([_, q]) => (q ?? '').trim() !== ''
  );
  if (!active.length) return list;
  const colSet = new Set(cols.map((c) => c.name));
  return list.filter((f) =>
    active.every(([col, q]) => {
      if (!colSet.has(col)) return true; // unbekannte Spalte ignorieren
      const val = String(cellValue(col, f) ?? '').toLowerCase();
      return val.includes(q.toLowerCase());
    })
  );
}

/* Header-UI: Sortier-Indikator */
function sortIndicator(colName, sortSpec) {
  const key = mapColToSortKey(colName);
  if (!sortSpec || sortSpec.key !== key) return '';
  return sortSpec.dir === 'desc' ? ' ▼' : ' ▲';
}

/* ===== Field ⇄ Glossary Helpers ===== */
function fieldGlossaryTerm(field) {
  if (!field?.glossaryId) return null;
  return glossaryTerms.find((g) => g.id === field.glossaryId) || null;
}
function fieldDefinitionText(field) {
  const t = fieldGlossaryTerm(field);
  return t ? t.definition || '—' : '—';
}
function fieldDefinitionLabel(field) {
  const t = fieldGlossaryTerm(field);
  return t ? t.term : '';
}

/**
 * Einfache Picker-UI via prompt():
 * - Erst optional Suche
 * - Dann Liste (max. 20) & Nummer wählen
 * - Leere Eingabe = Zuordnung entfernen
 */
function pickGlossaryForField(fieldIndex) {
  if (fieldIndex == null || fieldIndex < 0 || fieldIndex >= fields.length)
    return;

  // 1) optional filtern
  const q = (prompt('Glossary suchen (leer lassen für alle):') || '')
    .trim()
    .toLowerCase();
  let list = glossaryTerms;
  if (q) {
    list = glossaryTerms.filter(
      (g) =>
        (g.term || '').toLowerCase().includes(q) ||
        (g.definition || '').toLowerCase().includes(q)
    );
  }

  if (!list.length) {
    alert('Keine Glossary-Einträge gefunden.');
    return;
  }

  // 2) Liste bauen (deckeln)
  const max = 20;
  const page = list.slice(0, max);
  const menu = page
    .map((g, i) => {
      const def = (g.definition || '').replace(/\s+/g, ' ').slice(0, 80);
      return `${i + 1}. ${g.term} — ${def}${
        g.definition && g.definition.length > 80 ? '…' : ''
      }`;
    })
    .join('\n');

  const hint = `\n\nNummer eingeben (1–${page.length}).\nLeer lassen = Zuordnung entfernen.`;
  const ans = prompt(`Glossary zuordnen:\n\n${menu}${hint}`) || '';

  // Entfernen?
  if (!ans.trim()) {
    delete fields[fieldIndex].glossaryId;
    saveFields(); // <— neu
    renderFieldsTable();
    if (document.body.getAttribute('data-mode') === 'map') renderDataMap();
    return;
  }

  const n = parseInt(ans, 10);
  if (isNaN(n) || n < 1 || n > page.length) {
    alert('Ungültige Eingabe.');
    return;
  }

  const picked = page[n - 1];
  fields[fieldIndex].glossaryId = picked.id;
  saveFields(); // <— neu
  renderFieldsTable();
  if (document.body.getAttribute('data-mode') === 'map') renderDataMap();
}
/* ================= Sidebar ================= */
function renderSystemsSidebar() {
  // IDs hier frisch auflösen, damit keine Scope-Probleme mit lokalen Variablen entstehen
  const systemsNavItem = byId('systemsNavItem');
  const dataMapNavItem = byId('dataMapNavItem');
  const glossaryNavItem = byId('glossaryNavItem');
  const adminNavItem = byId('adminNavItem');

  // Nav-Buttons (oben) aktiv setzen
  const mode = document.body.getAttribute('data-mode');
  systemsNavItem?.classList.toggle('is-active', mode === 'systems');
  dataMapNavItem?.classList.toggle('is-active', mode === 'map');
  glossaryNavItem?.classList.toggle('is-active', mode === 'glossary');
  adminNavItem?.classList.toggle('is-active', mode === 'admin');

  // Systems-Liste nur im Systems-Modus anzeigen
  const showSystemsList = mode === 'systems';
  if (systemListEl) {
    systemListEl.style.display = showSystemsList ? 'block' : 'none';
    systemListEl.innerHTML = '';
  }
  if (!showSystemsList) return;

  const liAll = document.createElement('li');
  liAll.textContent = 'All Systems';
  liAll.dataset.all = 'true';
  if (currentSystem === 'All Systems') liAll.classList.add('is-active');
  liAll.addEventListener('click', () => setModeSystems('All Systems'));
  systemListEl.appendChild(liAll);

  const names = getDomainNames();
  names.forEach((dn) => {
    const cluster = document.createElement('div');
    cluster.className = 'domain-cluster is-open';
    const head = document.createElement('div');
    head.className = 'cluster-head';
    const color = domainByName(dn)?.color || '#6a6a6a';
    head.innerHTML = `<span><span class="domain-icon" style="background:${color}"></span>${dn}</span><span>▾</span>`;
    const body = document.createElement('div');
    body.className = 'cluster-body';
    getSystemsByDomain(dn).forEach((sys) => {
      const li = document.createElement('li');
      li.textContent = sys.name;
      if (currentSystem === sys.name) li.classList.add('is-active');
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        setModeSystems(sys.name);
      });
      body.appendChild(li);
    });
    head.addEventListener('click', (e) => {
      e.stopPropagation();
      cluster.classList.toggle('is-open');
      head.querySelector('span:last-child').textContent =
        cluster.classList.contains('is-open') ? '▾' : '▸';
      body.style.display = cluster.classList.contains('is-open')
        ? 'block'
        : 'none';
    });
    cluster.appendChild(head);
    cluster.appendChild(body);
    systemListEl.appendChild(cluster);
  });

  const unassigned = systems.filter(
    (s) => !s.dataDomain || !names.includes(s.dataDomain)
  );
  if (unassigned.length) {
    const cluster = document.createElement('div');
    cluster.className = 'domain-cluster is-open';
    const head = document.createElement('div');
    head.className = 'cluster-head';
    head.innerHTML = `<span><span class="domain-icon" style="background:#c6c6c6"></span>Unassigned</span><span>▾</span>`;
    const body = document.createElement('div');
    body.className = 'cluster-body';
    unassigned.forEach((sys) => {
      const li = document.createElement('li');
      li.textContent = sys.name;
      if (currentSystem === sys.name) li.classList.add('is-active');
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        setModeSystems(sys.name);
      });
      body.appendChild(li);
    });
    head.addEventListener('click', (e) => {
      e.stopPropagation();
      cluster.classList.toggle('is-open');
      head.querySelector('span:last-child').textContent =
        cluster.classList.contains('is-open') ? '▾' : '▸';
      body.style.display = cluster.classList.contains('is-open')
        ? 'block'
        : 'none';
    });
    cluster.appendChild(head);
    cluster.appendChild(body);
    systemListEl.appendChild(cluster);
  }
}

function showGlossarySubnav(show) {
  const sub = document.getElementById('glossarySubnav');
  const sys = document.getElementById('systemList');
  if (sub) sub.style.display = show ? 'block' : 'none';
  if (sys) sys.style.display = show ? 'none' : sys.style.display; // bei Glossary: Systems-Liste ausblenden
}

function installGlossarySubnavHandlers() {
  const sub = document.getElementById('glossarySubnav');
  if (!sub) return;
  sub.querySelectorAll('.gls-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Active-Style setzen
      sub
        .querySelectorAll('.gls-filter')
        .forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      // Filter übernehmen
      glossaryTypeFilter = btn.dataset.type || 'ALL';
      state.glossaryTypeFilter = glossaryTypeFilter;
      renderGlossary();
    });
  });
}

function getFilteredGlossaryItems() {
  const list = glossaryTerms.filter((g) => {
    if (!glossaryTypeFilter || glossaryTypeFilter === 'ALL') return true;
    return (g.type || 'Term') === glossaryTypeFilter;
  });
  return list.sort((a, b) => {
    const t = (a.type || 'Term').localeCompare(b.type || 'Term');
    if (t !== 0) return t;
    return (a.term || '').localeCompare(b.term || '');
  });
}

function renderGlossary() {
  renderGlossaryHead();
  // Daten liegen dank loadGlossary() in glossaryTerms vor.
  renderGlossaryTable();
  verifyGlossaryColumns();
}
/* ================= Ansichtsumschaltung (mit Guards) ================= */
function showOnly(mode) {
  // 'systems' | 'admin' | 'map' | 'glossary'
  const showSystems = mode === 'systems';
  const showAdmin = mode === 'admin';
  const showMap = mode === 'map';
  const showGlossary = mode === 'glossary';

  const topTabsEl = byId('topTabs');
  const globalEl = byId('global');
  const localEl = byId('local');
  const adminTabsEl = byId('adminTabs');
  const mapViewEl = byId('mapView');
  const glossaryEl = byId('glossaryView');

  if (topTabsEl) topTabsEl.style.display = showSystems ? 'flex' : 'none';
  if (globalEl) globalEl.style.display = showSystems ? 'block' : 'none';
  if (localEl) localEl.style.display = showSystems ? 'block' : 'none';
  if (adminTabsEl) adminTabsEl.style.display = showAdmin ? 'flex' : 'none';
  if (mapViewEl) mapViewEl.style.display = showMap ? 'block' : 'none';
  if (glossaryEl) glossaryEl.style.display = showGlossary ? 'block' : 'none';

  $$('.admin-view').forEach((v) => {
    v.style.display = showAdmin ? 'block' : 'none';
  });

  try {
    renderSystemsSidebar();
  } catch (e) {
    console.error(e);
  }
}
/* Ende Teil 3*/
/* Teil 4 Zeilen 922-1462*/
/* ================= Mode switching ================= */

// Sichtbarkeits-Flags (müssen VOR initializeApp() definiert sein!)

function setModeSystems(name) {
  currentSystem = name;
  state.currentSystem = currentSystem;
  selectedFieldRef = null;
  state.selectedFieldRef = selectedFieldRef;
  clearSelectionVisuals();
  document.body.setAttribute('data-mode', 'systems');
  showOnly('systems');

  const sys = systems.find((s) => s.name === name);
  let showGlobal = true,
    showLocal = true;
  if (sys) {
    if (sys.scope === 'global') showLocal = false;
    if (sys.scope === 'local') showGlobal = false;
  }
  const tabGlobal = $('#topTabs .tab[data-tab="global"]');
  const tabLocal = $('#topTabs .tab[data-tab="local"]');
  if (tabGlobal) tabGlobal.style.display = showGlobal ? 'inline-flex' : 'none';
  if (tabLocal) tabLocal.style.display = showLocal ? 'inline-flex' : 'none';

  let target = showGlobal ? 'global' : showLocal ? 'local' : 'global';
  $$('#topTabs .tab').forEach((t) => t.classList.remove('is-active'));
  const btn = $(`#topTabs .tab[data-tab="${target}"]`);
  if (btn) {
    btn.classList.add('is-active');
    showMainView(target);
  }

  renderSystemsSidebar();
  renderFieldsTable();
}
function showMainView(id) {
  const g = byId('global');
  const l = byId('local');
  if (g) g.style.display = id === 'global' ? 'block' : 'none';
  if (l) l.style.display = id === 'local' ? 'block' : 'none';
}

/* ================= Admin Tabs ================= */
function showAdminSubview(id) {
  $$('.admin-view').forEach((v) => (v.style.display = 'none'));
  const view = byId(id);
  if (view) view.style.display = 'block';
  if (id === 'admin-systems') renderSystemsTable();
  if (id === 'admin-columns') renderColumnsTable();
  if (id === 'admin-domains') renderDomainsTable();
  if (id === 'admin-legal') renderLegalEntities();
  if (id === 'admin-dataobjects') renderDataObjects();
}
function resetAllAppData() {
  const keys = [
    'gdf_fields_v1',
    'gdf_fields_v2',
    'gdf_systems_v1',
    'gdf_glossary_v1',
    'gdf_mapPositions_v1',
    'gdf_mapFilters_v1',
    'gdf_leSystemMap_v1',
    'gdf_fieldColumns_v1',
  ];
  keys.forEach((k) => localStorage.removeItem(k));
  alert('Lokale App-Daten zurückgesetzt. Bitte Seite neu laden.');
}

/* Sortierfunktion */

function sortFieldsByNameAndSystem(list) {
  return [...list].sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;

    const sysA = (a.system || '').toLowerCase();
    const sysB = (b.system || '').toLowerCase();
    if (sysA < sysB) return -1;
    if (sysA > sysB) return 1;
    return 0;
  });
}

/* ================= Tables: Systems mode ================= */
function renderFieldsTable() {
  const cols = visibleColumns();
  const activeTab =
    document.querySelector('#topTabs .tab.is-active')?.dataset.tab || 'global';

  const thead = document.querySelector('#global thead');
  if (thead) {
    // Zeile 1: Sortierbare Header
    const row1 = document.createElement('tr');
    row1.innerHTML =
      cols
        .map(
          (c) =>
            `<th data-col="${c.name}" class="is-sortable">${
              c.name
            }${sortIndicator(c.name, globalSort)}</th>`
        )
        .join('') + `<th>Actions</th>`;

    thead.innerHTML = '';
    thead.appendChild(row1);

    // Nur wenn eingeschaltet: Filterzeile einbauen
    if (showGlobalFilters) {
      const row2 = document.createElement('tr');
      row2.innerHTML =
        cols
          .map((c) => {
            const v = columnFilters[c.name] ?? '';
            return `<th><input data-col="${
              c.name
            }" type="search" placeholder="Filter…" value="${esc(v)}" /></th>`;
          })
          .join('') + `<th></th>`;
      thead.appendChild(row2);

      // Filter-Handler
      row2.querySelectorAll('input[type="search"]').forEach((inp) => {
        inp.addEventListener('input', () => {
          columnFilters[inp.dataset.col] = inp.value || '';
          // Nur tbody neu malen -> flüssiges Tippen
          preserveFilterInputFocus(() => updateGlobalTableBodyOnly());
        });
      });
    }

    // Sortier-Handler
    row1.querySelectorAll('th.is-sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        const key = mapColToSortKey(col);
        if (globalSort.key === key) {
          globalSort.dir = globalSort.dir === 'asc' ? 'desc' : 'asc';
          state.globalSort = globalSort;
        } else {
          globalSort = { key, dir: 'asc' };
          state.globalSort = globalSort;
        }
        // Header erneut schreiben (Pfeile) und Body neu
        renderFieldsTable();
      });
    });
  }

  // LOCAL-Tab: auf die neue Mehrtabellen-Logik umleiten
  if (activeTab === 'local') {
    renderLocalFieldsTables();
    return;
  }

  // ===== GLOBAL-Tab (wie bisher) =====
  const bodyEl = document.getElementById('fieldsBody');
  if (!bodyEl) {
    console.warn('[gdf] renderFieldsTable(): tbody not found for global');
    return;
  }
  bodyEl.innerHTML = '';

  let visible = fields
    .filter((f) => isValidSystemName(f.system))
    .filter(
      (f) => currentSystem === 'All Systems' || f.system === currentSystem
    )
    .filter((f) => {
      const sys = systems.find((s) => s.name === f.system);
      return !f.local && (sys?.scope || 'both') !== 'local';
    });
  // nach Spaltenfiltern + Sortierung
  visible = applyColumnFilters(visible, cols);
  visible = sortFieldsCustom(visible, globalSort) || sortFieldsDefault(visible);

  // Map sichtbarer Eintrag -> globaler Index im fields-Array
  const indexMap = new Map();
  visible.forEach((v) => {
    const gi = fields.findIndex(
      (f) =>
        f.name === v.name && f.system === v.system && f.mapping === v.mapping
    );
    indexMap.set(v, gi);
  });

  visible.forEach((f, i) => {
    const tr = document.createElement('tr');

    // Zellen
    cols.forEach((c) => {
      const td = document.createElement('td');
      td.dataset.col = c.name;
      if (c.name === 'Definition') td.textContent = cellValue('Definition', f);
      else td.textContent = cellValue(c.name, f);
      tr.appendChild(td);
    });

    // Actions
    const tdActions = document.createElement('td');
    tdActions.className = 'table-actions';
    tdActions.innerHTML = `
      <button data-index="${i}" class="fieldEdit" title="Edit">
        <svg class="icon-16" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" fill="currentColor"/></svg>
      </button>
      <button data-index="${i}" class="fieldDelete" title="Delete">
        <svg class="icon-16" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm5-4h2l1 1h4v2H5V4h4l1-1Z" fill="currentColor"/></svg>
      </button>
    `;
    tr.appendChild(tdActions);

    bodyEl.appendChild(tr);
  });

  // Edit/Delete-Handler
  bodyEl.querySelectorAll('.fieldEdit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = visible[parseInt(btn.dataset.index, 10)];
      const gi = indexMap.get(v);
      openFieldDialog(gi);
    });
  });
  bodyEl.querySelectorAll('.fieldDelete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = visible[parseInt(btn.dataset.index, 10)];
      const gi = indexMap.get(v);
      if (confirm(`Delete field "${fields[gi].name}"?`)) {
        fields.splice(gi, 1);
        renderFieldsTable();
        if (document.body.getAttribute('data-mode') === 'map') renderDataMap();
      }
    });
  });
}

// === Nur das Global-<tbody> neu malen (Header bleibt unverändert) ===
function updateGlobalTableBodyOnly() {
  const cols = visibleColumns();
  const bodyEl = document.getElementById('fieldsBody');
  if (!bodyEl) return;

  bodyEl.innerHTML = '';

  // Gleiche Logik wie in renderFieldsTable(), aber ohne thead anzufassen
  let visible = fields
    .filter((f) => isValidSystemName(f.system))
    .filter(
      (f) => currentSystem === 'All Systems' || f.system === currentSystem
    )
    .filter((f) => {
      const sys = systems.find((s) => s.name === f.system);
      return !f.local && (sys?.scope || 'both') !== 'local';
    });

  // Filter + Sort
  visible = applyColumnFilters(visible, cols);
  visible = sortFieldsCustom(visible, globalSort) || sortFieldsDefault(visible);

  // Map sichtbarer Eintrag -> globaler Index
  const indexMap = new Map();
  visible.forEach((v) => {
    const gi = fields.findIndex(
      (f) =>
        f.name === v.name &&
        f.system === v.system &&
        (f.mapping || '') === (v.mapping || '')
    );
    indexMap.set(v, gi);
  });

  // Zeilen bauen
  visible.forEach((f, i) => {
    const tr = document.createElement('tr');

    cols.forEach((c) => {
      const td = document.createElement('td');
      td.dataset.col = c.name;
      td.textContent =
        c.name === 'Definition'
          ? cellValue('Definition', f)
          : cellValue(c.name, f);
      tr.appendChild(td);
    });

    const tdActions = document.createElement('td');
    tdActions.className = 'table-actions';
    tdActions.innerHTML = `
      <button data-index="${i}" class="fieldEdit" title="Edit">
        <svg class="icon-16" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" fill="currentColor"/></svg>
      </button>
      <button data-index="${i}" class="fieldDelete" title="Delete">
        <svg class="icon-16" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm5-4h2l1 1h4v2H5V4h4l1-1Z" fill="currentColor"/></svg>
      </button>
    `;
    tr.appendChild(tdActions);

    bodyEl.appendChild(tr);
  });

  // Edit/Delete-Handler neu anbinden
  bodyEl.querySelectorAll('.fieldEdit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = visible[parseInt(btn.dataset.index, 10)];
      const gi = indexMap.get(v);
      if (gi != null) openFieldDialog(gi);
    });
  });
  bodyEl.querySelectorAll('.fieldDelete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = visible[parseInt(btn.dataset.index, 10)];
      const gi = indexMap.get(v);
      if (gi == null) return;
      if (confirm(`Delete field "${fields[gi].name}"?`)) {
        fields.splice(gi, 1);
        saveFields?.();
        updateGlobalTableBodyOnly();
        if (document.body.getAttribute('data-mode') === 'map') renderDataMap();
      }
    });
  });
}

function renderLocalFieldsTables() {
  const cols = visibleColumns();

  // Host-Container finden oder anlegen
  const localView = document.getElementById('local');
  if (!localView) {
    console.warn('[gdf] renderLocalFieldsTables(): #local not found');
    return;
  }

  let host = document.getElementById('localTables');
  if (!host) {
    host = document.createElement('div');
    host.id = 'localTables';
    localView.innerHTML = ''; // leeren und Host einhängen
    localView.appendChild(host);
  } else {
    host.innerHTML = '';
  }

  // Hilfsfunktion
  const getLENameByNumber = (num) => {
    if (!num) return 'Unassigned';
    const le = legalEntities.find((x) => x.number === num);
    return le ? le.name : 'Unassigned';
  };

  // Lokale Felder filtern
  const localCandidates = fields
    .filter((f) => isValidSystemName(f.system))
    .filter(
      (f) => currentSystem === 'All Systems' || f.system === currentSystem
    )
    .filter((f) => {
      const sys = systems.find((s) => s.name === f.system);
      return f.local === true || sys?.scope === 'local';
    });

  // Gruppierung: LE-Nummer -> Array von Feldern
  const groups = new Map();
  for (const f of localCandidates) {
    const key = (f.legalEntityNumber || '').trim(); // '' = unassigned
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }

  // Sortierung: zuerst echte LEs (nach Name), dann Unassigned
  const keys = Array.from(groups.keys());
  const namedKeys = keys.filter((k) => k !== '');
  namedKeys.sort((a, b) =>
    getLENameByNumber(a).localeCompare(getLENameByNumber(b))
  );
  const orderedKeys = [...namedKeys, ...[''].filter((k) => groups.has(k))];

  // Für jede Gruppe: Überschrift + Add-Button + Tabelle
  orderedKeys.forEach((leNumber) => {
    // Filter + Sort je LE-Tabelle
    let recs = groups.get(leNumber) || [];
    recs = applyColumnFilters(recs, cols);
    recs =
      sortFieldsCustom(recs, localSortByLe[leNumber]) ||
      sortFieldsDefault(recs);

    // Headerzeile
    const headerRow = document.createElement('div');
    headerRow.className = 'local-table-header';

    const title = document.createElement('h3');
    const titleName = leNumber ? getLENameByNumber(leNumber) : 'Unassigned';
    title.textContent = `Local Data Fields — ${titleName}`;
    headerRow.appendChild(title);

    // Add-Button (FIX: leNumber verwenden + an headerRow anhängen)
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn--sm btn--ghost addLocalForLeBtn';
    addBtn.setAttribute('type', 'button');
    addBtn.setAttribute('aria-label', 'Add Local Field');
    addBtn.dataset.leNumber = leNumber; // <-- FIX
    addBtn.innerHTML = `
      <svg class="icon-16" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2h5z" fill="currentColor"/>
      </svg>
      <span>Add Local Field</span>
    `;
    headerRow.appendChild(addBtn); // <-- FIX
    host.appendChild(headerRow);

    // Tabelle
    const table = document.createElement('table');
    table.className = 'table local-fields-table';
    table.dataset.leNumber = leNumber; // merken für individuelle Sortierung

    const thead = document.createElement('thead');

    // Zeile 1: Sortierbare Header
    const row1 = document.createElement('tr');
    row1.innerHTML =
      cols
        .map(
          (c) =>
            `<th data-col="${c.name}" class="is-sortable">${
              c.name
            }${sortIndicator(c.name, localSortByLe[leNumber])}</th>`
        )
        .join('') + `<th>Actions</th>`;

    thead.appendChild(row1);

    if (showLocalFilters) {
      const row2 = document.createElement('tr');
      row2.innerHTML =
        cols
          .map((c) => {
            const v = columnFilters[c.name] ?? '';
            return `<th><input data-col="${
              c.name
            }" type="search" placeholder="Filter…" value="${esc(v)}" /></th>`;
          })
          .join('') + `<th></th>`;
      thead.appendChild(row2);

      // Filter-Handler (teilen sich columnFilters)
      row2.querySelectorAll('input[type="search"]').forEach((inp) => {
        inp.addEventListener('input', () => {
          columnFilters[inp.dataset.col] = inp.value || '';
          // Für jetzt: gesamten Local-Bereich neu aufbauen (einfach und robust)
          preserveFilterInputFocus(() => renderLocalFieldsTables());
        });
      });
    }

    // Sortier-Handler (je LE-Tabelle eigene Sortierung)
    row1.querySelectorAll('th.is-sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        const key = mapColToSortKey(col);
        const cur = (localSortByLe[leNumber] ||= { key: 'system', dir: 'asc' });
        if (cur.key === key) cur.dir = cur.dir === 'asc' ? 'desc' : 'asc';
        else localSortByLe[leNumber] = { key, dir: 'asc' };
        renderLocalFieldsTables();
      });
    });

    const tbody = document.createElement('tbody');

    // Sichtbare Liste -> globaler Index map
    const indexMap = new Map();
    recs.forEach((v) => {
      const gi = fields.findIndex(
        (f) =>
          f.name === v.name &&
          f.system === v.system &&
          (f.mapping || '') === (v.mapping || '') &&
          (f.legalEntityNumber || '') === (v.legalEntityNumber || '')
      );
      indexMap.set(v, gi);
    });

    recs.forEach((f, i) => {
      const tr = document.createElement('tr');

      // Datenzellen
      cols.forEach((c) => {
        const td = document.createElement('td');
        td.dataset.col = c.name;
        if (c.name === 'Definition') {
          td.textContent = cellValue('Definition', f);
        } else {
          const val = cellValue(c.name, f);
          td.textContent = typeof val === 'string' ? val : String(val ?? '-');
        }
        tr.appendChild(td);
      });

      // Actions
      const tdActions = document.createElement('td');
      tdActions.className = 'table-actions';
      tdActions.innerHTML = `
        <button data-index="${i}" class="fieldEdit" title="Edit">
          <svg class="icon-16" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" fill="currentColor"/></svg>
        </button>
        <button data-index="${i}" class="fieldDelete" title="Delete">
          <svg class="icon-16" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm5-4h2l1 1h4v2H5V4h4l1-1Z" fill="currentColor"/></svg>
        </button>
      `;
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    host.appendChild(table);

    // Add-Button Handler (pro Gruppe)
    addBtn.addEventListener('click', () => {
      const opts = { presetLocal: true };
      if (leNumber) opts.presetLegalEntityNumber = leNumber;
      openFieldDialog(null, opts);
    });

    // Edit/Delete-Handler pro Tabelle
    tbody.querySelectorAll('.fieldEdit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.index, 10);
        const v = recs[i];
        const gi = indexMap.get(v);
        if (gi != null) openFieldDialog(gi);
      });
    });
    tbody.querySelectorAll('.fieldDelete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.index, 10);
        const v = recs[i];
        const gi = indexMap.get(v);
        if (gi == null) return;
        if (confirm(`Delete field "${fields[gi].name}"?`)) {
          fields.splice(gi, 1);
          saveFields?.();
          renderLocalFieldsTables();
          if (document.body.getAttribute('data-mode') === 'map')
            renderDataMap();
        }
      });
    });
  });

  // Edge-Case: Keine lokalen Felder -> trotzdem „Unassigned“-Block zeigen
  if (!orderedKeys.length) {
    const headerRow = document.createElement('div');
    headerRow.className = 'local-table-header';
    const title = document.createElement('h3');
    title.textContent = 'Local Data Fields — Unassigned';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn--sm btn--ghost addLocalForLeBtn';
    addBtn.setAttribute('type', 'button');
    addBtn.setAttribute('aria-label', 'Add Local Field');
    addBtn.dataset.leNumber = '';
    addBtn.innerHTML = `
      <svg class="icon-16" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 11V6h2v5h5v2h-5v5h-2v-5H6v-2h5z" fill="currentColor"/>
      </svg>
      <span>Add Local Field</span>
    `;
    headerRow.appendChild(title);
    headerRow.appendChild(addBtn);
    host.appendChild(headerRow);

    const table = document.createElement('table');
    table.className = 'table local-fields-table';
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    const headHtml =
      cols.map((c) => `<th>${c.name}</th>`).join('') + `<th>Actions</th>`;
    trHead.innerHTML = headHtml;
    thead.appendChild(trHead);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    host.appendChild(table);

    addBtn.addEventListener('click', () => {
      openFieldDialog(null, { presetLocal: true });
    });
  }
}
/* Ende Teil 4*/
/* Teil 5 Zeilen 1463-1802*/
/* ================= Admin Tables ================= */
function renderSystemsTable() {
  if (!systemsTable) return;
  systemsTable.innerHTML = '';
  systems.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.name}</td><td>${s.owner || '-'}</td><td>${
      s.version || '-'
    }</td><td>${s.scope || 'both'}</td><td>${s.dataDomain || '-'}</td>
      <td class="table-actions">
        <button data-index="${i}" class="systemEdit" title="Edit"><svg class="icon-16" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" fill="currentColor"/></svg></button>
        <button data-index="${i}" class="systemDelete" title="Delete"><svg class="icon-16" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm5-4h2l1 1h4v2H5V4h4l1-1Z" fill="currentColor"/></svg></button>
      </td>`;
    systemsTable.appendChild(tr);
  });
  $$('.systemEdit').forEach((btn) =>
    btn.addEventListener('click', () =>
      openSystemDialog(parseInt(btn.dataset.index, 10))
    )
  );
  $$('.systemDelete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      const name = systems[i].name;
      const deletedId = systems[i].id;
      if (!confirm(`Delete system "${name}"?`)) return;
      systems.splice(i, 1);
      saveSystems();

      // Cleanup Felder & Quellen
      fields = fields.filter((f) => f.system !== name);
      fields = fields.map((f) =>
        f.source?.system === name ? { ...f, source: undefined } : f
      );
      state.fields = fields;

      // Cleanup LE-Zuordnung
      Object.keys(leSystemMap).forEach((leNum) => {
        leSystemMap[leNum] = (leSystemMap[leNum] || []).filter(
          (id) => id !== deletedId
        );
        if (!leSystemMap[leNum].length) delete leSystemMap[leNum];
      });
      saveLeSystems();

      if (currentSystem === name) setModeSystems('All Systems');
      renderSystemsSidebar();
      renderSystemsTable();
      renderFieldsTable();
      if (document.body.getAttribute('data-mode') === 'map') renderDataMap();
      if (document.body.getAttribute('data-mode') === 'admin')
        renderLegalEntities();
    });
  });
}

function renderColumnsTable() {
  if (!columnsTable) return;
  columnsTable.innerHTML = '';
  fieldColumns.sort(byOrder).forEach((col, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${col.name}</td><td>${col.visible ? 'Yes' : 'No'}</td><td>${
      col.order
    }</td>
      <td class="table-actions">
        <button data-index="${i}" class="columnEdit" title="Edit"><svg class="icon-16" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" fill="currentColor"/></svg></button>
        <button data-index="${i}" class="columnDelete" title="Delete"><svg class="icon-16" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm5-4h2l1 1h4v2H5V4h4l1-1Z" fill="currentColor"/></svg></button>
      </td>`;
    columnsTable.appendChild(tr);
  });
  $$('.columnEdit').forEach((btn) =>
    btn.addEventListener('click', () =>
      openColumnDialog(parseInt(btn.dataset.index, 10))
    )
  );
  $$('.columnDelete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      if (!confirm(`Delete column "${fieldColumns[i].name}"?`)) return;
      fieldColumns.splice(i, 1);
      saveColumns();
      renderColumnsTable();
      renderFieldsTable();
    });
  });
}

function renderDomainsTable() {
  if (!domainsTable) return;
  domainsTable.innerHTML = '';
  dataDomains.forEach((d, i) => {
    const colorBox = `<span style="display:inline-block;width:16px;height:16px;border-radius:4px;border:1px solid #ddd;background:${
      d.color || '#6a6a6a'
    }"></span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.name}</td><td>${d.manager || '-'}</td><td>${
      d.active ? 'Yes' : 'No'
    }</td><td>${colorBox}</td>
      <td class="table-actions">
        <button data-index="${i}" class="domainEdit" title="Edit"><svg class="icon-16" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" fill="currentColor"/></svg></button>
        <button data-index="${i}" class="domainDelete" title="Delete"><svg class="icon-16" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm5-4h2l1 1h4v2H5V4h4l1-1Z" fill="currentColor"/></svg></button>
      </td>`;
    domainsTable.appendChild(tr);
  });
  $$('.domainEdit').forEach((btn) =>
    btn.addEventListener('click', () =>
      openDomainDialog(parseInt(btn.dataset.index, 10))
    )
  );
  $$('.domainDelete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      const name = dataDomains[i].name;
      if (!confirm(`Delete data domain "${name}"?`)) return;
      dataDomains.splice(i, 1);
      renderDomainsTable();
      renderSystemsSidebar();
      renderSystemsTable();
      if (document.body.getAttribute('data-mode') === 'map') renderDataMap();
      if (systemDomainSelect) {
        systemDomainSelect.innerHTML =
          `<option value="">(unassigned)</option>` +
          getDomainNames()
            .map((n) => `<option value="${n}">${n}</option>`)
            .join('');
      }
    });
  });
}

/* ================= Legal Entities ================= */
function renderLegalEntities() {
  if (!legalTable) return;
  legalTable.innerHTML = '';

  legalEntities.forEach((le, i) => {
    const assignedCount = leSystemMap[le.number]?.length || 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${le.number}</td>
      <td>${le.name}</td>
      <td>${le.country}</td>
      <td>${assignedCount} assigned</td>
      <td class="table-actions">
        <button data-index="${i}" class="leManage" title="Assign Systems">
          <svg class="icon-16" viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm8 4a8 8 0 1 1-16 0 8 0 0 1 16 0Z" fill="currentColor"/></svg>
        </button>
        <button data-index="${i}" class="leEdit" title="Edit">
          <svg class="icon-16" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" fill="currentColor"/></svg>
        </button>
        <button data-index="${i}" class="leDelete" title="Delete">
          <svg class="icon-16" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm5-4h2l1 1h4v2H5V4h4l1-1Z" fill="currentColor"/></svg>
        </button>
      </td>`;
    legalTable.appendChild(tr);
  });

  $$('.leEdit').forEach((btn) =>
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      openLegalDialog(i);
    })
  );
  $$('.leDelete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      const le = legalEntities[i];
      if (!confirm(`Delete legal entity "${le.name}"?`)) return;
      legalEntities.splice(i, 1);
      delete leSystemMap[le.number];
      saveLeSystems();
      renderLegalEntities();
    });
  });
  $$('.leManage').forEach((btn) =>
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      openLeSystemsDialog(i);
    })
  );
}

function openLegalDialog(index = null) {
  editLegalIndex = index;
  state.editLegalIndex = editLegalIndex;
  legalForm?.reset();
  if (!legalForm) return;
  if (index !== null) {
    const le = legalEntities[index];
    legalForm.elements.number.value = le.number;
    legalForm.elements.name.value = le.name;
    legalForm.elements.country.value = le.country;
  }
  openDialog(legalDialog);
}
legalForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(legalForm).entries());
  if (editLegalIndex !== null) {
    legalEntities[editLegalIndex] = {
      ...legalEntities[editLegalIndex],
      ...data,
    };
  } else {
    const newId = Math.max(0, ...legalEntities.map((l) => l.id || 0)) + 1;
    legalEntities.push({ id: newId, ...data });
  }
  renderLegalEntities();
  closeDialog(legalDialog);
});

function eligibleLocalOrBothSystems() {
  return systems.filter((s) => (s.scope || 'both') !== 'global'); // 'local' oder 'both'
}
function buildSystemChipList(container, sysList, selectedSet) {
  container.innerHTML = '';
  sysList.forEach((s) => {
    const id = `le-sys-${s.id}`;
    const label = document.createElement('label');
    label.className = 'chip';
    label.innerHTML = `
      <input type="checkbox" id="${id}" ${
      selectedSet.has(s.id) ? 'checked' : ''
    } />
      <span>${s.name}</span>
    `;
    const input = label.querySelector('input');
    input.dataset.sysId = s.id;
    container.appendChild(label);
  });
}
function openLeSystemsDialog(index) {
  editingLeIndexForSystems = index;
  state.editingLeIndexForSystems = editingLeIndexForSystems;
  const le = legalEntities[index];
  const allowed = eligibleLocalOrBothSystems();
  const selected = new Set(leSystemMap[le.number] || []);
  if (leSystemsLegend)
    leSystemsLegend.textContent = `${le.number} • ${le.name} • ${le.country}`;
  if (leSystemsList) buildSystemChipList(leSystemsList, allowed, selected);
  openDialog(leSystemsDialog);
}
leSystemsForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (editingLeIndexForSystems == null) {
    closeDialog(leSystemsDialog);
    return;
  }
  const le = legalEntities[editingLeIndexForSystems];
  const picked = Array.from(
    leSystemsList.querySelectorAll('input[type="checkbox"]:checked')
  ).map((inp) => inp.dataset.sysId);
  if (picked.length) leSystemMap[le.number] = picked;
  else delete leSystemMap[le.number];
  saveLeSystems();
  renderLegalEntities();
  closeDialog(leSystemsDialog);
});

/* ================= Glossary ================= */
function renderGlossaryTable() {
  if (!glossaryTable) return;
  glossaryTable.innerHTML = '';

  // 1) Filtern nach Typ (wenn nicht ALL)
  const list = glossaryTerms.filter((g) => {
    if (!glossaryTypeFilter || glossaryTypeFilter === 'ALL') return true;
    return (g.type || 'Term') === glossaryTypeFilter;
  });

  // 2) Sortieren NUR nach "Term" (A→Z, case-insensitiv)
  list.sort((a, b) =>
    (a.term || '').localeCompare(b.term || '', undefined, {
      sensitivity: 'base',
    })
  );

  // 3) Rendern
  list.forEach((g, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.term || '-'}</td>
      <td>${g.type || 'Term'}</td>
      <td>${g.definition || '-'}</td>
      <td>${g.info || '-'}</td>
      <td>${g.owner || '-'}</td>
      <td>${g.fieldRef ? g.fieldRef : '-'}</td>
      <td class="table-actions">
        <button data-index="${i}" class="glsEdit" title="Edit">
          <svg class="icon-16" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" fill="currentColor"/></svg>
        </button>
        <button data-index="${i}" class="glsDelete" title="Delete">
          <svg class="icon-16" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm5-4h2l1 1h4v2H5V4h4l1-1Z" fill="currentColor"/></svg>
        </button>
      </td>
    `;
    glossaryTable.appendChild(tr);
  });

  // Edit/Delete Handler
  $$('.glsEdit').forEach((btn) =>
    btn.addEventListener('click', () =>
      openGlossaryDialog(parseInt(btn.dataset.index, 10))
    )
  );
  $$('.glsDelete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      const name = list[i]?.term || 'term';
      if (confirm(`Delete glossary term "${name}"?`)) {
        const globalIdx = glossaryTerms.findIndex((x) => x.id === list[i].id);
        if (globalIdx > -1) glossaryTerms.splice(globalIdx, 1);
        saveGlossary();
        renderGlossaryTable();
      }
    });
  });
}
function populateGlossaryFieldRefOptions(selected = '') {
  if (!glossaryFieldRef) return;
  const options = ['<option value="">(none)</option>'].concat(
    fields.map((f) => {
      const label = `${f.system} • ${f.name}`;
      const value = `${f.system}:${f.name}`;
      const sel = value === selected ? 'selected' : '';
      return `<option value="${value}" ${sel}>${label}</option>`;
    })
  );
  glossaryFieldRef.innerHTML = options.join('');
}
function openGlossaryDialog(index = null) {
  editGlossaryIndex = index;
  state.editGlossaryIndex = editGlossaryIndex;
  glossaryForm?.reset();
  populateGlossaryFieldRefOptions('');
  if (!glossaryForm) return;
  if (index !== null) {
    // ... innerhalb von if (index !== null) { ... }
    const g = glossaryTerms[index];
    glossaryForm.elements.term.value = g.term || '';
    glossaryForm.elements.definition.value = g.definition || '';
    glossaryForm.elements.info.value = g.info || '';
    glossaryForm.elements.owner.value = g.owner || '';
    populateGlossaryFieldRefOptions(g.fieldRef || '');
    glossaryForm.elements.type.value = g.type || 'Term'; // <— NEU
    populateGlossaryFieldRefOptions(g.fieldRef || '');
  }
  openDialog(glossaryDialog);
}
glossaryForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(glossaryForm).entries());
  const record = {
    id:
      editGlossaryIndex !== null
        ? glossaryTerms[editGlossaryIndex].id || uid('gls')
        : uid('gls'),
    term: data.term?.trim() || '',
    definition: data.definition?.trim() || '',
    info: data.info?.trim() || '',
    owner: data.owner?.trim() || '',
    fieldRef: data.fieldRef || '',
    type: data.type && GLOSSARY_TYPES.includes(data.type) ? data.type : 'Term',
  };
  if (editGlossaryIndex !== null) glossaryTerms[editGlossaryIndex] = record;
  else glossaryTerms.push(record);
  saveGlossary();
  renderGlossaryTable();
  closeDialog(glossaryDialog);
});

/* Dialog Fallbacks */
function openDialog(dlg) {
  if (!dlg) return;
  // WICHTIG: inline display:none entfernen, sonst bleibt der Dialog unsichtbar
  dlg.style.removeProperty('display');
  if (dlg.showModal) dlg.showModal();
  else {
    dlg.classList.add('open');
    dlg.setAttribute('open', '');
  }
}
function closeDialog(dlg) {
  if (!dlg) return;
  if (dlg.close) dlg.close();
  else {
    dlg.classList.remove('open');
    dlg.removeAttribute('open');
  }
  // optional, damit der Safari-Workaround weiter gilt:
  dlg.style.display = 'none';
}
/* Ende Teil 5*/
/* Teil 6 Zeilen 1803-2068*/
/* ================= Dialog Logic: Fields/Systems/Data Objects/Columns/Domains ================= */
function updateSourceFieldSelect() {
  const sys = sourceSystemSelect?.value;
  const list = sys ? fields.filter((f) => f.system === sys) : [];
  if (!sourceFieldSelect) return;
  sourceFieldSelect.innerHTML = sys
    ? `<option value="">(select field)</option>` +
      list.map((f) => `<option value="${f.name}">${f.name}</option>`).join('')
    : `<option value="">Select a system first</option>`;
  sourceFieldSelect.disabled = !sys;
}

function openFieldDialog(index = null, opts = {}) {
  editFieldIndex = index;
  state.editFieldIndex = editFieldIndex;
  fieldForm?.reset();

  // Reaktives Nachladen der LE-Optionen bei System-/Local-Änderung
  fieldForm?.elements.system?.addEventListener('change', () => {
    const sysName = fieldForm.elements.system.value;
    const isLocal = !!(
      fieldForm.elements.local && fieldForm.elements.local.checked
    );
    populateLESelectForSystem(sysName, isLocal, legalEntitySelect?.value || '');
  });
  fieldForm?.elements.local?.addEventListener('change', () => {
    const sysName = fieldForm.elements.system.value;
    const isLocal = !!(
      fieldForm.elements.local && fieldForm.elements.local.checked
    );
    populateLESelectForSystem(sysName, isLocal, legalEntitySelect?.value || '');
  });

  if (!fieldForm) return;

  // System-Select
  if (systemSelect) {
    systemSelect.innerHTML = systems
      .map((s) => `<option value="${s.name}">${s.name}</option>`)
      .join('');
  }

  // ALT: value = f.name
  if (foundationSelect) {
    foundationSelect.innerHTML = dataObjects
      .map((o) => `<option value="${o.id}">${o.name}</option>`)
      .join('');
  }

  // Glossary-Select
  if (glossarySelect) {
    glossarySelect.innerHTML =
      `<option value="">(keine Zuordnung)</option>` +
      glossaryTerms
        .map((g) => `<option value="${g.id}">${g.term}</option>`)
        .join('');
  }

  // Source-System-Select
  if (sourceSystemSelect) {
    sourceSystemSelect.innerHTML =
      `<option value="">(originates here)</option>` +
      systems
        .map((s) => `<option value="${s.name}">${s.name}</option>`)
        .join('');
  }

  // System aus Kontext vorbelegen
  if (
    currentSystem !== 'ADMIN' &&
    currentSystem !== 'MAP' &&
    currentSystem !== 'GLOSSARY' &&
    currentSystem !== 'All Systems' &&
    isValidSystemName(currentSystem)
  ) {
    fieldForm.elements.system.value = currentSystem;
  }

  // Lokales Flag vorbelegen (z. B. aus Local-Tab)
  if (opts?.presetLocal && fieldForm.elements.local) {
    fieldForm.elements.local.checked = true;
  }

  // LE-Select initial befüllen (abhängig von System & Local)
  const curSystemName =
    fieldForm?.elements.system?.value || systems[0]?.name || '';
  const isLocalNow = !!fieldForm?.elements.local?.checked;
  populateLESelectForSystem(curSystemName, isLocalNow, '');

  // Falls mitgegebene LE-Nummer existiert, vorbelegen
  if (opts?.presetLegalEntityNumber && legalEntitySelect && !index) {
    // nur beim Neu-Anlegen sinnvoll
    const want = String(opts.presetLegalEntityNumber).trim();
    const hasOption = Array.from(legalEntitySelect.options).some(
      (o) => o.value === want
    );
    if (hasOption) {
      legalEntitySelect.value = want;
    }
  }

  if (index !== null) {
    const f = fields[index];

    // Grunddaten in die Form schreiben
    fieldForm.elements.name.value = f.name || '';
    fieldForm.elements.system.value =
      f.system || fieldForm.elements.system.value;
    if (fieldForm.elements.mandatory)
      fieldForm.elements.mandatory.checked = !!f.mandatory;
    if (fieldForm.elements.local) fieldForm.elements.local.checked = !!f.local;
    if (fieldForm.elements.mapping)
      fieldForm.elements.mapping.value = f.mapping || '';

    if (fieldForm.elements.foundationObject) {
      const val =
        f.foundationObjectId != null ? String(f.foundationObjectId) : '';
      fieldForm.elements.foundationObject.value = val;
    }

    // Glossary vorauswählen
    if (glossarySelect) glossarySelect.value = f.glossaryId || '';

    // LE-Select nach System/Local erneut passend befüllen & vorbelegen
    const editedLocal = !!(
      fieldForm.elements.local && fieldForm.elements.local.checked
    );
    populateLESelectForSystem(
      fieldForm.elements.system.value,
      editedLocal,
      fields[index].legalEntityNumber || ''
    );

    // Source-System/-Feld
    if (f.source?.system) {
      if (sourceSystemSelect) sourceSystemSelect.value = f.source.system;
      updateSourceFieldSelect();
      if (sourceFieldSelect) sourceFieldSelect.value = f.source.field || '';
    } else {
      if (sourceSystemSelect) sourceSystemSelect.value = '';
      updateSourceFieldSelect();
    }
  } else {
    // Neu: Source leer
    if (sourceSystemSelect) sourceSystemSelect.value = '';
    updateSourceFieldSelect();
  }

  openDialog(fieldDialog);
}

fieldForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  // 1) Form auslesen
  const data = Object.fromEntries(new FormData(fieldForm).entries());
  const pickedFoundationId = (
    fieldForm.elements.foundationObject?.value || ''
  ).trim();
  const pickedGlossaryId =
    (fieldForm.elements['fld-glossary']?.value || '').trim() || '';

  // Checkboxen korrekt auslesen
  data.mandatory = fieldForm.elements['fld-mandatory']?.checked || false;
  data.local = fieldForm.elements.local?.checked || false;

  // 2) Legal Entity nur zulassen, wenn erlaubt
  const sysNameForLE = data.system;
  const isLocalForLE = !!data.local;
  let pickedLENumber = (
    fieldForm.elements.legalEntityNumber?.value || ''
  ).trim();
  if (!eligibleForLE(sysNameForLE, isLocalForLE)) pickedLENumber = '';

  // 3) Merge/Create
  if (editFieldIndex !== null) {
    const next = { ...fields[editFieldIndex], ...data };
    if (pickedFoundationId) next.foundationObjectId = pickedFoundationId;
    else delete next.foundationObjectId;
    if (pickedGlossaryId) next.glossaryId = pickedGlossaryId;
    else delete next.glossaryId;
    if (pickedLENumber) next.legalEntityNumber = pickedLENumber;
    else delete next.legalEntityNumber;
    fields[editFieldIndex] = next;
  } else {
    const rec = { id: uid('fld'), ...data };
    if (pickedFoundationId) rec.foundationObjectId = pickedFoundationId;
    if (pickedGlossaryId) rec.glossaryId = pickedGlossaryId;
    if (pickedLENumber) rec.legalEntityNumber = pickedLENumber;
    fields.push(rec);
  }

  // 4) Persist & UI refresh
  saveFields();
  renderFieldsTable();
  if (document.body.getAttribute('data-mode') === 'map') renderDataMap();
  closeDialog(fieldDialog);
});

function openSystemDialog(index = null) {
  editSystemIndex = index;
  state.editSystemIndex = editSystemIndex;
  systemForm?.reset();
  if (!systemForm) return;

  if (systemDomainSelect) {
    systemDomainSelect.innerHTML =
      `<option value="">(unassigned)</option>` +
      getDomainNames()
        .map((n) => `<option value="${n}">${n}</option>`)
        .join('');
  }
  if (index !== null) {
    const s = systems[index];
    systemForm.elements.name.value = s.name;
    systemForm.elements.owner.value = s.owner || '';
    systemForm.elements.version.value = s.version || '';
    systemForm.elements.scope.value = s.scope || 'both';
    systemForm.elements.dataDomain.value = s.dataDomain || '';
  } else {
    systemForm.elements.scope.value = 'both';
  }
  openDialog(systemDialog);
}
systemForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(systemForm).entries());
  if (editSystemIndex !== null) {
    const old = systems[editSystemIndex];
    const oldName = old.name;
    systems[editSystemIndex] = { ...old, ...data };
    if (oldName !== data.name) {
      fields = fields.map((f) =>
        f.system === oldName ? { ...f, system: data.name } : f
      );
      fields = fields.map((f) =>
        f.source?.system === oldName
          ? { ...f, source: { ...f.source, system: data.name } }
          : f
      );
      state.fields = fields;
      if (currentSystem === oldName) {
        currentSystem = data.name;
        state.currentSystem = currentSystem;
      }
    }
    // id bleibt erhalten
  } else {
    systems.push({ id: uid('sys'), ...data });
    saveSystems();
  }
  saveSystems();
  renderSystemsSidebar();
  renderSystemsTable();
  renderFieldsTable();
  if (document.body.getAttribute('data-mode') === 'map') renderDataMap();
  closeDialog(systemDialog);
});

function openColumnDialog(index = null) {
  editColumnIndex = index;
  state.editColumnIndex = editColumnIndex;
  columnForm?.reset();
  if (!columnForm) return;
  if (index !== null) {
    const c = fieldColumns[index];
    columnForm.elements.name.value = c.name;
    columnForm.elements.visible.checked = !!c.visible;
    columnForm.elements.order.value = c.order ?? 1;
  }
  openDialog(columnDialog);
}
columnForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(columnForm).entries());
  data.visible = columnForm.elements.visible.checked;
  data.order = data.order ? Number(data.order) : 1;
  if (editColumnIndex !== null) fieldColumns[editColumnIndex] = data;
  else fieldColumns.push(data);
  saveColumns();
  renderColumnsTable();
  renderFieldsTable();
  closeDialog(columnDialog);
});

function openDomainDialog(index = null) {
  editDomainIndex = index;
  state.editDomainIndex = editDomainIndex;
  domainForm?.reset();
  if (!domainForm) return;
  if (index !== null) {
    const d = dataDomains[index];
    domainForm.elements.name.value = d.name;
    domainForm.elements.manager.value = d.manager || '';
    domainForm.elements.active.checked = !!d.active;
    domainForm.elements.color.value = d.color || '#6a6a6a';
  } else {
    domainForm.elements.active.checked = true;
    domainForm.elements.color.value = '#6a6a6a';
  }
  openDialog(domainDialog);
}
domainForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(domainForm).entries());
  data.active = domainForm.elements.active.checked;
  if (editDomainIndex !== null) dataDomains[editDomainIndex] = data;
  else dataDomains.push(data);
  renderDomainsTable();
  renderSystemsSidebar();
  renderSystemsTable();
  if (document.body.getAttribute('data-mode') === 'map') renderDataMap();
  if (systemDomainSelect) {
    systemDomainSelect.innerHTML =
      `<option value="">(unassigned)</option>` +
      getDomainNames()
        .map((n) => `<option value="${n}">${n}</option>`)
        .join('');
  }
  closeDialog(domainDialog);
});
/* Ende Teil 6*/
/* Teil 7 Zeilen 2069-2449*/
/* ==================== Data Map: Edges & Interaktion ==================== */
function makeEdgeDefs() {
  if (!mapEdgesSvg) return;
  let defs = mapEdgesSvg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    mapEdgesSvg.appendChild(defs);
  }
  let marker = defs.querySelector('#arrowHead');
  if (!marker) {
    marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowHead');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerWidth', '9');
    marker.setAttribute('markerHeight', '9');
    marker.setAttribute('refX', '7.2');
    marker.setAttribute('refY', '4.5');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M0,0 L9,4.5 L0,9 Z');
    p.setAttribute('fill', 'currentColor');
    marker.appendChild(p);
    defs.appendChild(marker);
  }
}
function hexWithAlpha(hex, a) {
  try {
    const c = hex.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16),
      g = parseInt(c.slice(2, 4), 16),
      b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  } catch {
    return 'rgba(0,0,0,.06)';
  }
}
function computeNodePositions(nodeEntries = []) {
  const positions = new Map();
  const padding = 40;
  const baseX = 40;
  const occupied = [];

  nodeEntries.forEach(({ sys, node }) => {
    const existing = mapPositions[sys.name];
    if (existing) {
      const x = Number(existing.x) || 0;
      const y = Number(existing.y) || 0;
      positions.set(sys.name, { x, y });
      occupied.push({
        x,
        y,
        width: node.offsetWidth || 0,
        height: node.offsetHeight || 0,
      });
    }
  });

  let currentY = occupied.length
    ? occupied.reduce(
        (max, item) => Math.max(max, item.y + item.height + padding),
        baseX
      )
    : baseX;

  nodeEntries.forEach(({ sys, node }) => {
    if (positions.has(sys.name)) return;
    const height = node.offsetHeight || 0;
    const x = baseX;
    const y = currentY;
    positions.set(sys.name, { x, y });
    occupied.push({ x, y, width: node.offsetWidth || 0, height });
    currentY += height + padding;
  });

  return positions;
}
function getNodeEl(name) {
  return mapNodesLayer?.querySelector(
    `.map-node[data-system="${CSS.escape(name)}"]`
  );
}
function getFieldEl(systemName, fieldName) {
  return mapNodesLayer?.querySelector(
    `.map-field[data-system="${CSS.escape(
      systemName
    )}"][data-field="${CSS.escape(fieldName)}"]`
  );
}
function rectToMap(rect) {
  if (!mapCanvas) return { left: 0, right: 0, top: 0, bottom: 0 };
  const canvasRect = mapCanvas.getBoundingClientRect();
  return {
    left:
      (rect.left - canvasRect.left - mapTransformState.x) / mapTransformState.k,
    right:
      (rect.right - canvasRect.left - mapTransformState.x) /
      mapTransformState.k,
    top:
      (rect.top - canvasRect.top - mapTransformState.y) / mapTransformState.k,
    bottom:
      (rect.bottom - canvasRect.top - mapTransformState.y) /
      mapTransformState.k,
  };
}
function fieldAnchor(systemName, fieldName, side = 'right') {
  // Canvas/Viewport defensiv bestimmen (je nachdem, was du wirklich im DOM hast)
  const canvas =
    document.getElementById('mapViewport') ||
    document.getElementById('mapCanvas') ||
    document.querySelector('#mapViewport, #mapCanvas');

  const row  = getFieldEl(systemName, fieldName);
  if (!canvas || !row) {
    // Fallback verhindert Crash, Linien werden in diesem Fall einfach nicht gezeichnet
    return { x: 0, y: 0, _invalid: true };
  }

  const node = row.closest('.map-node') || row;
  const canvasRect = canvas.getBoundingClientRect();
  const rowRect    = row.getBoundingClientRect();
  const nodeRect   = node.getBoundingClientRect();

  const OUTSIDE = 14; // Abstand außerhalb des Knotens
  const yAbs = rowRect.top + rowRect.height / 2;
  const xAbs = (side === 'right') ? (nodeRect.right + OUTSIDE)
                                  : (nodeRect.left  - OUTSIDE);

  // mapTransformState defensiv (falls noch nicht initialisiert)
  const mts = window.mapTransformState || { x: 0, y: 0, k: 1 };

  const x = (xAbs - canvasRect.left - mts.x) / (mts.k || 1);
  const y = (yAbs - canvasRect.top  - mts.y) / (mts.k || 1);

  return { x, y };
}
function orthoPath(p1, p2) {
  const dx = p2.x - p1.x;
  const sign = dx >= 0 ? 1 : -1;
  const base = Math.abs(dx) * 0.4;
  const offset = Math.min(Math.max(base, 40), 180);
  const c1x = p1.x + sign * offset;
  const c2x = p2.x - sign * offset;
  const c1y = p1.y;
  const c2y = p2.y;
  return `M ${p1.x},${p1.y} C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
}
function clearEdgesKeepDefs() {
  if (!mapEdgesSvg) return;
  const defs = mapEdgesSvg.querySelector('defs');
  mapEdgesSvg.innerHTML = '';
  if (defs) mapEdgesSvg.appendChild(defs);
}
function drawEdgePath(d, arrow = true, cls = '') {
  if (!mapEdgesSvg) return;
  const halo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  halo.setAttribute('d', d);
  halo.setAttribute('class', 'edge-halo' + (cls ? ` ${cls}` : ''));
  halo.setAttribute('fill', 'none');
  halo.setAttribute('stroke', 'rgba(255,255,255,.95)');
  halo.setAttribute('stroke-width', '6');
  halo.setAttribute('stroke-linecap', 'round');
  halo.setAttribute('stroke-linejoin', 'round');
  halo.setAttribute('vector-effect', 'non-scaling-stroke');
  mapEdgesSvg.appendChild(halo);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute(
    'class',
    'edge-path' + (arrow ? ' arrowed' : '') + (cls ? ` ${cls}` : '')
  );
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  mapEdgesSvg.appendChild(path);
}
function systemPassesFilters(sysName) {
  const sys = systems.find((s) => s.name === sysName);
  if (!sys) return false;
  if (mapFilters.systems.length && !mapFilters.systems.includes(sysName))
    return false;
  if (
    mapFilters.domains.length &&
    sys.dataDomain &&
    !mapFilters.domains.includes(sys.dataDomain)
  )
    return false;
  return true;
}
function fieldPassesFilters(f) {
  const sysSel = mapFilters.systems.length ? new Set(mapFilters.systems) : null;
  if (sysSel && !sysSel.has(f.system)) return false;
  const sys = systems.find((s) => s.name === f.system);
  const domSel = mapFilters.domains.length ? new Set(mapFilters.domains) : null;
  if (domSel && sys?.dataDomain && !domSel.has(sys.dataDomain)) return false;
  if (mapFilters.scope.global === false && !f.local) return false;
  if (mapFilters.scope.local === false && f.local) return false;
  if (mapFilters.search && !f.name.toLowerCase().includes(mapFilters.search))
    return false;
  return true;
}
function clearSelectionVisuals() {
  clearEdgesKeepDefs();
  $$('.map-field.is-highlight')?.forEach((el) =>
    el.classList.remove('is-highlight')
  );
}
function drawSelectedFieldEdges() {
  clearSelectionVisuals();
  if (!selectedFieldRef) return;
  const { system, field } = selectedFieldRef;
  const srcEl = getFieldEl(system, field);
  if (srcEl) srcEl.classList.add('is-highlight');

  const outgoing = fields.filter(
    (f) => f.source?.system === system && (f.source.field || f.name) === field
  );
  const incoming = fields.filter(
    (f) => f.system === system && f.name === field && f.source?.system
  );

  outgoing.forEach((tgt) => {
    const p1 = fieldAnchor(system, field, 'right');
    const p2 = fieldAnchor(tgt.system, tgt.name, 'left');
    const tgtEl = getFieldEl(tgt.system, tgt.name);
    tgtEl?.classList.add('is-highlight');
    drawEdgePath(orthoPath(p1, p2), true, 'edge-selected');
  });
  incoming.forEach((src) => {
    const p1 = fieldAnchor(
      src.source.system,
      src.source.field || src.name,
      'right'
    );
    const p2 = fieldAnchor(system, field, 'left');
    const srcRow = getFieldEl(src.source.system, src.source.field || src.name);
    srcRow?.classList.add('is-highlight');
    drawEdgePath(orthoPath(p1, p2), true, 'edge-selected');
  });
}

// Optional: Alias für alte Aufrufe
window.DrawSystemEdges = drawSystemEdges;

function buildChipList(container, items, selectedSet, onChange) {
  container.innerHTML = '';
  items.forEach((val) => {
    const id = `chip-${val.replace(/\s+/g, '_')}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const label = document.createElement('label');
    label.className = 'chip';
    label.innerHTML = `<input type="checkbox" id="${id}" ${
      selectedSet.has(val) ? 'checked' : ''
    } /><span>${val}</span>`;
    const input = label.querySelector('input');
    input.addEventListener('change', () => {
      if (input.checked) selectedSet.add(val);
      else selectedSet.delete(val);
      onChange(selectedSet);
    });
    container.appendChild(label);
  });
}
function openFilterOverlay() {
  const sysSet = new Set(mapFilters.systems);
  const domSet = new Set(mapFilters.domains);
  buildChipList(
    chipSystems,
    systems.map((s) => s.name),
    sysSet,
    (set) => {
      mapFilters.systems = [...set];
      saveFilters();
      renderDataMap();
    }
  );
  buildChipList(chipDomains, getDomainNames(), domSet, (set) => {
    mapFilters.domains = [...set];
    saveFilters();
    renderDataMap();
  });
  if (scopeGlobal) scopeGlobal.checked = !!mapFilters.scope.global;
  if (scopeLocal) scopeLocal.checked = !!mapFilters.scope.local;
  if (mapSearch) mapSearch.value = mapFilters.search || '';
  if (scopeGlobal)
    scopeGlobal.onchange = () => {
      mapFilters.scope.global = scopeGlobal.checked;
      saveFilters();
      renderDataMap();
    };
  if (scopeLocal)
    scopeLocal.onchange = () => {
      mapFilters.scope.local = scopeLocal.checked;
      saveFilters();
      renderDataMap();
    };
  if (mapSearch)
    mapSearch.oninput = () => {
      mapFilters.search = (mapSearch.value || '').trim().toLowerCase();
      saveFilters();
      renderDataMap();
    };
  filterOverlay?.classList.remove('hidden');
  filterOverlay?.setAttribute('aria-hidden', 'false');
}
function closeFilterOverlay() {
  filterOverlay?.classList.add('hidden');
  filterOverlay?.setAttribute('aria-hidden', 'true');
}

/* Render Map */
function renderDataMap() {
  makeEdgeDefs();
  clearEdgesKeepDefs();
  if (!mapNodesLayer) return;
  mapNodesLayer.innerHTML = '';

  const nodeEntries = [];

  systems.forEach((sys) => {
    if (!systemPassesFilters(sys.name)) return;

    const node = document.createElement('div');
    node.className = 'map-node';
    node.dataset.system = sys.name;
    const dom = domainByName(sys.dataDomain || '');
    const color = dom?.color || '#9aa0a6';
    node.style.borderColor = color;

    const header = document.createElement('div');
    header.className = 'map-node-header';
    header.style.background =
      'linear-gradient(0deg, rgba(0,0,0,0) 0%, ' +
      hexWithAlpha(color, 0.08) +
      ' 100%)';

    const collapsed = !!nodeCollapsed.get(sys.name);
    header.innerHTML = `<div class="map-node-title">${
      sys.name
    }</div><button class="map-node-toggle">${
      collapsed ? 'Expand' : 'Collapse'
    }</button>`;
    node.appendChild(header);
    if (collapsed) node.classList.add('is-collapsed');

    const wrap = document.createElement('div');
    wrap.className = 'map-node-fields';

    let list = getFieldsBySystem(sys.name).filter(fieldPassesFilters);
    if (list.length > 10) wrap.classList.add('is-scroll');
    else wrap.classList.remove('is-scroll');

    list.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'map-field is-selectable';
      row.dataset.system = sys.name;
      row.dataset.field = f.name;

      const chev = document.createElement('div');
      chev.className = 'chev';
      chev.title = 'Toggle details';
      const name = document.createElement('div');
      name.className = 'map-field-name';
      name.textContent = f.name;
      name.title = 'Show connections';
      const right = document.createElement('div');
      right.className = 'map-field-badges';
      if (f.source?.system) {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = 'from ' + f.source.system;
        right.appendChild(b);
      }

      row.appendChild(chev);
      row.appendChild(name);
      row.appendChild(right);
      wrap.appendChild(row);

      const details = document.createElement('div');
      details.className = 'map-field-details';
      details.innerHTML = `
        <div><strong>Mandatory:</strong> ${f.mandatory ? 'Yes' : 'No'}</div>
        <div><strong>Mapping:</strong> ${f.mapping || '-'}</div>
        <div><strong>Data Object:</strong> ${foundationLabelForField(f)}</div>
        <div><strong>Source:</strong> ${
          f.source?.system
            ? `${f.source.system} • ${f.source.field || f.name}`
            : '—'
        }</div>
      `;
      wrap.appendChild(details);

      chev.addEventListener('click', (ev) => {
        ev.stopPropagation();
        row.classList.toggle('is-open');
      });

      name.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (
          selectedFieldRef &&
          selectedFieldRef.system === sys.name &&
          selectedFieldRef.field === f.name
        ) {
          selectedFieldRef = null;
          state.selectedFieldRef = selectedFieldRef;
          clearSelectionVisuals();
        } else {
          selectedFieldRef = { system: sys.name, field: f.name };
          state.selectedFieldRef = selectedFieldRef;
          drawSelectedFieldEdges();
        }
      });
    });

    header.querySelector('.map-node-toggle').addEventListener('click', (ev) => {
      ev.stopPropagation();
      node.classList.toggle('is-collapsed');
      nodeCollapsed.set(sys.name, node.classList.contains('is-collapsed'));
      if (selectedFieldRef) { drawSelectedFieldEdges(); } else { safeDrawAllEdges(); }
    });

    node.appendChild(wrap);
    mapNodesLayer.appendChild(node);
    nodeEntries.push({ sys, node, header });
  });

  const pos = computeNodePositions(nodeEntries);

  nodeEntries.forEach(({ sys, node, header }) => {
    const stored = mapPositions[sys.name];
    const fallback = stored
      ? { x: Number(stored.x) || 40, y: Number(stored.y) || 40 }
      : { x: 40, y: 40 };
    const p = pos.get(sys.name) || fallback;
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
    mapPositions[sys.name] = { x: p.x, y: p.y };
    enableDrag(node, header, sys.name);
  });

  if (selectedFieldRef) { drawSelectedFieldEdges(); } else { safeDrawAllEdges(); }

  requestAnimationFrame(() => fitMapToContent());
}

/* Drag mit Persistenz */
function rectsOverlap(a, b, gap = 0) {
  return !(
    a.x + a.width <= b.x - gap ||
    a.x >= b.x + b.width + gap ||
    a.y + a.height <= b.y - gap ||
    a.y >= b.y + b.height + gap
  );
}

function isNodePositionFree(node, candidate, name) {
  const nodes = mapNodesLayer?.querySelectorAll('.map-node');
  if (!nodes) return true;
  const current = {
    x: candidate.x,
    y: candidate.y,
    width: node.offsetWidth || 0,
    height: node.offsetHeight || 0,
  };
  const gap = 16;
  for (const other of nodes) {
    if (other === node) continue;
    const otherName = other.dataset.system;
    if (!otherName || otherName === name) continue;
    const stored = mapPositions[otherName];
    const ox = stored
      ? Number(stored.x) || 0
      : parseFloat(other.style.left) || 0;
    const oy = stored
      ? Number(stored.y) || 0
      : parseFloat(other.style.top) || 0;
    const rect = {
      x: ox,
      y: oy,
      width: other.offsetWidth || 0,
      height: other.offsetHeight || 0,
    };
    if (rectsOverlap(current, rect, gap)) return false;
  }
  return true;
}

function enableDrag(node, handle, name) {
  let dragging = false,
    start = { x: 0, y: 0 },
    startPos = { x: 0, y: 0 },
    lastValid = null;
  handle.style.cursor = 'grab';
  handle.addEventListener('mousedown', (e) => {
    const isInteractive = e.target.closest(
      'button, a, [role="button"], .map-node-toggle, .chev'
    );
    if (e.button !== 0 || isInteractive) return;
    dragging = true;
    handle.style.cursor = 'grabbing';
    start = { x: e.clientX, y: e.clientY };
    const rect = node.getBoundingClientRect(),
      parentRect = mapCanvas.getBoundingClientRect();
    startPos = {
      x: rect.left - parentRect.left - mapTransformState.x,
      y: rect.top - parentRect.top - mapTransformState.y,
    };
    lastValid = {
      x: parseFloat(node.style.left) || 0,
      y: parseFloat(node.style.top) || 0,
    };
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - start.x) / mapTransformState.k,
      dy = (e.clientY - start.y) / mapTransformState.k;
    const nx = startPos.x + dx,
      ny = startPos.y + dy;
    if (!isNodePositionFree(node, { x: nx, y: ny }, name)) return;
    node.style.left = `${nx}px`;
    node.style.top = `${ny}px`;
    lastValid = { x: nx, y: ny };
    mapPositions[name] = { x: nx, y: ny };
    if (selectedFieldRef) drawSelectedFieldEdges();
    else clearSelectionVisuals();
  });
  window.addEventListener('mouseup', () => {
    if (dragging) {
      if (lastValid) mapPositions[name] = { ...lastValid };
      savePositions();
      if (selectedFieldRef) drawSelectedFieldEdges();
      else clearSelectionVisuals();
    }
    dragging = false;
    handle.style.cursor = 'grab';
  });
}

/* Pan/Zoom + Reset bei Klick auf freien Bereich */
function applyMapTransform() {
  if (!mapViewport) return;
  mapViewport.style.transform = `translate(${mapTransformState.x}px, ${mapTransformState.y}px) scale(${mapTransformState.k})`;
}

/* Fit-Helper */
function fitMapToContent() {
  const nodes = mapNodesLayer?.querySelectorAll('.map-node');
  if (!nodes || !nodes.length) return;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  nodes.forEach((n) => {
    const x = parseFloat(n.style.left) || 0,
      y = parseFloat(n.style.top) || 0,
      w = n.offsetWidth || 340,
      h = n.offsetHeight || 240;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  if (!mapCanvas) return;
  const vw = mapCanvas.clientWidth,
    vh = mapCanvas.clientHeight,
    cw = maxX - minX + 120,
    ch = maxY - minY + 120;
  const k = Math.min(vw / cw, vh / ch, 1.2);
  mapTransformState.k = Math.max(0.6, Math.min(2.5, k));
  mapTransformState.x =
    20 + (vw - cw * mapTransformState.k) / 2 - minX * mapTransformState.k + 20;
  mapTransformState.y =
    20 + (vh - ch * mapTransformState.k) / 2 - minY * mapTransformState.k + 20;
  applyMapTransform();
  if (selectedFieldRef) drawSelectedFieldEdges();
  else clearSelectionVisuals();
}

/* ===== Error banner helper ===== */
function ensureErrorBanner() {
  let b = document.getElementById('appError');
  if (!b) {
    b = document.createElement('div');
    b.id = 'appError';
    b.className = 'app-error';
    document.body.appendChild(b);
  }
  return b;
}
function showErrorBanner(msg) {
  const b = ensureErrorBanner();
  b.textContent = msg;
  b.style.display = 'block';
}

/* ===== Globaler Fehlerfänger ===== */
window.addEventListener('error', (e) => {
  showErrorBanner(`JS error: ${e.message}`);
  console.error(e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  showErrorBanner(`Promise rejection: ${e.reason}`);
  console.error(e.reason);
});
/* Ende Teil 7*/
/* Teil 8 Zeilen 2450-2705
/* ===== Safe-init (alle Listener nur hier registrieren) ===== */
function initializeApp() {
  console.log('[script.js] initializeApp() gestartet');

  // Verhindert, dass Dialog-Inhalte ohne "open" sichtbar sind (Safari/Preview)
  document.querySelectorAll('dialog').forEach((dlg) => {
    if (!dlg.hasAttribute('open') && !dlg.classList.contains('open')) {
      dlg.style.display = 'none';
    }
  });
  try {
    // =============================
    //  Element-Referenzen (lokal)
    // =============================
    const systemsNavItem = document.getElementById('systemsNavItem');
    const dataMapNavItem = document.getElementById('dataMapNavItem');
    const glossaryNavItem = document.getElementById('glossaryNavItem');
    const adminNavItem = document.getElementById('adminNavItem');

    // =============================
    //  Navigation: Klick-Handler
    // =============================

    // Systems (Hauptansicht)
    systemsNavItem?.addEventListener('click', () => {
      currentSystem = 'All Systems';
      state.currentSystem = currentSystem;
      selectedFieldRef = null;
      state.selectedFieldRef = selectedFieldRef;
      clearSelectionVisuals();
      document.body.setAttribute('data-mode', 'systems');
      showOnly('systems');
      showGlossarySubnav(false);
      setModeSystems('All Systems'); // rendert Sidebar + Tabellen
    });
    // Data Map
    dataMapNavItem?.addEventListener('click', () => {
      document.body.setAttribute('data-mode', 'map');
      showOnly('map');
      showGlossarySubnav(false);
      try {
        renderDataMap();
        fitMapToContent();
      } catch (e) {
        console.error(e);
        showErrorBanner(`Data Map konnte nicht gerendert werden: ${e.message}`);
      }
    });

    // Glossary
    glossaryNavItem?.addEventListener('click', () => {
      document.body.setAttribute('data-mode', 'glossary');
      showOnly('glossary');
      showGlossarySubnav(true);
      installGlossarySubnavHandlers(); // Filter-Buttons einmalig anbinden

      try {
        // Wichtig: NICHT renderGlossaryTable() direkt aufrufen,
        // sondern die Wrapper-Funktion, die auch den Header baut:
        renderGlossary();
      } catch (e) {
        console.error(e);
      }
    });

    // Admin
    adminNavItem?.addEventListener('click', () => {
      document.body.setAttribute('data-mode', 'admin');
      showOnly('admin');
      showGlossarySubnav(false);
      try {
        // Default-Tab wählen und rendern
        const firstTab =
          document.querySelector(
            '#adminTabs .tab[data-admin-tab="admin-domains"]'
          ) || document.querySelector('#adminTabs .tab');
        if (firstTab) {
          document
            .querySelectorAll('#adminTabs .tab')
            .forEach((t) => t.classList.remove('is-active'));
          firstTab.classList.add('is-active');
          showAdminSubview(firstTab.dataset.adminTab || 'admin-domains');
        }
      } catch (e) {
        console.error(e);
      }
    });

    // =============================
    //  Top-Tabs (Systems-Ansicht)
    // =============================
    document.querySelectorAll('#topTabs .tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        if (tab.style.display === 'none') return;
        document
          .querySelectorAll('#topTabs .tab')
          .forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const view = tab.dataset.tab;
        const globalEl = document.getElementById('global');
        const localEl = document.getElementById('local');
        if (globalEl)
          globalEl.style.display = view === 'global' ? 'block' : 'none';
        if (localEl)
          localEl.style.display = view === 'local' ? 'block' : 'none';
        try {
          renderFieldsTable();
        } catch (e) {
          console.error(e);
        }
      });
    });

    // =============================
    //  Admin-Tabs
    // =============================
    document.querySelectorAll('#adminTabs .tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document
          .querySelectorAll('#adminTabs .tab')
          .forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const target = tab.dataset.adminTab;
        if (target) showAdminSubview(target);
      });
    });

    // =============================
    //  Globale Button-Delegation (New-Buttons)
    // =============================
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('#addFieldBtn')) openFieldDialog(null);
      if (t.closest('#addLocalFieldBtn'))
        openFieldDialog(null, { presetLocal: true });
      if (t.closest('#addSystemBtn')) openSystemDialog(null);
      if (t.closest('#addColumnBtn')) openColumnDialog(null);
      if (t.closest('#addDomainBtn')) openDomainDialog(null);
      if (t.closest('#addLegalBtn')) openLegalDialog(null);
      if (t.closest('#addGlossaryBtn')) openGlossaryDialog(null);
      if (t.closest('#addDataObjectBtn')) openDataObjectDialog(null);
    });

    // =============================
    //  Dialog Cancel-Buttons
    // =============================
    $$('dialog .btn-cancel').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeDialog(btn.closest('dialog'));
      });
    });

    // =============================
    //  Field-Dialog: Source System -> Source Field
    // =============================
    sourceSystemSelect?.addEventListener('change', updateSourceFieldSelect);

    // =============================
    //  Filter Overlay
    // =============================
    openFilterPanelBtn?.addEventListener('click', openFilterOverlay);
    filterCloseBtn?.addEventListener('click', closeFilterOverlay);
    filterDone?.addEventListener('click', closeFilterOverlay);
    filterClear?.addEventListener('click', () => {
      mapFilters = {
        systems: [],
        domains: [],
        scope: { global: true, local: true },
        search: '',
      };
      state.mapFilters = mapFilters;
      saveFilters();
      buildChipList(
        chipSystems,
        systems.map((s) => s.name),
        new Set(),
        (set) => {
          mapFilters.systems = [...set];
          saveFilters();
          renderDataMap();
        }
      );
      buildChipList(chipDomains, getDomainNames(), new Set(), (set) => {
        mapFilters.domains = [...set];
        saveFilters();
        renderDataMap();
      });
      if (scopeGlobal) scopeGlobal.checked = true;
      if (scopeLocal) scopeLocal.checked = true;
      if (mapSearch) mapSearch.value = '';
      renderDataMap();
    });
    filterOverlay?.addEventListener('click', (e) => {
      if (e.target.classList?.contains('overlay-backdrop'))
        closeFilterOverlay();
    });

    // === Section-Action Buttons ===
    document
      .getElementById('btnGlobalFilter')
      ?.addEventListener('click', () => {
        showGlobalFilters = !showGlobalFilters;
        state.showGlobalFilters = showGlobalFilters;
        // Header neu aufbauen (zeigt/versteckt Filterzeile) + tbody aktualisieren
        renderFieldsTable();
      });

    document.getElementById('btnGlobalNew')?.addEventListener('click', () => {
      openFieldDialog(null); // neues Feld (global)
    });

    document
      .getElementById('btnGlobalExport')
      ?.addEventListener('click', () => {
        // Exportiert die Global-Tabelle
        exportSingleTableAsXlsx('#global .table', 'Global_DataFields.xlsx');
      });

    document.getElementById('btnLocalFilter')?.addEventListener('click', () => {
      showLocalFilters = !showLocalFilters;
      state.showLocalFilters = showLocalFilters;
      renderLocalFieldsTables();
    });

    document.getElementById('btnLocalNew')?.addEventListener('click', () => {
      openFieldDialog(null, { presetLocal: true });
    });

    document.getElementById('btnLocalExport')?.addEventListener('click', () => {
      // Exportiert alle lokalen Tabellen zusammenhängend
      const tables = Array.from(
        document.querySelectorAll('#localTables table.table')
      );
      if (!tables.length) {
        alert('Keine Local-Tabellen gefunden.');
        return;
      }
      exportMultipleTablesAsXlsx(tables, 'Local_DataFields.xlsx');
    });

    // =============================
    //  Map Interaktionen
    // =============================
    mapCanvas?.addEventListener('mousedown', (e) => {
      if (
        e.target === mapCanvas ||
        e.target === mapViewport ||
        e.target === mapEdgesSvg
      ) {
        selectedFieldRef = null;
        state.selectedFieldRef = selectedFieldRef;
        clearSelectionVisuals();
      }
      if (e.button !== 0) return;
      isPanning = true;
      state.isPanning = isPanning;
      panStart = {
        x: e.clientX - mapTransformState.x,
        y: e.clientY - mapTransformState.y,
      };
      state.panStart = panStart;
    });
    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      mapTransformState.x = e.clientX - panStart.x;
      mapTransformState.y = e.clientY - panStart.y;
      applyMapTransform();
      if (selectedFieldRef) drawSelectedFieldEdges();
      else clearSelectionVisuals();
    });
    window.addEventListener('mouseup', () => {
      isPanning = false;
      state.isPanning = isPanning;
    });
    mapCanvas?.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9,
          prev = mapTransformState.k,
          next = Math.min(3, Math.max(0.4, prev * factor));
        const r = mapCanvas.getBoundingClientRect(),
          mx = e.clientX - r.left,
          my = e.clientY - r.top;
        mapTransformState.x = mx - (mx - mapTransformState.x) * (next / prev);
        mapTransformState.y = my - (my - mapTransformState.y) * (next / prev);
        mapTransformState.k = next;
        applyMapTransform();
        if (selectedFieldRef) drawSelectedFieldEdges();
        else clearSelectionVisuals();
      },
      { passive: false }
    );

    window.addEventListener('resize', () => {
      if (document.body.getAttribute('data-mode') === 'map') fitMapToContent();
    });

    function installMapArrowMarker() {
      const svg = document.getElementById('mapEdges');
      if (!svg) return;

      // Bestehendes <defs> ggf. entfernen, um doppelte Marker zu vermeiden
      const oldDefs = svg.querySelector('defs');
      if (oldDefs) oldDefs.remove();

      const defs = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'defs'
      );

      // Kleiner, dezenter Pfeil – userSpaceOnUse = keine Überraschungen bei Skalierung
      const marker = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'marker'
      );
      marker.setAttribute('id', 'arrowHead');
      marker.setAttribute('markerUnits', 'userSpaceOnUse');
      marker.setAttribute('markerWidth', '9'); // kompakt
      marker.setAttribute('markerHeight', '9');
      marker.setAttribute('refX', '9'); // sitzt exakt am Linienende
      marker.setAttribute('refY', '4.5');
      marker.setAttribute('orient', 'auto-start-reverse'); // korrekte Ausrichtung

      // Dreieck (Pfeil) – nutzt currentColor -> folgt Kantenfarbe
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      );
      // Ein kompaktes, leicht „weiches“ Dreieck
      path.setAttribute('d', 'M0,0 L0,9 L9,4.5 Z');
      path.setAttribute('fill', 'currentColor');
      path.setAttribute('opacity', '0.85');

      marker.appendChild(path);
      defs.appendChild(marker);
      svg.prepend(defs); // voranstellen -> sichergestellt, dass es vorhanden ist
    }

    // >>> Rufe das NACH dem Erzeugen des SVG-Layers genau einmal auf:
    installMapArrowMarker();
    /* Ende Teil 8*/
    /* Teil 9 Zeilen 2706-3035*/
    // =============================
    //  Persistenz laden
    // =============================
    loadColumns();
    loadSystems();
    function ensureColumnExists(name, order = 99, visible = true) {
      if (!fieldColumns.some((c) => c.name === name)) {
        fieldColumns.push({ name, visible, order });
        saveColumns(); // optional, damit es bestehen bleibt
      }
    }

    // ...
    // Persistenz laden
    loadPositions();
    loadFilters();
    loadLeSystems();
    loadGlossary();
    loadFields();

    // NEU: sicherstellen, dass "Definition" existiert
    ensureColumnExists('Definition', 6, true);
    ensureColumnExists('Legal Entity', 7, true);

    (function migrateFoundationToDataObjectColumn() {
      const idx = fieldColumns.findIndex((c) => c.name === 'Foundation Data');
      if (idx > -1) {
        fieldColumns[idx].name = 'Data Object';
        try {
          saveColumns();
        } catch {}
      }
    })();

    (function ensureDefinitionColumn() {
      if (!fieldColumns.some((c) => c.name === 'Definition')) {
        fieldColumns.push({
          name: 'Definition',
          visible: true,
          order: fieldColumns.length + 1,
        });
        try {
          saveColumns();
        } catch {}
      }
    })();

    (function migrateFieldFoundationObjectToId() {
      let changed = false;
      fields.forEach((f) => {
        // Wenn neue ID nicht existiert, aber alter Name vorhanden ist -> auflösen
        if (
          (f.foundationObjectId == null || f.foundationObjectId === '') &&
          f.foundationObject
        ) {
          const obj = getDataObjectByName(f.foundationObject);
          if (obj) {
            f.foundationObjectId = obj.id;
            changed = true;
          }
          // Alten String-Wert entfernen (deprecate)
          delete f.foundationObject;
        }
      });
      if (changed && typeof saveFields === 'function') saveFields();
    })();

    // =============================
    //  Initiale Ansicht
    // =============================
    currentSystem = 'All Systems';
    state.currentSystem = currentSystem;
    document.body.setAttribute('data-mode', 'systems');
    showOnly('systems');
    setModeSystems('All Systems');

    // Map QoL
    mapFitBtn?.addEventListener('click', fitMapToContent);
    refreshFoundationSelect();
    renderDataObjects(); // falls Tabelle vorhanden

    // =============================
    //  Glossary Overlay bei Klick auf Definition
    // =============================
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.glossary-link');
      if (link) {
        const id = link.dataset.id;
        const term = glossaryTerms.find((g) => g.id === id);
        if (!term) return;
        alert(
          `${term.term}\n\n${term.definition || '(no definition available)'}`
        );
        // Hinweis: später kann hier statt alert() ein eigenes Overlay kommen
      }
    });

    console.log('[gdf] Init complete.');
  } catch (e) {
    showErrorBanner(`Init failed: ${e.message}`);
    console.error(e);
  }
}

// ===== App-Start (DOM-sicher) =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
} else {
  initializeApp();
}

// ====== Toggle-Listener (ein/ausblenden des Untermenüs) ======
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('sidebarToggle');
  const app = document.querySelector('.app');
  const sidebar = document.querySelector('.sidebar');

  // Export: Global
  const exportGlobalBtn = document.getElementById('exportGlobalBtn');
  if (exportGlobalBtn) {
    exportGlobalBtn.addEventListener('click', () => {
      console.log('[Export] Global clicked');
      const table = document.querySelector('#global .table');
      if (!table) {
        alert('Keine Global-Tabelle gefunden.');
        return;
      }
      const csv = tableToCsv(table);
      downloadAsPseudoXlsx(csv, 'Global_DataFields.xlsx');
    });
  }

  // Export: Local
  const exportLocalBtn = document.getElementById('exportLocalBtn');
  if (exportLocalBtn) {
    exportLocalBtn.addEventListener('click', () => {
      console.log('[Export] Local clicked');
      const tables = Array.from(
        document.querySelectorAll('#localTables table.table')
      );
      if (tables.length === 0) {
        alert('Keine Local-Tabellen gefunden.');
        return;
      }
      let out = '';
      tables.forEach((t, idx) => {
        const title =
          t.getAttribute('data-title') ||
          t.closest('.le-section')?.querySelector('.table-title')?.innerText ||
          `Table ${idx + 1}`;
        out += `"${String(title).replace(/"/g, '""')}"\n`;
        out += tableToCsv(t);
        out += '\n';
      });
      downloadAsPseudoXlsx(out, 'Local_DataFields.xlsx');
    });
  }

  // Optional: Add-Local-Field Button global anbinden
  const addLocalFieldBtn = document.getElementById('addLocalFieldBtn');
  if (addLocalFieldBtn) {
    addLocalFieldBtn.addEventListener('click', () => {
      openFieldDialog(null, { presetLocal: true });
    });
  }

  // Sidebar Toggle – flüssige Slide-Animation mit Snap des Grids
  (() => {
    const app = document.querySelector('.app');
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.querySelector('.sidebar-toggle');

    // Dauer MUSS zu CSS --sb-dur passen (.48s -> 480 ms)
    const DUR = 480;

    if (!app || !sidebar || !toggle) return;

    // Säubere alte Klassen beim Start (falls noch vorhanden)
    app.classList.remove(
      'sidebar-collapsing',
      'sidebar-expanding',
      'sidebar-collapsed',
      'is-sliding'
    );
    sidebar.style.willChange = 'transform, opacity';

    toggle.addEventListener('click', () => {
      const isCollapsed = app.classList.contains('sidebar-collapsed');

      // Globale „wir sliden gerade“-Sperre (blockt pointer-events in CSS)
      app.classList.add('is-sliding');

      if (!isCollapsed) {
        // == COLLAPSE ==
        // 1) Sidebar rausfahren (transform/opacity animieren)
        app.classList.add('sidebar-collapsing');

        // 2) Nach Ende der Sidebar-Animation: Grid-Spalte auf 0 setzen
        window.setTimeout(() => {
          app.classList.add('sidebar-collapsed'); // grid: 0 1fr (animiert via CSS)
          app.classList.remove('sidebar-collapsing'); // Clean up
          app.classList.remove('is-sliding');
        }, DUR);
      } else {
        // == EXPAND ==
        // 1) Grid sofort auf volle Breite stellen (animiert), Sidebar bleibt noch links außerhalb
        app.classList.remove('sidebar-collapsed');
        app.classList.add('sidebar-expanding');

        // 2) Nächster Frame: Startposition (-110%) anlegen
        requestAnimationFrame(() => {
          // 3) Noch ein Frame: „run-in“ -> transform auf 0 (löst die .48s-Transition aus)
          requestAnimationFrame(() => {
            app.classList.add('run-in');

            // 4) Nach Ende der Animation aufräumen
            window.setTimeout(() => {
              app.classList.remove('run-in', 'sidebar-expanding');
              app.classList.remove('is-sliding');
            }, DUR);
          });
        });
      }
    });
  })();
});
// --- CSV/XLSX Helfer (Variante 1: "falsches" XLSX, aber Excel-kompatibel) ---

/** Wandelt eine HTML-Tabelle in CSV-Text um (Semikolon-getrennt). */
function tableToCsv(tableEl) {
  const rows = tableEl.querySelectorAll('tr');
  let csv = '';
  rows.forEach((row) => {
    const cells = row.querySelectorAll('th,td');
    const values = Array.from(cells).map((cell) => {
      // Text sauber extrahieren
      const txt = (cell.innerText ?? '').replace(/\r?\n+/g, ' ').trim();
      // CSV-Escaping: Doppelte Anführungszeichen verdoppeln
      return `"${txt.replace(/"/g, '""')}"`;
    });
    // Semikolon als Trennzeichen (deutsche Excel-Region)
    csv += values.join(';') + '\n';
  });
  return csv;
}

/**
 * Speichert CSV-Text als Datei mit .xlsx-Endung.
 * Excel öffnet das direkt, Formatierung ist jedoch "plain".
 */
function downloadAsPseudoXlsx(csvText, fileName = 'export.xlsx') {
  const blob = new Blob([csvText], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Exportiert genau eine Tabelle (Selector oder Element) als .xlsx */
function exportSingleTableAsXlsx(tableSelectorOrEl, fileName) {
  const table =
    typeof tableSelectorOrEl === 'string'
      ? document.querySelector(tableSelectorOrEl)
      : tableSelectorOrEl;

  if (!table) {
    alert('Tabelle nicht gefunden.');
    return;
  }
  const csv = tableToCsv(table);
  downloadAsPseudoXlsx(csv, fileName);
}

/**
 * Exportiert mehrere Tabellen nacheinander in EIN Blatt:
 * - Fügt einen Abschnittstitel (als eigene Zeile) ein
 * - Lässt eine Leerzeile zwischen den Tabellen
 */
function exportMultipleTablesAsXlsx(tables, fileName) {
  let out = '';
  tables.forEach((t, idx) => {
    const title =
      t.getAttribute('data-title') ||
      t.closest('.le-section')?.querySelector('.table-title')?.innerText ||
      `Table ${idx + 1}`;
    out += `"${title.replace(/"/g, '""')}"\n`; // Abschnittsüberschrift
    out += tableToCsv(t);
    out += '\n'; // Leerzeile
  });
  function downloadAsPseudoXlsx(csvText, fileName = 'export.xlsx') {
    const blob = new Blob([csvText], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);

    // Primärer Weg (funktioniert lokal/ohne Sandbox):
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    document.body.appendChild(a);

    let clicked = false;
    try {
      a.click();
      clicked = true;
    } catch (e) {
      clicked = false;
    }
    document.body.removeChild(a);

    // Fallback für sandboxed Iframes (StackBlitz Preview):
    if (!clicked) {
      try {
        window.open(url, '_blank'); // öffnet ein neues Tab -> Rechtsklick „Speichern unter…“
      } catch (e) {
        // Allerletzte Rückfallebene: zeig den CSV-Text an
        alert(
          'Download im Preview blockiert. Es öffnet sich ein neues Tab oder du kopierst die Daten manuell.'
        );
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(
            '<pre style="white-space:pre-wrap;word-break:break-word;">'
          );
          w.document.write(csvText.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
          w.document.write('</pre>');
        }
      }
    }

    // URL wieder freigeben
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
function selectEdge(edgePathEl) {
  edgePathEl.classList.add('edge-selected');
}

function deselectEdge(edgePathEl) {
  edgePathEl.classList.remove('edge-selected');
}
// ============================
// Filter Overlay Toggle Logic
// ============================
document.addEventListener('DOMContentLoaded', () => {
  const sheet = document.getElementById('filterOverlay');
  const openBtn = document.getElementById('openFilterPanel');
  const closeBtn = document.getElementById('filterCloseBtn');

  if (!sheet || !openBtn || !closeBtn) return;

  // Öffnen
  openBtn.addEventListener('click', () => {
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
  });

  // Schließen
  closeBtn.addEventListener('click', () => {
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
  });
});
/* Ende Teil 9*/
// =========================
// Data-Map: Verbindungen
// =========================

function drawSystemEdges() {
  // Gemeinsamer Wrapper der beiden Tabellen (passen wir unten an)
  const wrapper =
    document.querySelector('.data-map') ||   // bevorzugt
    document.querySelector('.dataMapWrapper') ||
    document.querySelector('.map-container') ||
    document.body;

  // SVG-Layer bereitstellen
  let svg = document.getElementById('edgeLayer');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'edgeLayer');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';
    wrapper.appendChild(svg);
  }

  // Alte Pfade entfernen
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const wrapperRect = wrapper.getBoundingClientRect();
  const OUTSIDE_OFFSET = 12; // Start/Ende bewusst außerhalb der Tabellen

  // Kantenliste: Anpassen, falls euer Name abweicht
  const edges = Array.isArray(window.fieldLinks) ? window.fieldLinks : [];

  // Hilfsfunktion: Feldzelle per ID finden
  const findCell = (id) =>
    document.querySelector(`[data-field-id="${id}"]`);

  edges.forEach(({ from, to }) => {
    const src = findCell(from);
    const dst = findCell(to);
    if (!src || !dst) return;

    const a = src.getBoundingClientRect();
    const b = dst.getBoundingClientRect();

    // y-Mitte relativ zum Wrapper
    const y1 = (a.top + a.height / 2) - wrapperRect.top;
    const y2 = (b.top + b.height / 2) - wrapperRect.top;

    // x rechts von Quelle (außerhalb) / links vom Ziel (außerhalb)
    const x1 = (a.right - wrapperRect.left) + OUTSIDE_OFFSET;
    const x2 = (b.left - wrapperRect.left)  - OUTSIDE_OFFSET;

    // schöne S-Kurve
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.25);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#9aa3af');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('opacity', '0.9');
    svg.appendChild(path);
  });
}

// Alias, damit alte Aufrufe mit großem D weiter funktionieren:
if (typeof window !== 'undefined') window.DrawSystemEdges = drawSystemEdges;

// Neu zeichnen bei Größen- und Scrolländerungen
(function installEdgeRedraw() {
  const schedule = () => requestAnimationFrame(drawSystemEdges);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });

  // falls die Tabellen in scrollbaren Containern liegen, hier Klassen anpassen:
  document.querySelectorAll('.left-table, .right-table, .data-map, .dataMapWrapper, .map-container')
    .forEach(el => el.addEventListener('scroll', schedule, { passive: true }));

  // initial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => drawSystemEdges(), { once: true });
  } else {
    drawSystemEdges();
  }
})();

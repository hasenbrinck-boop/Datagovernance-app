import {
  state,
  getLocalFields,
  getGlobalFields,
  getAllowedValues,
  findMappings,
  findValueMapByMappingId,
  findFieldById,
} from './state.js';
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
  saveGlossaryVersion,
  loadGlossaryVersion,
  saveGlossaryChanges,
  loadGlossaryChanges,
  loadMappings,
  saveMappings,
  loadValueMaps,
  saveValueMaps,
} from './storage.js';

// === Edit-Index: zentrale Helpers (einmalig am Anfang von main.js) ===
function getEditFieldIndex() {
  const v = window.state?.editFieldIndex;
  const n = typeof v === 'string' ? parseInt(v, 10) : v;
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function setEditFieldIndex(n) {
  window.state.editFieldIndex = Number.isFinite(n) && n >= 0 ? n : null;
}
function clearEditFieldIndex() {
  window.state.editFieldIndex = null;
}

console.log('[main.js] Modul geladen');
if (typeof window !== 'undefined') {
  window.state = state;
  window.fields = state.fields; // optional
}

const dataDomains = state.dataDomains;
const systems = state.systems;
const dataObjects = state.dataObjects;
let fields = state.fields;
if (typeof window !== 'undefined') {
  window.fields = fields;
}
const fieldColumns = state.fieldColumns;
const legalEntities = state.legalEntities;
const leSystemMap = state.leSystemMap;
const glossaryTerms = state.glossaryTerms;

let currentSystem = state.currentSystem;
let editDataObjectIndex = state.editDataObjectIndex;
let editSystemIndex = state.editSystemIndex;
let editFoundationIndex = state.editFoundationIndex;
let editColumnIndex = state.editColumnIndex;
let editDomainIndex = state.editDomainIndex;
let editLegalIndex = state.editLegalIndex;
let editGlossaryIndex = state.editGlossaryIndex;
let glossaryTypeFilter = state.glossaryTypeFilter;
const nodeCollapsed = state.nodeCollapsed;
const mapTransformState = state.mapTransformState;
if (typeof window !== 'undefined') {
  window.mapTransformState = mapTransformState;
}
let mapFilters = state.mapFilters;
let mapPositions = state.mapPositions;
let selectedFieldRef = state.selectedFieldRef;
let editingLeIndexForSystems = state.editingLeIndexForSystems;
let globalSort = state.globalSort;
let showGlobalFilters = state.showGlobalFilters;
let showLocalFilters = state.showLocalFilters;
let isPanning = state.isPanning;
let panStart = state.panStart;
let currentMapView = state.currentMapView;
let selectedDataObject = state.selectedDataObject;
let dataObjectPositions = state.dataObjectPositions;

let fieldDialogHandlersBound = false;
let mapHasUserInteraction = false; // Track if user has interacted with map

// === Data Object Dialog / Form (können initial null sein, Guards sind unten eingebaut)
const dataObjectDialog = document.getElementById('dataObjectDialog');
const dataObjectForm = document.getElementById('dataObjectForm');

// --- DOM-Shortcuts mit Guard ---
const $ = (sel, root = document) => (root || document).querySelector(sel);
const $$ = (sel, root = document) =>
  Array.from((root || document).querySelectorAll(sel));
const byId = (id) => document.getElementById(id);

// --- Pan/Zoom State defensiv ---
window.mapTransformState = window.mapTransformState || { x: 0, y: 0, k: 1 };

// --- Referenz auf den Map-Viewport: existiert bei dir sicherer als "mapCanvas"
function getMapViewport() {
  return byId('mapViewport') || byId('mapCanvas') || null;
}

// --- Edge-Redraw scheduling (falls noch nicht vorhanden) ---
let _edgeRAF = 0;
function scheduleEdgesRedraw() {
  if (_edgeRAF) cancelAnimationFrame(_edgeRAF);
  _edgeRAF = requestAnimationFrame(() => {
    _edgeRAF = 0;
    try {
      drawSystemEdges();
    } catch (e) {
      console.error('[edges]', e);
    }
  });
}

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
              <svg width="16" height="16" viewBox="0 0 20 20"><path fill="currentColor" d="M14.69 2.86a1.5 1.5 0 0 1 2.12 2.12L7.62 14.17l-3.03.9.9-3.03L14.69 2.86z"/></svg>
            </button>
            <button class="dbo-delete" data-index="${i}" title="Delete">
              <svg width="16" height="16" viewBox="0 0 20 20"><path fill="currentColor" d="M6 6h8v10H6V6zm9-2H5v2h10V4z"/></svg>
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
  try {
    drawSystemEdges();
  } catch (e) {
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

function ensureFieldDialogHandlers() {
  if (fieldDialogHandlersBound || !fieldForm) return;

  const syncLegalOptions = () => {
    const sysName = fieldForm.elements.system?.value || '';
    const isLocal = !!fieldForm.elements.local?.checked;
    const keepValue = legalEntitySelect?.value || '';
    populateLESelectForSystem(sysName, isLocal, keepValue);
  };

  fieldForm.elements.system?.addEventListener('change', syncLegalOptions);
  fieldForm.elements.local?.addEventListener('change', syncLegalOptions);

  fieldDialogHandlersBound = true;
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
  if (!t) return '—';
  const term = t.term || '—';
  const def = (t.definition || '').trim();
  if (def) return `${term}: ${def}`;
  return term;
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
  const dashboardNavItem = byId('dashboardNavItem');
  const systemsNavItem = byId('systemsNavItem');
  const dataMapNavItem = byId('dataMapNavItem');
  const glossaryNavItem = byId('glossaryNavItem');
  const adminNavItem = byId('adminNavItem');

  // Nav-Buttons (oben) aktiv setzen
  const mode = document.body.getAttribute('data-mode');
  dashboardNavItem?.classList.toggle('is-active', mode === 'dashboard');
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
  if (currentSystem === 'All Systems' && !state.currentDomain) liAll.classList.add('is-active');
  liAll.addEventListener('click', () => {
    state.currentDomain = null;
    setModeSystems('All Systems');
  });
  systemListEl.appendChild(liAll);

  const names = getDomainNames();
  names.forEach((dn) => {
    const cluster = document.createElement('div');
    cluster.className = 'domain-cluster is-open';
    const head = document.createElement('div');
    head.className = 'cluster-head';
    const color = domainByName(dn)?.color || '#6a6a6a';
    // Highlight domain header if it's the active domain filter
    const isDomainActive = state.currentDomain === dn;
    head.innerHTML = `<span class="${isDomainActive ? 'is-active' : ''}"><span class="domain-icon" style="background:${color}"></span>${dn}</span><span>▾</span>`;
    const body = document.createElement('div');
    body.className = 'cluster-body';
    getSystemsByDomain(dn).forEach((sys) => {
      const li = document.createElement('li');
      li.textContent = sys.name;
      if (currentSystem === sys.name && !state.currentDomain) li.classList.add('is-active');
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        setModeSystems(sys.name);
      });
      body.appendChild(li);
    });
    head.addEventListener('click', (e) => {
      e.stopPropagation();
      // Check if clicking on the domain name (left side) or toggle icon (right side)
      const clickedOnName = e.target.classList.contains('domain-icon') || 
                            (e.target.tagName === 'SPAN' && e.target.querySelector('.domain-icon'));
      
      if (clickedOnName || e.target === head.querySelector('span:first-child')) {
        // Click on domain name - filter by domain
        setModeSystemsByDomain(dn);
      } else {
        // Click on toggle icon - collapse/expand
        cluster.classList.toggle('is-open');
        head.querySelector('span:last-child').textContent =
          cluster.classList.contains('is-open') ? '▾' : '▸';
        body.style.display = cluster.classList.contains('is-open')
          ? 'block'
          : 'none';
      }
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

function showDataMapSubnav(show) {
  const sub = document.getElementById('dataMapSubnav');
  const sys = document.getElementById('systemList');
  if (sub) sub.style.display = show ? 'block' : 'none';
  if (sys) sys.style.display = show ? 'none' : sys.style.display; // bei Data Map: Systems-Liste ausblenden
}

function installDataMapSubnavHandlers() {
  const sub = document.getElementById('dataMapSubnav');
  if (!sub) return;
  
  let handlersInstalled = false;
  if (sub.dataset.handlersInstalled === 'true') {
    handlersInstalled = true;
  }
  
  if (handlersInstalled) return;
  
  sub.querySelectorAll('.map-view-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Active-Style setzen
      sub
        .querySelectorAll('.map-view-filter')
        .forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      // View wechseln
      currentMapView = btn.dataset.view || 'system';
      state.currentMapView = currentMapView;
      
      // Reset selection state
      selectedFieldRef = null;
      state.selectedFieldRef = selectedFieldRef;
      selectedDataObject = null;
      state.selectedDataObject = selectedDataObject;
      mapHasUserInteraction = false;
      
      // Re-render map
      renderDataMap();
      fitMapToContent();
    });
  });
  
  sub.dataset.handlersInstalled = 'true';
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
  // 'dashboard' | 'systems' | 'admin' | 'map' | 'glossary'
  const showDashboard = mode === 'dashboard';
  const showSystems = mode === 'systems';
  const showAdmin = mode === 'admin';
  const showMap = mode === 'map';
  const showGlossary = mode === 'glossary';

  const dashboardEl = byId('dashboardView');
  const topTabsEl = byId('topTabs');
  const globalEl = byId('global');
  const localEl = byId('local');
  const adminTabsEl = byId('adminTabs');
  const mapViewEl = byId('mapView');
  const glossaryEl = byId('glossaryView');

  if (dashboardEl) dashboardEl.style.display = showDashboard ? 'block' : 'none';
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

// ===== Tabs: Global / Local / Mappings =====

// einmalig Tab-Click-Handling einrichten
function setupTopTabs() {
  const tabs = document.querySelectorAll('#topTabs .tab');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tgt = btn.dataset.tab; // "global" | "local" | "mappings"
      // visuelle Markierung
      tabs.forEach(b => b.classList.toggle('is-active', b === btn));
      // Bereich zeigen
      showMainView(tgt);
    });
  });
}

// zeigt eines der drei Panels an
// ===== Views sicher umschalten (Global / Local / Mappings) =====
function showMainView(tabId) {
  const secGlobal   = document.getElementById('global');
  const secLocal    = document.getElementById('local');
  const secMappings = document.getElementById('systems-mappings-section');

  // Helper
  const show = (el) => { if (!el) return; el.hidden = false; el.style.display = ''; el.classList.add('is-active'); };
  const hide = (el) => { if (!el) return; el.classList.remove('is-active'); el.style.display = 'none'; };
  const hideHidden = (el) => { if (!el) return; el.hidden = true; el.style.display = 'none'; };

  // Alles aus
  hide(secGlobal);
  hide(secLocal);
  hideHidden(secMappings); // Mappings per hidden steuern

  // Ziel an
  switch ((tabId || '').toLowerCase()) {
    case 'global':
      show(secGlobal);
      if (typeof window.renderFieldsTable === 'function') {
        try { window.renderFieldsTable(); } catch {}
      }
      break;

    case 'local':
      show(secLocal);
      if (typeof window.renderLocalFieldsTables === 'function') {
        try { window.renderLocalFieldsTables(); } catch {}
      } else if (typeof window.renderLocalTables === 'function') { // Fallback
        try { window.renderLocalTables(); } catch {}
      }
      break;

    case 'mappings':
      if (secMappings) { secMappings.hidden = false; secMappings.style.display = ''; }
      // Initialisierung: akzeptiere beide Varianten (IIFE oder Funktion)
      if (!window.__mappingsInit) {
        if (typeof window.setupMappingsFeature === 'function') {
          try { window.setupMappingsFeature(); window.__mappingsInit = true; } catch {}
        } else {
          // Falls als IIFE bereits lief, nur Liste refreshen
          window.__mappingsInit = true;
        }
      }
      // Liste aktualisieren, wenn verfügbar
      if (typeof window.__renderMappingsList === 'function') {
        try { window.__renderMappingsList(); } catch {}
      }
      break;

    default:
      // Fallback -> Global
      show(secGlobal);
      if (typeof window.renderFieldsTable === 'function') {
        try { window.renderFieldsTable(); } catch {}
      }
  }

  // Tabs aktiv markieren
  document.querySelectorAll('#topTabs .tab')
    .forEach(t => t.classList.toggle('is-active', (t.dataset.tab || '') === (tabId || '')));
}

/**
 * Systems-Modus aktivieren und Tabs passend ein-/ausblenden.
 * Achtung: "Mappings" bleibt immer sichtbar (bewusst).
 */
function setModeSystems(name) {
  // State übernehmen
  state.currentSystem = name;
  currentSystem = name; // Update local variable as well
  state.currentDomain = null; // Clear domain filter when selecting specific system
  state.selectedFieldRef = null;
  clearSelectionVisuals?.();
  document.body.setAttribute('data-mode', 'systems');
  showOnly?.('systems'); // falls deine alte High-Level-Sichtsteuerung das braucht

  // Scope des Systems bestimmen
  const sys = (state.systems || []).find(s => s.name === name);
  let showGlobal = true, showLocal = true, showMappings = true;

  if (sys) {
    if (sys.scope === 'global') showLocal = false;
    if (sys.scope === 'local')  showGlobal = false;
  }

  // Tabs sichtbar/unsichtbar schalten
  const tabGlobal   = document.querySelector('#topTabs .tab[data-tab="global"]');
  const tabLocal    = document.querySelector('#topTabs .tab[data-tab="local"]');
  const tabMappings = document.querySelector('#topTabs .tab[data-tab="mappings"]');

  if (tabGlobal)   tabGlobal.style.display   = showGlobal   ? 'inline-flex' : 'none';
  if (tabLocal)    tabLocal.style.display    = showLocal    ? 'inline-flex' : 'none';
  if (tabMappings) tabMappings.style.display = showMappings ? 'inline-flex' : 'none'; // immer sichtbar

  // Ziel-Tab bestimmen:
  // 1) wenn aktueller aktiver Tab sichtbar bleibt, dort bleiben
  const activeBtn = document.querySelector('#topTabs .tab.is-active');
  const activeId  = activeBtn?.dataset?.tab;
  if (activeBtn && activeId && (
      (activeId === 'global'   && showGlobal) ||
      (activeId === 'local'    && showLocal)  ||
      (activeId === 'mappings' && showMappings)
    )) {
    showMainView(activeId);
    return;
  }

  // 2) sonst Priorität: global > local > mappings (falls sichtbar)
  let target = null;
  if (showGlobal) target = 'global';
  else if (showLocal) target = 'local';
  else target = 'mappings';

  // visuelle Markierung setzen
  document.querySelectorAll('#topTabs .tab')
    .forEach(t => t.classList.toggle('is-active', t.dataset.tab === target));

  // anzeigen
  showMainView(target);
}

/**
 * Filter systems view by domain - shows all fields from systems in the specified domain
 */
function setModeSystemsByDomain(domainName) {
  // State übernehmen
  state.currentSystem = 'All Systems'; // Not filtering by specific system
  currentSystem = 'All Systems'; // Update local variable as well
  state.currentDomain = domainName; // Set domain filter
  state.selectedFieldRef = null;
  clearSelectionVisuals?.();
  document.body.setAttribute('data-mode', 'systems');
  showOnly?.('systems');

  // All tabs should be visible when filtering by domain
  const tabGlobal   = document.querySelector('#topTabs .tab[data-tab="global"]');
  const tabLocal    = document.querySelector('#topTabs .tab[data-tab="local"]');
  const tabMappings = document.querySelector('#topTabs .tab[data-tab="mappings"]');

  if (tabGlobal)   tabGlobal.style.display   = 'inline-flex';
  if (tabLocal)    tabLocal.style.display    = 'inline-flex';
  if (tabMappings) tabMappings.style.display = 'inline-flex';

  // Update sidebar to show active domain
  renderSystemsSidebar();

  // Determine which tab to show
  const activeBtn = document.querySelector('#topTabs .tab.is-active');
  const activeId  = activeBtn?.dataset?.tab || 'global';
  
  // Mark active tab
  document.querySelectorAll('#topTabs .tab')
    .forEach(t => t.classList.toggle('is-active', t.dataset.tab === activeId));

  // Show the view
  showMainView(activeId);
}

// beim App-Start einmalig aufrufen (falls noch nicht):
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupTopTabs, { once:true });
} else {
  setupTopTabs();
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
    .filter((f) => {
      // Filter by specific system
      if (currentSystem !== 'All Systems') {
        return f.system === currentSystem;
      }
      // Filter by domain
      if (state.currentDomain) {
        const sys = systems.find((s) => s.name === f.system);
        return sys && sys.dataDomain === state.currentDomain;
      }
      return true;
    })
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

  const {
    fields,
    systems,
    legalEntities,
    currentSystem,
    columnFilters = (state.columnFilters = state.columnFilters || {}),
    localSortByLe  = (state.localSortByLe = state.localSortByLe || {}),
  } = state;

  // IMMER state.* verwenden – keine losen Variablen
  const localView = document.getElementById('local');
  if (!localView) {
    console.warn('[gdf] renderLocalFieldsTables(): #local not found');
    return;
  }

  const sectionHead   = localView.querySelector('.section-head');
  const sectionTitleEl = sectionHead?.querySelector('.section-title');

  let host = document.getElementById('localTables');
  if (!host) {
    host = document.createElement('div');
    host.id = 'localTables';
    host.className = 'local-tables';
    localView.appendChild(host);
  }
  host.innerHTML = '';

  // Hilfsfunktion
  const getLENameByNumber = (num) => {
    if (!num) return 'Unassigned';
    const le = (state.legalEntities || []).find((x) => x.number === num);
    return le ? le.name : 'Unassigned';
  };

  // Lokale Felder filtern (nur state.*)
  const localCandidates = (state.fields || [])
    .filter((f) => isValidSystemName(f.system))
    .filter((f) => {
      // Filter by specific system
      if (state.currentSystem !== 'All Systems') {
        return f.system === state.currentSystem;
      }
      // Filter by domain
      if (state.currentDomain) {
        const sys = (state.systems || []).find((s) => s.name === f.system);
        return sys && sys.dataDomain === state.currentDomain;
      }
      return true;
    })
    .filter((f) => {
      const sys = (state.systems || []).find((s) => s.name === f.system);
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
  const hasMultipleGroups = orderedKeys.length > 1;

  let sectionTitleText = 'Local Data Fields';
  if (orderedKeys.length === 1) {
    const firstKey = orderedKeys[0];
    const firstName = firstKey ? getLENameByNumber(firstKey) : 'Unassigned';
    sectionTitleText = `Local Data Fields - ${firstName}`;
  } else if (orderedKeys.length === 0) {
    sectionTitleText = 'Local Data Fields - Unassigned';
  }
  if (sectionTitleEl) {
    sectionTitleEl.textContent = sectionTitleText;
    sectionTitleEl.removeAttribute('aria-hidden');
  }

  // Für jede Gruppe: Überschrift + Tabelle
  orderedKeys.forEach((leNumber) => {
    // Filter + Sort je LE-Tabelle
    let recs = groups.get(leNumber) || [];
    recs = applyColumnFilters(recs, cols);
    recs =
      sortFieldsCustom(recs, (window.localSortByLe || {})[leNumber]) ||
      sortFieldsDefault(recs);

    const group = document.createElement('div');
    group.className = 'local-table-group';

    const titleName = leNumber ? getLENameByNumber(leNumber) : 'Unassigned';
    const tableTitleText = `Local Data Fields - ${titleName}`;

    if (hasMultipleGroups) {
      const headerRow = document.createElement('div');
      headerRow.className = 'local-table-header';
      headerRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem;';
      
      const title = document.createElement('h3');
      title.textContent = tableTitleText;
      title.style.cssText = 'margin:0;';
      headerRow.appendChild(title);
      
      // Add individual export button for this Legal Entity
      const exportBtn = document.createElement('button');
      exportBtn.className = 'btn btn--secondary btn--sm';
      exportBtn.textContent = 'Export';
      exportBtn.style.cssText = 'margin-left:auto;';
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const table = group.querySelector('table.table');
        if (table) {
          exportMultipleTablesAsXlsx([table], `Local_DataFields_${titleName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
        }
      });
      headerRow.appendChild(exportBtn);
      
      group.appendChild(headerRow);
    }

    const table = document.createElement('table');
    table.className = 'table local-fields-table';
    table.dataset.leNumber = leNumber;
    table.setAttribute('aria-label', tableTitleText);

    const thead = document.createElement('thead');

    // Zeile 1: Sortierbare Header
    const row1 = document.createElement('tr');
    row1.innerHTML =
      cols
        .map(
          (c) =>
            `<th data-col="${c.name}" class="is-sortable">${
              c.name
            }${sortIndicator(c.name, (window.localSortByLe || {})[leNumber])}</th>`
        )
        .join('') + `<th>Actions</th>`;
    thead.appendChild(row1);

    if (state.showLocalFilters) {
      const row2 = document.createElement('tr');
      row2.innerHTML =
        cols
          .map((c) => {
            const v = (window.columnFilters || {})[c.name] ?? '';
            return `<th><input data-col="${
              c.name
            }" type="search" placeholder="Filter…" value="${esc(v)}" /></th>`;
          })
          .join('') + `<th></th>`;
      thead.appendChild(row2);

      // Filter-Handler (teilen sich columnFilters)
      row2.querySelectorAll('input[type="search"]').forEach((inp) => {
        inp.addEventListener('input', () => {
          window.columnFilters = window.columnFilters || {};
          window.columnFilters[inp.dataset.col] = inp.value || '';
          preserveFilterInputFocus(() => renderLocalFieldsTables());
        });
      });
    }

    // Sortier-Handler (je LE-Tabelle eigene Sortierung)
    row1.querySelectorAll('th.is-sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        const key = mapColToSortKey(col);
        window.localSortByLe = window.localSortByLe || {};
        const curMap = window.localSortByLe;
        curMap[leNumber] = curMap[leNumber] || { key: 'system', dir: 'asc' };
        const cur = curMap[leNumber];
        if (cur.key === key) cur.dir = cur.dir === 'asc' ? 'desc' : 'asc';
        else curMap[leNumber] = { key, dir: 'asc' };
        renderLocalFieldsTables();
      });
    });

    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Sichtbare Liste -> globaler Index map (immer state.fields nutzen)
    const indexMap = new Map();
    recs.forEach((v) => {
      const gi = (state.fields || []).findIndex(
        (f) =>
          f.name === v.name &&
          f.system === v.system &&
          (f.mapping || '') === (v.mapping || '') &&
          (f.legalEntityNumber || '') === (v.legalEntityNumber || '')
      );
      indexMap.set(v, gi);
    });

    recs.forEach((f) => {
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
        <button class="fieldEdit" title="Edit">
          <svg class="icon-16" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z" fill="currentColor"/></svg>
        </button>
        <button class="fieldDelete" title="Delete">
          <svg class="icon-16" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm5-4h2l1 1h4v2H5V4h4l1-1Z" fill="currentColor"/></svg>
        </button>
      `;
      // Edit/Delete-Handler pro Zeile
      tdActions.querySelector('.fieldEdit')?.addEventListener('click', () => {
        const gi = indexMap.get(f);
        if (gi != null) openFieldDialog(gi);
      });
      tdActions.querySelector('.fieldDelete')?.addEventListener('click', () => {
        const gi = indexMap.get(f);
        if (gi == null) return;
        if (confirm(`Delete field "${state.fields[gi].name}"?`)) {
          state.fields.splice(gi, 1);
          if (typeof saveFields === 'function') saveFields();
          renderLocalFieldsTables();
          if (document.body.getAttribute('data-mode') === 'map') {
            renderDataMap();
          }
          document.dispatchEvent(new CustomEvent('gdf:fields-updated'));
        }
      });

      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    group.appendChild(table);
    host.appendChild(group);
  });

  // Edge-Case: Keine lokalen Felder -> trotzdem „Unassigned“-Block zeigen
  if (!orderedKeys.length) {
    const group = document.createElement('div');
    group.className = 'local-table-group';

    const table = document.createElement('table');
    table.className = 'table local-fields-table';
    table.setAttribute('aria-label', 'Local Data Fields - Unassigned');
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    const headHtml =
      cols.map((c) => `<th>${c.name}</th>`).join('') + `<th>Actions</th>`;
    trHead.innerHTML = headHtml;
    thead.appendChild(trHead);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    group.appendChild(table);
    host.appendChild(group);
  }
}



// WICHTIG: für Submit-Code und AV-Spalte verfügbar machen
window.renderLocalTables = renderLocalFieldsTables;
window.renderFieldsTable = renderFieldsTable;
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
function fieldRefLabel(field) {
  if (!field) return '';
  return `${field.system} • ${field.name}`;
}

function fieldRefValue(field) {
  if (!field) return '';
  return field.id || `${field.system}:${field.name}`;
}

function fieldRefMatches(field, value) {
  if (!field || value == null) return false;
  const needle = String(value).trim();
  if (!needle) return false;
  if (field.id && field.id === needle) return true;
  if (`${field.system}:${field.name}` === needle) return true;
  if (fieldRefLabel(field) === needle) return true;
  return false;
}

function findFieldByFieldRef(value) {
  if (value == null) return null;
  const needle = String(value).trim();
  if (!needle) return null;
  return fields.find((f) => fieldRefMatches(f, needle)) || null;
}

function formatGlossaryDetail(term) {
  if (!term) return '—';
  const label = esc(term.term || '');
  const definition = term.definition ? ` – ${esc(term.definition)}` : '';
  const title = term.definition ? ` title="${esc(term.definition)}"` : '';
  return `<span class="glossary-link" data-id="${esc(
    term.id
  )}"${title}>${label}</span>${definition}`;
}

function renderGlossaryTable() {
  if (!glossaryTable) return;
  glossaryTable.innerHTML = '';

  const list = glossaryTerms.filter((g) => {
    if (!glossaryTypeFilter || glossaryTypeFilter === 'ALL') return true;
    return (g.type || 'Term') === glossaryTypeFilter;
  });

  list.sort((a, b) =>
    (a.term || '').localeCompare(b.term || '', undefined, {
      sensitivity: 'base',
    })
  );

  list.forEach((g, i) => {
    const linkedField = findFieldByFieldRef(g.fieldRefId || g.fieldRef || '');
    const linkedLabel = linkedField
      ? fieldRefLabel(linkedField)
      : g.fieldRef || '';
    if (linkedField && g.fieldRef !== linkedLabel) {
      g.fieldRef = linkedLabel;
    }
    if (!linkedField && g.fieldRefId) {
      g.fieldRefId = '';
    }
    const termText = g.term ? esc(g.term) : '-';
    const typeText = esc(g.type || 'Term');
    const defText = g.definition ? esc(g.definition) : '-';
    const infoText = g.info ? esc(g.info) : '-';
    const ownerText = g.owner ? esc(g.owner) : '-';
    const refText = linkedLabel ? esc(linkedLabel) : '-';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${termText}</td>
      <td>${typeText}</td>
      <td>${defText}</td>
      <td>${infoText}</td>
      <td>${ownerText}</td>
      <td>${refText}</td>
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

  $$('.glsEdit').forEach((btn) =>
    btn.addEventListener('click', () =>
      openGlossaryDialog(parseInt(btn.dataset.index, 10))
    )
  );
  $$('.glsDelete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.dataset.index, 10);
      const name = list[i]?.term || 'term';
      if (confirm(`Delete glossary term "${name}"?`)) {
        const globalIdx = glossaryTerms.findIndex((x) => x.id === list[i].id);
        if (globalIdx > -1) {
          const deletedRecord = glossaryTerms[globalIdx];
          
          // Ask if user wants to create a new version using custom dialog
          const createNewVersion = await showVersionDialog();
          
          // Log deletion to changelog (always happens) and optionally increment version
          logGlossaryChanges(deletedRecord, null, 'deleted', createNewVersion);
          
          glossaryTerms.splice(globalIdx, 1);
        }
        saveGlossary();
        saveGlossaryVersionAndChanges();
        renderGlossaryTable();
        updateGlossaryVersionDisplay();
      }
    });
  });
}

// Glossary Versioning Functions

// Show version dialog and return user choice as promise
function showVersionDialog() {
  return new Promise((resolve) => {
    const dialog = document.getElementById('versionDialog');
    const newBtn = document.getElementById('versionDialogNew');
    const keepBtn = document.getElementById('versionDialogKeep');
    
    function cleanup() {
      newBtn.removeEventListener('click', handleNew);
      keepBtn.removeEventListener('click', handleKeep);
      dialog.close();
    }
    
    function handleNew() {
      cleanup();
      resolve(true); // true = create new version
    }
    
    function handleKeep() {
      cleanup();
      resolve(false); // false = keep version
    }
    
    newBtn.addEventListener('click', handleNew);
    keepBtn.addEventListener('click', handleKeep);
    
    dialog.showModal();
  });
}

// Increment version number
function incrementGlossaryVersion() {
  if (!state.glossaryVersion) state.glossaryVersion = { major: 1, minor: 0 };
  state.glossaryVersion.minor += 1;
  return `${state.glossaryVersion.major}.${state.glossaryVersion.minor}`;
}

// Get current version string
function getCurrentVersion() {
  if (!state.glossaryVersion) state.glossaryVersion = { major: 1, minor: 0 };
  return `${state.glossaryVersion.major}.${state.glossaryVersion.minor}`;
}

// Log changes to changelog (always happens, regardless of version increment)
function logGlossaryChanges(oldRecord, newRecord, changeType, shouldIncrementVersion) {
  if (!state.glossaryChanges) state.glossaryChanges = [];
  if (!state.glossaryVersion) state.glossaryVersion = { major: 1, minor: 0 };
  
  const timestamp = new Date().toISOString();
  let version = getCurrentVersion();
  
  // Increment version if requested
  if (shouldIncrementVersion) {
    version = incrementGlossaryVersion();
  }
  
  if (changeType === 'added') {
    state.glossaryChanges.push({
      version: version,
      date: timestamp,
      term: newRecord.term,
      changeType: 'Added',
      field: 'All',
      oldValue: '-',
      newValue: 'New term created'
    });
  } else if (changeType === 'modified') {
    // Track each changed field
    const fields = ['term', 'definition', 'info', 'owner', 'type', 'fieldRef'];
    
    fields.forEach(field => {
      const oldVal = oldRecord[field] || '';
      const newVal = newRecord[field] || '';
      
      if (oldVal !== newVal) {
        state.glossaryChanges.push({
          version: version,
          date: timestamp,
          term: newRecord.term,
          changeType: 'Modified',
          field: field.charAt(0).toUpperCase() + field.slice(1),
          oldValue: oldVal || '-',
          newValue: newVal || '-'
        });
      }
    });
  } else if (changeType === 'deleted') {
    state.glossaryChanges.push({
      version: version,
      date: timestamp,
      term: oldRecord.term,
      changeType: 'Deleted',
      field: 'All',
      oldValue: 'Term existed',
      newValue: '-'
    });
  }
}

function saveGlossaryVersionAndChanges() {
  if (typeof saveGlossaryVersion === 'function') {
    saveGlossaryVersion(state.glossaryVersion);
  }
  if (typeof saveGlossaryChanges === 'function') {
    saveGlossaryChanges(state.glossaryChanges);
  }
}

function updateGlossaryVersionDisplay() {
  const versionEl = document.getElementById('glossaryVersionDisplay');
  if (versionEl && state.glossaryVersion) {
    versionEl.textContent = `Version ${state.glossaryVersion.major}.${state.glossaryVersion.minor}`;
  }
}

function renderGlossaryChanges() {
  const changesTable = document.getElementById('glossaryChangesTable');
  if (!changesTable) return;
  
  changesTable.innerHTML = '';
  
  if (!state.glossaryChanges || state.glossaryChanges.length === 0) {
    changesTable.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">No changes recorded yet</td></tr>';
    return;
  }
  
  // Sort changes by date (newest first)
  const sortedChanges = [...state.glossaryChanges].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
  
  sortedChanges.forEach(change => {
    const tr = document.createElement('tr');
    const changeClass = change.changeType === 'Added' ? 'change-added' : 
                       change.changeType === 'Modified' ? 'change-modified' : 'change-deleted';
    tr.className = changeClass;
    
    const date = new Date(change.date);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    tr.innerHTML = `
      <td>${esc(change.version)}</td>
      <td>${esc(dateStr)}</td>
      <td><strong>${esc(change.term)}</strong></td>
      <td>${esc(change.changeType)}</td>
      <td>${esc(change.field)}</td>
      <td class="old-value">${esc(change.oldValue)}</td>
      <td class="new-value">${esc(change.newValue)}</td>
    `;
    changesTable.appendChild(tr);
  });
}

function setupGlossaryTabs() {
  const tabs = document.querySelectorAll('.glossary-tab');
  const currentView = document.getElementById('glossaryCurrentView');
  const changesView = document.getElementById('glossaryChangesView');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabType = tab.dataset.glossaryTab;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      
      // Show/hide views
      if (tabType === 'current') {
        if (currentView) currentView.style.display = '';
        if (changesView) changesView.style.display = 'none';
      } else if (tabType === 'changes') {
        if (currentView) currentView.style.display = 'none';
        if (changesView) changesView.style.display = '';
        renderGlossaryChanges();
      }
    });
  });
}

function populateGlossaryFieldRefOptions(selected = '') {
  if (!glossaryFieldRef) return;
  const sorted = [...fields].sort((a, b) => {
    const sysA = (a.system || '').toLowerCase();
    const sysB = (b.system || '').toLowerCase();
    if (sysA !== sysB) return sysA.localeCompare(sysB);
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
  const options = ['<option value="">(none)</option>'];
  let hasMatch = false;
  sorted.forEach((f) => {
    const value = fieldRefValue(f);
    const isSelected = fieldRefMatches(f, selected);
    if (isSelected) hasMatch = true;
    options.push(
      `<option value="${esc(value)}"${isSelected ? ' selected' : ''}>${esc(
        fieldRefLabel(f)
      )}</option>`
    );
  });
  if (selected && !hasMatch) {
    options.push(
      `<option value="${esc(selected)}" selected>${esc(
        selected
      )} (not found)</option>`
    );
  }
  glossaryFieldRef.innerHTML = options.join('');
}
function openGlossaryDialog(index = null) {
  editGlossaryIndex = index;
  state.editGlossaryIndex = editGlossaryIndex;
  glossaryForm?.reset();
  const selectedRef =
    index !== null
      ? glossaryTerms[index].fieldRefId || glossaryTerms[index].fieldRef || ''
      : '';
  populateGlossaryFieldRefOptions(selectedRef);
  if (!glossaryForm) return;
  if (index !== null) {
    const g = glossaryTerms[index];
    glossaryForm.elements.term.value = g.term || '';
    glossaryForm.elements.definition.value = g.definition || '';
    glossaryForm.elements.info.value = g.info || '';
    glossaryForm.elements.owner.value = g.owner || '';
    glossaryForm.elements.type.value = g.type || 'Term';
    populateGlossaryFieldRefOptions(g.fieldRefId || g.fieldRef || '');
  }
  openDialog(glossaryDialog);
}
glossaryForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Ask if user wants to create a new version using the custom dialog
  const createNewVersion = await showVersionDialog();
  
  const formData = new FormData(glossaryForm);
  const data = Object.fromEntries(formData.entries());
  const glossaryId =
    editGlossaryIndex !== null
      ? glossaryTerms[editGlossaryIndex].id || uid('gls')
      : uid('gls');

  const linkedField = findFieldByFieldRef(data.fieldRef || '');

  const record = {
    id: glossaryId,
    term: data.term?.trim() || '',
    definition: data.definition?.trim() || '',
    info: data.info?.trim() || '',
    owner: data.owner?.trim() || '',
    fieldRef: linkedField ? fieldRefLabel(linkedField) : '',
    fieldRefId: linkedField ? linkedField.id : '',
    type: data.type && GLOSSARY_TYPES.includes(data.type) ? data.type : 'Term',
  };

  // Log changes to changelog (always happens)
  // And optionally increment version
  if (editGlossaryIndex !== null) {
    // Editing existing term
    const oldRecord = glossaryTerms[editGlossaryIndex];
    logGlossaryChanges(oldRecord, record, 'modified', createNewVersion);
    glossaryTerms[editGlossaryIndex] = record;
  } else {
    // New term
    logGlossaryChanges(null, record, 'added', createNewVersion);
    glossaryTerms.push(record);
  }

  fields.forEach((field) => {
    if (field.glossaryId === glossaryId) {
      if (!linkedField || field.id !== linkedField.id) {
        delete field.glossaryId;
      }
    }
  });

  if (linkedField) {
    if (linkedField.glossaryId && linkedField.glossaryId !== glossaryId) {
      const other = glossaryTerms.find((g) => g.id === linkedField.glossaryId);
      if (other) {
        other.fieldRef = '';
        other.fieldRefId = '';
      }
    }
    linkedField.glossaryId = glossaryId;
  }

  saveFields();
  saveGlossary();
  saveGlossaryVersionAndChanges();
  renderGlossaryTable();
  renderFieldsTable();
  updateGlossaryVersionDisplay();
  if (document.body.getAttribute('data-mode') === 'map') renderDataMap();
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
function updateSourceFieldSelect(preselectValue = null) {
  const sys = sourceSystemSelect?.value;
  const list = sys ? fields.filter((f) => f.system === sys) : [];
  if (!sourceFieldSelect) return;
  const desiredValue =
    preselectValue !== null ? preselectValue : sourceFieldSelect.value;
  const applyUpdate = () => {
    sourceFieldSelect.innerHTML = sys
      ? `<option value="">(select field)</option>` +
        list.map((f) => `<option value="${f.name}">${f.name}</option>`).join('')
      : `<option value="">Select a system first</option>`;
    sourceFieldSelect.disabled = !sys || list.length === 0;
    if (sys && desiredValue) {
      const hasOption = list.some((f) => f.name === desiredValue);
      sourceFieldSelect.value = hasOption ? desiredValue : '';
    } else {
      sourceFieldSelect.value = '';
    }
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(applyUpdate);
  } else {
    applyUpdate();
  }
}

function installSelectFirstClickOpen(select) {
  if (!select) return;
  select.addEventListener('pointerdown', (event) => {
    if (select.disabled) return;
    if (
      document.activeElement !== select &&
      typeof select.showPicker === 'function'
    ) {
      event.preventDefault();
      select.focus({ preventScroll: true });
      try {
        select.showPicker();
      } catch (err) {
        console.debug('[gdf] showPicker failed', err);
      }
    }
  });
}

function openFieldDialog(index = null, opts = {}) {
  // Edit-Index sauber setzen (ersetzt alte Variablen-Zuweisung)
  setEditFieldIndex(index);
  if (!fieldForm) return;

  fieldForm.reset();
  ensureFieldDialogHandlers();

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
      updateSourceFieldSelect(f.source.field || '');
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

// ===== Field-Form Submit (CREATE/UPDATE stabil) =====
// ===== Field-Form Submit (CREATE/UPDATE stabil) =====
fieldForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  try {
    // --- Allowed Values lesen ---
    const rawEnumEl = document.getElementById('fld-allowed-values');
    const rawEnum   = (rawEnumEl?.value || '').trim();
    const allowedValues = rawEnum
      ? Array.from(new Set(rawEnum.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean)))
      : [];

    // --- Formdaten lesen ---
    const fd = new FormData(fieldForm);
    const data = Object.fromEntries(fd.entries());

    const pickedSourceSystem = (data.sourceSystem || '').trim();
    const pickedSourceField  = (data.sourceField  || '').trim();
    delete data.sourceSystem;
    delete data.sourceField;

    const pickedFoundationId = (fieldForm.elements.foundationObject?.value || '').trim();
    const pickedGlossaryId   = (fieldForm.elements.glossaryId?.value || '').trim();

    data.mandatory = !!fieldForm.elements['fld-mandatory']?.checked;
    data.local     = !!fieldForm.elements.local?.checked;

    const sysNameForLE = data.system;
    const isLocalForLE = !!data.local;
    let pickedLENumber = (fieldForm.elements.legalEntityNumber?.value || '').trim();
    if (!eligibleForLE(sysNameForLE, isLocalForLE)) pickedLENumber = '';

    if (!Array.isArray(state.fields)) state.fields = [];
    const idx = getEditFieldIndex();

    if (idx !== null && state.fields[idx]) {
      // ===== UPDATE =====
      const next = { ...state.fields[idx], ...data };
      next.allowedValues = allowedValues;

      if (pickedFoundationId) next.foundationObjectId = pickedFoundationId; else delete next.foundationObjectId;
      if (pickedGlossaryId)   next.glossaryId        = pickedGlossaryId;   else delete next.glossaryId;
      if (pickedLENumber)     next.legalEntityNumber = pickedLENumber;     else delete next.legalEntityNumber;

      if (pickedSourceSystem) next.source = { system: pickedSourceSystem, field: pickedSourceField };
      else delete next.source;

      state.fields[idx] = next;
    } else {
      // ===== CREATE =====
      const uid = (p='fld') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
      const rec = { id: uid('fld'), ...data, allowedValues };

      if (pickedFoundationId) rec.foundationObjectId = pickedFoundationId;
      if (pickedGlossaryId)   rec.glossaryId        = pickedGlossaryId;
      if (pickedLENumber)     rec.legalEntityNumber = pickedLENumber;
      if (pickedSourceSystem) rec.source            = { system: pickedSourceSystem, field: pickedSourceField };

      state.fields.push(rec);
      setEditFieldIndex(state.fields.length - 1);
    }

    // Persist & UI
    saveFields();
    setTimeout(() => {
      window.renderFieldsTable?.();
      window.renderLocalFieldsTables?.();
      document.dispatchEvent(new CustomEvent('gdf:fields-updated'));
    }, 30);

    clearEditFieldIndex();
    document.getElementById('fieldDialog')?.close?.();

  } catch (err) {
    alert('Speichern fehlgeschlagen: ' + (err?.message || err));
  }
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
    marker.setAttribute('markerWidth', '12');
    marker.setAttribute('markerHeight', '12');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '6');
    marker.setAttribute('markerUnits', 'strokeWidth');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M0,0 L0,12 L12,6 Z');
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
  const paddingY = 32;
  const baseX = 60;
  const baseY = 60;
  const columnGap = 60;

  const fallbackHeight =
    typeof window !== 'undefined' && window.innerHeight
      ? window.innerHeight
      : 800;
  const canvasHeight =
    mapCanvas?.clientHeight || mapCanvas?.offsetHeight || fallbackHeight;

  const maxColumnHeight = Math.max(canvasHeight - baseY * 2, 520);

  let measuredWidth = 0;
  nodeEntries.forEach(({ node }) => {
    if (!measuredWidth) {
      measuredWidth = node.offsetWidth || 0;
    }
  });
  const baseWidth = measuredWidth || 360;
  const columnWidth = baseWidth + columnGap;

  nodeEntries.forEach(({ sys, node }) => {
    const stored = mapPositions[sys.name];
    const sx = Number(stored?.x);
    const sy = Number(stored?.y);
    if (Number.isFinite(sx) && Number.isFinite(sy)) {
      positions.set(sys.name, { x: sx, y: sy });
    }
  });

  let colX = baseX;
  let colY = baseY;

  nodeEntries.forEach(({ sys, node }) => {
    if (positions.has(sys.name)) return;
    const nodeHeight = node.offsetHeight || 220;

    if (colY > baseY && colY + nodeHeight > baseY + maxColumnHeight) {
      colX += columnWidth;
      colY = baseY;
    }

    positions.set(sys.name, { x: colX, y: colY });
    colY += nodeHeight + paddingY;
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

function normalizeFieldKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function resolveFieldRef(systemName, rawName, fallbackName = null) {
  const candidates = fields.filter((f) => f.system === systemName);
  const tryResolve = (name) => {
    if (!name) return null;
    const direct = candidates.find((f) => f.name === name);
    if (direct) return direct.name;
    const normalized = normalizeFieldKey(name);
    if (!normalized) return null;
    const fuzzy = candidates.find(
      (f) => normalizeFieldKey(f.name) === normalized
    );
    return fuzzy ? fuzzy.name : null;
  };

  return (
    tryResolve(rawName) ||
    tryResolve(fallbackName) ||
    rawName ||
    fallbackName ||
    null
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
  const viewport = getMapViewport();
  const row = getFieldEl(systemName, fieldName);

  if (!viewport || !row) return null; // ← verhindert "null is not an object"

  const node = row.closest('.map-node') || row;
  const rowRect = row.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const nodeRectMap = rectToMap(nodeRect);
  const rowRectMap = rectToMap(rowRect);

  const x = side === 'right' ? nodeRectMap.right : nodeRectMap.left;
  const y = (rowRectMap.top + rowRectMap.bottom) / 2;

  return {
    x,
    y,
    side,
    node,
    row,
    nodeRect: nodeRectMap,
    rowRect: rowRectMap,
  };
}
const EDGE_ESCAPE = 28;
const OBSTACLE_MARGIN = 24;
const ROUTER_MARGIN = 24;
const ESCAPE_STEP = 8;

function inflateRect(rect, amount) {
  return {
    left: rect.left - amount,
    right: rect.right + amount,
    top: rect.top - amount,
    bottom: rect.bottom + amount,
  };
}

function pointInsideRect(point, rect) {
  return (
    point.x > rect.left &&
    point.x < rect.right &&
    point.y > rect.top &&
    point.y < rect.bottom
  );
}

function segmentIntersectsRect(p1, p2, rect) {
  if (p1.x === p2.x) {
    const x = p1.x;
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    if (
      x >= rect.left &&
      x <= rect.right &&
      maxY > rect.top &&
      minY < rect.bottom
    ) {
      return true;
    }
  } else if (p1.y === p2.y) {
    const y = p1.y;
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    if (
      y >= rect.top &&
      y <= rect.bottom &&
      maxX > rect.left &&
      minX < rect.right
    ) {
      return true;
    }
  }
  return false;
}

function collectNodeObstacles(excludeNodes = []) {
  if (!mapNodesLayer) return [];
  const excludes = new Set(excludeNodes.filter(Boolean));
  return Array.from(mapNodesLayer.querySelectorAll('.map-node') || [])
    .filter((node) => !excludes.has(node))
    .map((node) =>
      inflateRect(rectToMap(node.getBoundingClientRect()), OBSTACLE_MARGIN)
    );
}

function ensureEscapePoint(point, direction, obstacles) {
  let safe = { ...point };
  const dir = direction >= 0 ? 1 : -1;
  let attempts = 0;
  while (
    obstacles.some((rect) => pointInsideRect(safe, rect)) &&
    attempts < 16
  ) {
    safe = { x: safe.x + dir * ESCAPE_STEP, y: safe.y };
    attempts += 1;
  }
  return safe;
}

function computeRectilinearRoute(start, end, obstacles) {
  const xs = new Set([start.x, end.x]);
  const ys = new Set([start.y, end.y]);

  obstacles.forEach((rect) => {
    xs.add(rect.left - ROUTER_MARGIN);
    xs.add(rect.left);
    xs.add(rect.right);
    xs.add(rect.right + ROUTER_MARGIN);
    ys.add(rect.top - ROUTER_MARGIN);
    ys.add(rect.top);
    ys.add(rect.bottom);
    ys.add(rect.bottom + ROUTER_MARGIN);
  });

  const xVals = Array.from(xs).sort((a, b) => a - b);
  const yVals = Array.from(ys).sort((a, b) => a - b);

  const nodeMap = new Map();
  const keyFor = (ix, iy) => `${ix}:${iy}`;

  for (let ix = 0; ix < xVals.length; ix += 1) {
    for (let iy = 0; iy < yVals.length; iy += 1) {
      const point = { x: xVals[ix], y: yVals[iy], ix, iy };
      if (obstacles.some((rect) => pointInsideRect(point, rect))) continue;
      nodeMap.set(keyFor(ix, iy), point);
    }
  }

  const neighbors = new Map();
  const registerNeighbor = (key, nKey) => {
    if (!nodeMap.has(nKey)) return;
    const list = neighbors.get(key) || [];
    list.push(nKey);
    neighbors.set(key, list);
  };

  nodeMap.forEach((point, key) => {
    const { ix, iy } = point;
    const tryNeighbor = (nx, ny) => {
      const nKey = keyFor(nx, ny);
      if (!nodeMap.has(nKey)) return;
      const next = nodeMap.get(nKey);
      if (obstacles.some((rect) => segmentIntersectsRect(point, next, rect)))
        return;
      registerNeighbor(key, nKey);
    };
    tryNeighbor(ix + 1, iy);
    tryNeighbor(ix - 1, iy);
    tryNeighbor(ix, iy + 1);
    tryNeighbor(ix, iy - 1);
  });

  const startKey = keyFor(xVals.indexOf(start.x), yVals.indexOf(start.y));
  const endKey = keyFor(xVals.indexOf(end.x), yVals.indexOf(end.y));
  if (!nodeMap.has(startKey) || !nodeMap.has(endKey)) return null;

  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const unvisited = new Set(nodeMap.keys());

  while (unvisited.size) {
    let current = null;
    let minDist = Infinity;
    unvisited.forEach((key) => {
      const d = dist.has(key) ? dist.get(key) : Infinity;
      if (d < minDist) {
        minDist = d;
        current = key;
      }
    });
    if (current === null) break;
    unvisited.delete(current);
    if (current === endKey) break;

    const point = nodeMap.get(current);
    const nbs = neighbors.get(current) || [];
    nbs.forEach((nKey) => {
      if (!unvisited.has(nKey)) return;
      const next = nodeMap.get(nKey);
      const weight = Math.abs(next.x - point.x) + Math.abs(next.y - point.y);
      const alt = minDist + weight;
      if (alt < (dist.get(nKey) ?? Infinity)) {
        dist.set(nKey, alt);
        prev.set(nKey, current);
      }
    });
  }

  if (!dist.has(endKey)) return null;

  const keys = [];
  let cursor = endKey;
  while (cursor) {
    keys.push(cursor);
    if (cursor === startKey) break;
    cursor = prev.get(cursor);
  }
  if (keys[keys.length - 1] !== startKey) return null;
  keys.reverse();
  return keys.map((key) => ({ x: nodeMap.get(key).x, y: nodeMap.get(key).y }));
}

function simplifyOrthogonalPoints(points = []) {
  if (points.length <= 2) return points.slice();

  const deduped = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = deduped[deduped.length - 1];
    const curr = points[i];
    if (!prev) {
      deduped.push(curr);
      continue;
    }
    if (Math.abs(curr.x - prev.x) < 0.5 && Math.abs(curr.y - prev.y) < 0.5) {
      continue;
    }
    deduped.push(curr);
  }

  if (deduped.length <= 2) return deduped;

  const simplified = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i += 1) {
    const prev = simplified[simplified.length - 1];
    const curr = deduped[i];
    const next = deduped[i + 1];
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    if (
      (Math.abs(dx1) < 1e-6 && Math.abs(dx2) < 1e-6) ||
      (Math.abs(dy1) < 1e-6 && Math.abs(dy2) < 1e-6)
    ) {
      continue;
    }
    simplified.push(curr);
  }
  simplified.push(deduped[deduped.length - 1]);
  return simplified;
}

function pointsToPath(points = []) {
  if (!points.length) return '';
  const format = (v) => Math.round(v * 100) / 100;
  const commands = [`M ${format(points[0].x)},${format(points[0].y)}`];
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    commands.push(`L ${format(p.x)},${format(p.y)}`);
  }
  return commands.join(' ');
}

// Build a curved path that avoids obstacles
function buildCurvedEdgePath(
  start,
  end,
  startSide = 'right',
  endSide = 'left'
) {
  if (!start || !end) return '';

  const format = (v) => Math.round(v * 100) / 100;
  
  // Calculate control points for Bezier curve
  const startDir = startSide === 'right' ? 1 : -1;
  const endDir = endSide === 'right' ? 1 : -1;
  
  // Distance between start and end
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Control point offset based on distance - creates a smooth curve
  const controlOffset = Math.min(dist / 2, 120);
  
  // Get obstacles to check if we need to adjust the curve
  const excludeNodes = [];
  if (start.node) excludeNodes.push(start.node);
  if (end.node && end.node !== start.node) excludeNodes.push(end.node);
  const obstacles = collectNodeObstacles(excludeNodes);
  
  // First control point: extend from start in the direction it's pointing
  let cp1x = start.x + startDir * controlOffset;
  let cp1y = start.y;
  
  // Second control point: approach end from the direction it needs
  let cp2x = end.x + endDir * controlOffset;
  let cp2y = end.y;
  
  // Check if the curve path might intersect obstacles
  // If so, adjust control points to go around
  const midY = (start.y + end.y) / 2;
  let needsVerticalAdjustment = false;
  
  for (const obstacle of obstacles) {
    // Check if our straight path intersects this obstacle
    const pathRect = {
      left: Math.min(start.x, end.x),
      right: Math.max(start.x, end.x),
      top: Math.min(start.y, end.y),
      bottom: Math.max(start.y, end.y)
    };
    
    if (rectsOverlap(pathRect, obstacle, -10)) {
      needsVerticalAdjustment = true;
      // Adjust control points to curve above or below the obstacle
      const curveAbove = midY < obstacle.top;
      const offset = curveAbove ? -OBSTACLE_MARGIN : OBSTACLE_MARGIN;
      cp1y += offset;
      cp2y += offset;
      break;
    }
  }
  
  // Create a cubic Bezier curve
  // M = move to start, C = cubic bezier with two control points
  return `M ${format(start.x)},${format(start.y)} C ${format(cp1x)},${format(cp1y)} ${format(cp2x)},${format(cp2y)} ${format(end.x)},${format(end.y)}`;
}

function buildRoutedEdgePath(
  start,
  end,
  startSide = 'right',
  endSide = 'left'
) {
  if (!start || !end) return '';

  const startDir = startSide === 'right' ? 1 : -1;
  const endDir = endSide === 'right' ? 1 : -1;

  const excludeNodes = [];
  if (start.node) excludeNodes.push(start.node);
  if (end.node && end.node !== start.node) excludeNodes.push(end.node);
  const obstacles = collectNodeObstacles(excludeNodes);

  const rawStartEscape = { x: start.x + startDir * EDGE_ESCAPE, y: start.y };
  const rawEndEscape = { x: end.x + endDir * EDGE_ESCAPE, y: end.y };

  const startEscape = ensureEscapePoint(rawStartEscape, startDir, obstacles);
  const endEscape = ensureEscapePoint(rawEndEscape, endDir, obstacles);

  let route = computeRectilinearRoute(startEscape, endEscape, obstacles);
  if (!route || route.length < 2) {
    route = [startEscape, { x: startEscape.x, y: endEscape.y }, endEscape];
  }

  const points = simplifyOrthogonalPoints([start, ...route, end]);
  return pointsToPath(points);
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
  const selectedFieldName = resolveFieldRef(system, field) || field;
  const selectedKey = normalizeFieldKey(selectedFieldName);
  const srcEl =
    getFieldEl(system, selectedFieldName) || getFieldEl(system, field);
  if (srcEl) {
    srcEl.classList.add('is-highlight');
    // Scroll selected field into view if needed
    srcEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const outgoing = fields.filter((f) => {
    if (!f.source?.system || f.source.system !== system) return false;
    const refName =
      resolveFieldRef(f.source.system, f.source.field, f.name) ||
      f.source.field ||
      f.name;
    return normalizeFieldKey(refName) === selectedKey;
  });
  const incoming = fields.filter(
    (f) =>
      f.system === system &&
      normalizeFieldKey(f.name) === selectedKey &&
      f.source?.system
  );

  outgoing.forEach((tgt) => {
    const targetName = resolveFieldRef(tgt.system, tgt.name) || tgt.name;
    const tgtEl = getFieldEl(tgt.system, targetName);
    if (tgtEl) {
      tgtEl.classList.add('is-highlight');
      // Scroll target field into view if needed
      tgtEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const p1 = fieldAnchor(system, selectedFieldName, 'right');
    const p2 = fieldAnchor(tgt.system, targetName, 'left');
    if (p1 && p2) {
      const pathD = buildCurvedEdgePath(
        p1,
        p2,
        p1.side || 'right',
        p2.side || 'left'
      );
      if (pathD) {
        drawEdgePath(pathD, true, 'edge-selected');
      }
    }
  });
  incoming.forEach((src) => {
    const sourceName =
      resolveFieldRef(src.source.system, src.source.field, src.name) ||
      src.source.field ||
      src.name;
    const srcRow = getFieldEl(src.source.system, sourceName);
    if (srcRow) {
      srcRow.classList.add('is-highlight');
      // Scroll source field into view if needed
      srcRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const p1 = fieldAnchor(src.source.system, sourceName, 'right');
    const p2 = fieldAnchor(system, selectedFieldName, 'left');
    if (p1 && p2) {
      const pathD = buildCurvedEdgePath(
        p1,
        p2,
        p1.side || 'right',
        p2.side || 'left'
      );
      if (pathD) {
        drawEdgePath(pathD, true, 'edge-selected');
      }
    }
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
  filterOverlay?.classList.add('is-open');
  filterOverlay?.setAttribute('aria-hidden', 'false');
}
function closeFilterOverlay() {
  filterOverlay?.classList.remove('is-open');
  filterOverlay?.setAttribute('aria-hidden', 'true');
}

/* Render Map */
function renderDataMap() {
  if (currentMapView === 'dataobject') {
    renderDataObjectView();
  } else {
    renderSystemView();
  }
}

function renderSystemView() {
  makeEdgeDefs();
  clearEdgesKeepDefs();
  if (!mapNodesLayer) return;
  mapNodesLayer.innerHTML = '';

  const nodeEntries = [];

  systems.forEach((sys) => {
    if (!systemPassesFilters(sys.name)) return;

    // Skip systems without any fields that pass filters
    let list = getFieldsBySystem(sys.name).filter(fieldPassesFilters);
    if (list.length === 0) return;

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
      const glossaryTerm = fieldGlossaryTerm(f);
      const glossaryMarkup = glossaryTerm
        ? formatGlossaryDetail(glossaryTerm)
        : '—';
      details.innerHTML = `
        <div><strong>Mandatory:</strong> ${f.mandatory ? 'Yes' : 'No'}</div>
        <div><strong>Mapping:</strong> ${f.mapping || '-'}</div>
        <div><strong>Data Object:</strong> ${foundationLabelForField(f)}</div>
        <div><strong>Glossary:</strong> ${glossaryMarkup}</div>
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
          safeDrawAllEdges();
        } else {
          selectedFieldRef = { system: sys.name, field: f.name };
          state.selectedFieldRef = selectedFieldRef;
          mapHasUserInteraction = true; // Mark that user has interacted
          drawSelectedFieldEdges();
        }
      });
    });

    header.querySelector('.map-node-toggle').addEventListener('click', (ev) => {
      ev.stopPropagation();
      node.classList.toggle('is-collapsed');
      nodeCollapsed.set(sys.name, node.classList.contains('is-collapsed'));
      if (selectedFieldRef) {
        drawSelectedFieldEdges();
      } else {
        drawSystemEdges();
      }
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

  // Only draw edges if user has interacted with the map (clicked a field)
  if (selectedFieldRef) {
    drawSelectedFieldEdges();
    mapHasUserInteraction = true;
  } else if (mapHasUserInteraction) {
    drawSystemEdges();
  }
  // Otherwise, no edges are drawn on initial load

  requestAnimationFrame(() => fitMapToContent());
}

/* ==================== Data Object View ==================== */
function renderDataObjectView() {
  makeEdgeDefs();
  clearEdgesKeepDefs();
  if (!mapNodesLayer) return;
  mapNodesLayer.innerHTML = '';

  const nodeEntries = [];

  // Get all data objects that have fields
  // If a data object is selected, only show that one, otherwise show all
  let dataObjectsWithFields = dataObjects.filter((obj) => {
    const fieldCount = getFieldsByDataObject(obj.id).filter(fieldPassesFilters).length;
    return fieldCount > 0;
  });
  
  if (selectedDataObject) {
    dataObjectsWithFields = dataObjectsWithFields.filter((obj) => obj.id === selectedDataObject.id);
  }

  dataObjectsWithFields.forEach((obj) => {
    const fieldCount = getFieldsByDataObject(obj.id).filter(fieldPassesFilters).length;
    
    const node = document.createElement('div');
    node.className = 'map-node map-data-object';
    node.dataset.dataObjectId = obj.id;
    const dom = domainByName(obj.domain || '');
    const color = dom?.color || '#9aa0a6';
    node.style.borderColor = color;

    const header = document.createElement('div');
    header.className = 'map-node-header';
    header.style.background =
      'linear-gradient(0deg, rgba(0,0,0,0) 0%, ' +
      hexWithAlpha(color, 0.08) +
      ' 100%)';

    const isSelected = selectedDataObject && selectedDataObject.id === obj.id;
    header.innerHTML = `<div class="map-node-title">${obj.name}</div><div class="map-node-count">${fieldCount} field${fieldCount !== 1 ? 's' : ''}</div>`;
    node.appendChild(header);

    if (isSelected) {
      node.classList.add('is-selected');
    }

    // Click handler for data object
    node.addEventListener('click', (ev) => {
      if (ev.target.closest('.map-node-toggle, .chev, button')) return;
      
      if (selectedDataObject && selectedDataObject.id === obj.id) {
        // Deselect
        selectedDataObject = null;
        state.selectedDataObject = selectedDataObject;
        renderDataObjectView();
        fitMapToContent();
      } else {
        // Select and center
        selectedDataObject = { id: obj.id, name: obj.name };
        state.selectedDataObject = selectedDataObject;
        mapHasUserInteraction = true;
        renderDataObjectView();
        centerDataObject(obj.id);
      }
    });

    mapNodesLayer.appendChild(node);
    nodeEntries.push({ obj, node, header });
  });

  // If a data object is selected, show connected systems
  if (selectedDataObject) {
    const systemsWithFields = getSystemsWithFieldsForDataObject(selectedDataObject.id);
    
    systemsWithFields.forEach(({ sys, fieldCount }) => {
      const node = document.createElement('div');
      node.className = 'map-node map-system-for-object';
      node.dataset.system = sys.name;
      node.dataset.dataObjectId = selectedDataObject.id;
      const dom = domainByName(sys.dataDomain || '');
      const color = dom?.color || '#9aa0a6';
      node.style.borderColor = color;

      const header = document.createElement('div');
      header.className = 'map-node-header';
      header.style.background =
        'linear-gradient(0deg, rgba(0,0,0,0) 0%, ' +
        hexWithAlpha(color, 0.08) +
        ' 100%)';

      header.innerHTML = `<div class="map-node-title">${sys.name}</div><div class="map-node-count">${fieldCount} field${fieldCount !== 1 ? 's' : ''}</div>`;
      node.appendChild(header);

      // Click handler to show fields
      node.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (ev.target.closest('.map-node-toggle, .chev, button')) return;
        
        const isOpen = node.classList.contains('is-open');
        
        if (isOpen) {
          node.classList.remove('is-open');
          const fieldsContainer = node.querySelector('.map-node-fields');
          if (fieldsContainer) fieldsContainer.remove();
        } else {
          node.classList.add('is-open');
          showFieldsForSystemAndDataObject(node, sys.name, selectedDataObject.id);
        }
      });

      mapNodesLayer.appendChild(node);
      nodeEntries.push({ sys, node, header, isSystem: true });
    });
  }

  // Position nodes
  const pos = computeDataObjectPositions(nodeEntries);
  
  nodeEntries.forEach(({ obj, sys, node, header, isSystem }) => {
    const name = isSystem ? sys.name : obj.id.toString();
    const stored = isSystem ? mapPositions[name] : dataObjectPositions[name];
    const fallback = stored
      ? { x: Number(stored.x) || 40, y: Number(stored.y) || 40 }
      : { x: 40, y: 40 };
    const p = pos.get(name) || fallback;
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
    
    if (isSystem) {
      mapPositions[name] = { x: p.x, y: p.y };
    } else {
      dataObjectPositions[name] = { x: p.x, y: p.y };
    }
    
    enableDragDataObject(node, header, name, isSystem);
  });

  // Draw edges from selected data object to systems
  if (selectedDataObject) {
    // Use requestAnimationFrame to ensure nodes are positioned before drawing edges
    requestAnimationFrame(() => {
      drawDataObjectEdges();
    });
  }

  requestAnimationFrame(() => fitMapToContent());
}

function getFieldsByDataObject(dataObjectId) {
  return fields.filter((f) => String(f.foundationObjectId) === String(dataObjectId));
}

function getSystemsWithFieldsForDataObject(dataObjectId) {
  const systemMap = new Map();
  
  getFieldsByDataObject(dataObjectId)
    .filter(fieldPassesFilters)
    .forEach((field) => {
      const sys = systemByName(field.system);
      if (!sys || !systemPassesFilters(sys.name)) return;
      
      if (!systemMap.has(sys.name)) {
        systemMap.set(sys.name, { sys, fieldCount: 0 });
      }
      systemMap.get(sys.name).fieldCount++;
    });
  
  return Array.from(systemMap.values());
}

function showFieldsForSystemAndDataObject(node, systemName, dataObjectId) {
  const fieldsList = getFieldsByDataObject(dataObjectId)
    .filter((f) => f.system === systemName && fieldPassesFilters(f));
  
  const wrap = document.createElement('div');
  wrap.className = 'map-node-fields';
  
  if (fieldsList.length > 10) wrap.classList.add('is-scroll');
  
  fieldsList.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'map-field';
    row.dataset.system = systemName;
    row.dataset.field = f.name;

    const chev = document.createElement('div');
    chev.className = 'chev';
    chev.title = 'Toggle details';
    
    const name = document.createElement('div');
    name.className = 'map-field-name';
    name.textContent = f.name;
    
    const right = document.createElement('div');
    right.className = 'map-field-badges';
    
    if (f.mandatory) {
      const b = document.createElement('span');
      b.className = 'badge';
      b.textContent = 'mandatory';
      right.appendChild(b);
    }

    row.appendChild(chev);
    row.appendChild(name);
    row.appendChild(right);
    wrap.appendChild(row);

    const details = document.createElement('div');
    details.className = 'map-field-details';
    const glossaryTerm = fieldGlossaryTerm(f);
    const glossaryMarkup = glossaryTerm
      ? formatGlossaryDetail(glossaryTerm)
      : '—';
    details.innerHTML = `
      <div><strong>Type:</strong> ${f.type || '—'}</div>
      <div><strong>Mandatory:</strong> ${f.mandatory ? 'Yes' : 'No'}</div>
      <div><strong>Mapping:</strong> ${f.mapping || '-'}</div>
      <div><strong>Glossary:</strong> ${glossaryMarkup}</div>
    `;
    wrap.appendChild(details);
    
    chev.addEventListener('click', (ev) => {
      ev.stopPropagation();
      row.classList.toggle('is-open');
    });
  });
  
  node.appendChild(wrap);
}

function computeDataObjectPositions(nodeEntries = []) {
  const positions = new Map();
  const paddingY = 32;
  const baseX = 60;
  const baseY = 60;
  const columnGap = 60;

  const fallbackHeight =
    typeof window !== 'undefined' && window.innerHeight
      ? window.innerHeight
      : 800;
  const canvasHeight =
    mapCanvas?.clientHeight || mapCanvas?.offsetHeight || fallbackHeight;

  const maxColumnHeight = Math.max(canvasHeight - baseY * 2, 520);

  let measuredWidth = 0;
  nodeEntries.forEach(({ node }) => {
    if (!measuredWidth) {
      measuredWidth = node.offsetWidth || 0;
    }
  });
  const baseWidth = measuredWidth || 280; // Updated to match smaller data object width
  const columnWidth = baseWidth + columnGap;

  // Check for stored positions
  nodeEntries.forEach(({ obj, sys, isSystem }) => {
    const name = isSystem ? sys.name : obj.id.toString();
    const stored = isSystem ? mapPositions[name] : dataObjectPositions[name];
    const sx = Number(stored?.x);
    const sy = Number(stored?.y);
    if (Number.isFinite(sx) && Number.isFinite(sy)) {
      positions.set(name, { x: sx, y: sy });
    }
  });

  // If data object is selected, position it in the center and systems around it
  if (selectedDataObject && nodeEntries.length > 0) {
    const dataObjectEntry = nodeEntries.find((e) => !e.isSystem && e.obj.id === selectedDataObject.id);
    const systemEntries = nodeEntries.filter((e) => e.isSystem);
    
    if (dataObjectEntry) {
      const name = dataObjectEntry.obj.id.toString();
      
      // Get canvas width for proper centering
      const canvasWidth = mapCanvas?.clientWidth || mapCanvas?.offsetWidth || 1200;
      
      // Always position data object in center (don't use stored position)
      const centerX = canvasWidth / 2 - 140; // 140 = half of node width (280px)
      const centerY = canvasHeight / 2 - 50; // Approximate half of node height
      positions.set(name, { x: centerX, y: centerY });
      
      // Position systems in a circle around the data object
      const dataObjPos = positions.get(name);
      const radius = 300; // Reduced radius to keep systems visible
      const angleStep = (2 * Math.PI) / Math.max(systemEntries.length, 1);
      
      // Always reposition systems around the selected data object (ignore stored positions)
      systemEntries.forEach((entry, idx) => {
        const sysName = entry.sys.name;
        const angle = idx * angleStep - Math.PI / 2; // Start from top
        const x = dataObjPos.x + radius * Math.cos(angle);
        const y = dataObjPos.y + radius * Math.sin(angle);
        positions.set(sysName, { x, y });
      });
    }
  } else {
    // Default grid layout for data objects - spread them across the screen
    const itemsPerRow = 3; // 3 columns for better distribution
    const rowGap = 100;
    const colGap = 150;
    
    let currentRow = 0;
    let currentCol = 0;
    
    nodeEntries.forEach(({ obj, node }) => {
      const name = obj.id.toString();
      if (positions.has(name)) return;
      
      const x = baseX + currentCol * (baseWidth + colGap);
      const y = baseY + currentRow * (220 + rowGap); // 220 is approximate node height
      
      positions.set(name, { x, y });
      
      currentCol++;
      if (currentCol >= itemsPerRow) {
        currentCol = 0;
        currentRow++;
      }
    });
  }

  return positions;
}

function enableDragDataObject(node, handle, name, isSystem) {
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
    
    if (isSystem) {
      mapPositions[name] = { x: nx, y: ny };
    } else {
      dataObjectPositions[name] = { x: nx, y: ny };
    }
    
    if (selectedDataObject) drawDataObjectEdges();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = 'grab';
    if (lastValid) {
      if (isSystem) {
        mapPositions[name] = lastValid;
        savePositions();
      } else {
        dataObjectPositions[name] = lastValid;
        savePositions();
      }
    }
  });
}

function centerDataObject(dataObjectId) {
  const node = mapNodesLayer?.querySelector(
    `.map-data-object[data-data-object-id="${dataObjectId}"]`
  );
  if (!node) return;
  
  const rect = node.getBoundingClientRect();
  const canvasRect = mapCanvas.getBoundingClientRect();
  
  // Calculate center position
  const centerX = canvasRect.width / 2;
  const centerY = canvasRect.height / 2;
  
  const nodeX = parseFloat(node.style.left) || 0;
  const nodeY = parseFloat(node.style.top) || 0;
  
  const offsetX = centerX - (nodeX * mapTransformState.k) - (rect.width / 2);
  const offsetY = centerY - (nodeY * mapTransformState.k) - (rect.height / 2);
  
  mapTransformState.x = offsetX;
  mapTransformState.y = offsetY;
  
  applyMapTransform();
}

function drawDataObjectEdges() {
  if (!selectedDataObject) return;
  clearEdgesKeepDefs();
  
  const dataObjectNode = mapNodesLayer?.querySelector(
    `.map-data-object[data-data-object-id="${selectedDataObject.id}"]`
  );
  if (!dataObjectNode) {
    console.warn('Data object node not found for id:', selectedDataObject.id);
    return;
  }
  
  const systemNodes = mapNodesLayer?.querySelectorAll(
    `.map-system-for-object[data-data-object-id="${selectedDataObject.id}"]`
  );
  if (!systemNodes || systemNodes.length === 0) {
    console.warn('No system nodes found for data object id:', selectedDataObject.id);
    return;
  }
  
  // Get center of data object in canvas coordinates
  const dataObjRect = dataObjectNode.getBoundingClientRect();
  const canvasRect = mapCanvas?.getBoundingClientRect();
  if (!canvasRect) return;
  
  const dataObjCenterX = ((dataObjRect.left + dataObjRect.right) / 2 - canvasRect.left - mapTransformState.x) / mapTransformState.k;
  const dataObjCenterY = ((dataObjRect.top + dataObjRect.bottom) / 2 - canvasRect.top - mapTransformState.y) / mapTransformState.k;
  
  systemNodes.forEach((sysNode) => {
    const sysRect = sysNode.getBoundingClientRect();
    const sysCenterX = ((sysRect.left + sysRect.right) / 2 - canvasRect.left - mapTransformState.x) / mapTransformState.k;
    const sysCenterY = ((sysRect.top + sysRect.bottom) / 2 - canvasRect.top - mapTransformState.y) / mapTransformState.k;
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', dataObjCenterX);
    line.setAttribute('y1', dataObjCenterY);
    line.setAttribute('x2', sysCenterX);
    line.setAttribute('y2', sysCenterY);
    line.setAttribute('stroke', '#007aff');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('marker-end', 'url(#arrowHead)');
    line.style.color = '#007aff';
    
    mapEdgesSvg?.appendChild(line);
  });
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
    else safeDrawAllEdges();
  });
  window.addEventListener('mouseup', () => {
    if (dragging) {
      if (lastValid) mapPositions[name] = { ...lastValid };
      savePositions();
      if (selectedFieldRef) drawSelectedFieldEdges();
      else safeDrawAllEdges();
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
    cw = maxX - minX + 200,
    ch = maxY - minY + 200;
  const k = Math.min(vw / cw, vh / ch, 1.2);
  mapTransformState.k = Math.max(0.5, Math.min(2.5, k));
  mapTransformState.x =
    40 + (vw - cw * mapTransformState.k) / 2 - minX * mapTransformState.k + 40;
  mapTransformState.y =
    40 + (vh - ch * mapTransformState.k) / 2 - minY * mapTransformState.k + 40;
  applyMapTransform();
  if (selectedFieldRef) drawSelectedFieldEdges();
  else safeDrawAllEdges();
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
    const dashboardNavItem = document.getElementById('dashboardNavItem');
    const systemsNavItem = document.getElementById('systemsNavItem');
    const dataMapNavItem = document.getElementById('dataMapNavItem');
    const glossaryNavItem = document.getElementById('glossaryNavItem');
    const adminNavItem = document.getElementById('adminNavItem');

    // =============================
    //  Navigation: Klick-Handler
    // =============================

    // Dashboard
    dashboardNavItem?.addEventListener('click', () => {
      document.body.setAttribute('data-mode', 'dashboard');
      showOnly('dashboard');
      showGlossarySubnav(false);
      showDataMapSubnav(false);
      try {
        renderDashboard();
      } catch (e) {
        console.error(e);
        showErrorBanner(`Dashboard konnte nicht gerendert werden: ${e.message}`);
      }
    });

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
      showDataMapSubnav(false);
      setModeSystems('All Systems'); // rendert Sidebar + Tabellen
    });
    // Data Map
    dataMapNavItem?.addEventListener('click', () => {
      document.body.setAttribute('data-mode', 'map');
      showOnly('map');
      showGlossarySubnav(false);
      showDataMapSubnav(true);
      installDataMapSubnavHandlers(); // View-Buttons einmalig anbinden
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
      showDataMapSubnav(false);
      installGlossarySubnavHandlers(); // Filter-Buttons einmalig anbinden
      setupGlossaryTabs(); // Setup version tabs

      try {
        // Wichtig: NICHT renderGlossaryTable() direkt aufrufen,
        // sondern die Wrapper-Funktion, die auch den Header baut:
        renderGlossary();
        updateGlossaryVersionDisplay();
      } catch (e) {
        console.error(e);
      }
    });

    // Admin
    adminNavItem?.addEventListener('click', () => {
      document.body.setAttribute('data-mode', 'admin');
      showOnly('admin');
      showGlossarySubnav(false);
      showDataMapSubnav(false);
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
    installSelectFirstClickOpen(sourceSystemSelect);
    installSelectFirstClickOpen(sourceFieldSelect);

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
        selectedDataObject = null;
        state.selectedDataObject = selectedDataObject;
        clearSelectionVisuals();
        if (currentMapView === 'dataobject') {
          renderDataObjectView();
          fitMapToContent();
        } else {
          safeDrawAllEdges();
        }
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
      if (currentMapView === 'dataobject' && selectedDataObject) {
        drawDataObjectEdges();
      } else if (selectedFieldRef) {
        drawSelectedFieldEdges();
      } else {
        safeDrawAllEdges();
      }
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
        if (currentMapView === 'dataobject' && selectedDataObject) {
          drawDataObjectEdges();
        } else if (selectedFieldRef) {
          drawSelectedFieldEdges();
        } else {
          safeDrawAllEdges();
        }
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
    
    // Load glossary version and changes
    state.glossaryVersion = loadGlossaryVersion();
    state.glossaryChanges = loadGlossaryChanges();
    updateGlossaryVersionDisplay();

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
  if (!mapEdgesSvg) return;

  clearEdgesKeepDefs();

  const visibleSystems = new Set(
    Array.from(mapNodesLayer?.querySelectorAll('.map-node') || []).map(
      (node) => node.dataset.system
    )
  );

  const drawn = new Set();

  fields.forEach((field) => {
    const source = field.source;
    if (!source?.system) return;

    if (!visibleSystems.has(field.system) || !visibleSystems.has(source.system))
      return;

    const dstFieldName = resolveFieldRef(field.system, field.name);
    const srcFieldName = resolveFieldRef(
      source.system,
      source.field,
      field.name
    );

    if (!srcFieldName || !dstFieldName) return;

    const srcEl = getFieldEl(source.system, srcFieldName);
    const dstEl = getFieldEl(field.system, dstFieldName);
    if (!srcEl || !dstEl) return;

    const key = `${source.system}::${srcFieldName}→${field.system}::${dstFieldName}`;
    if (drawn.has(key)) return;

    const start = fieldAnchor(source.system, srcFieldName, 'right');
    const end = fieldAnchor(field.system, dstFieldName, 'left');
    if (!start || !end) return;
    if (start._invalid || end._invalid) return;

    drawn.add(key);
    const pathD = buildRoutedEdgePath(
      start,
      end,
      start.side || 'right',
      end.side || 'left'
    );
    if (pathD) {
      drawEdgePath(pathD, true);
    }
  });
}

// Falls irgendwo DrawSystemEdges() aufgerufen wird:
window.DrawSystemEdges = drawSystemEdges;

// falls irgendwo noch DrawSystemEdges() aufgerufen wird:
window.DrawSystemEdges = drawSystemEdges;

// Alias, damit alte Aufrufe mit großem D weiter funktionieren:
if (typeof window !== 'undefined') window.DrawSystemEdges = drawSystemEdges;

function resetAllAppData() {
  try {
    localStorage.clear();
    sessionStorage.clear();
    alert('Alle gespeicherten App-Daten wurden gelöscht.');
    location.reload();
  } catch (e) {
    console.error('Reset fehlgeschlagen:', e);
  }
}
// === Reset Button verbinden ===
document.addEventListener('DOMContentLoaded', () => {
  const btnReset = document.getElementById('resetAllAppData');
  if (btnReset) {
    btnReset.addEventListener('click', resetAllAppData);
  }
});

// === MAPPINGS: UI & LOGIC (exported, no auto-run) ===
function setupMappingsFeature() {
  // Doppel-Init verhindern
  if (window.__mappingsInit) return;
  window.__mappingsInit = true;

  // 1) State initial laden
  if (!Array.isArray(state.mappings)) state.mappings = [];
  if (!Array.isArray(state.valueMaps)) state.valueMaps = [];
  try {
    const m = loadMappings?.();
    const v = loadValueMaps?.();
    if (Array.isArray(m)) state.mappings = m;
    if (Array.isArray(v)) state.valueMaps = v;
  } catch (e) {
    console.warn('Mappings/ValueMaps konnte nicht geladen werden:', e);
  }

  // 2) DOM-Refs
  const section = document.getElementById('systems-mappings-section');
  if (!section) return;

  // Sichtbarkeit wird von showMainView gesteuert – hier nur sicherheitshalber an
  section.hidden = false;

  const addBtn = document.getElementById('addMappingBtn');
  if (addBtn) {
    addBtn.onclick = () => {
      console.log('[Mappings] + New Mapping');
      // Öffne den Editor immer; Auswahl kann im Dialog erfolgen
      openEditor(null);
    };
  } else {
    console.warn('[Mappings] addMappingBtn nicht gefunden');
  }
  const tbody   = document.getElementById('mappingsTbody');

  const fLE     = document.getElementById('mapFilterLE');
  const fSYS    = document.getElementById('mapFilterSystem');
  const fDO     = document.getElementById('mapFilterDO');

  const modal   = document.getElementById('mappingEditorModal');
  const btnClose  = document.getElementById('mapEditClose');
  const btnCancel = document.getElementById('mapEditCancel');
  const btnSave   = document.getElementById('mapEditSave');
  const btnAddGlobalValue = document.getElementById('mapAddGlobalAllowedValue');

  // 3) Filter befüllen
  function unique(list){ return Array.from(new Set(list)).filter(Boolean); }
  function fillFilters() {
    const locals = getLocalFields();

    const allLE  = unique(locals.map(f => String(f.legalEntityNumber   || '')));
    const allSYS = unique(locals.map(f => String(f.system              || '')));
    const allDO  = unique(locals.map(f => String(f.foundationObjectId  || '')));

    function fill(sel, items) {
      if (!sel) return;
      sel.innerHTML = '';
      sel.append(new Option('Alle', ''));
      items.forEach(v => sel.append(new Option(v, v)));
    }
    fill(fLE,  allLE);
    fill(fSYS, allSYS);
    fill(fDO,  allDO);
  }

  // 4) Mapping-Liste rendern
  function renderList() {
    const filter = {
      legalEntityId: fLE?.value || undefined,
      systemId:      fSYS?.value || undefined,
      dataObjectId:  fDO?.value  || undefined,
    };

    const mappings = findMappings(filter);
    tbody.innerHTML = '';

    if (!mappings.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8; // 8 Spalten laut Thead
      td.textContent = 'Keine Mappings gefunden. Klicke auf „+ Neues Mapping“.';
      tr.append(td);
      tbody.append(tr);
      return;
    }

    const lfLabel = (f) => f ? `${f.name} (Local)` : '—';
    const gfLabel = (f) => f ? (f.name || '—') : '—';

    mappings.forEach((m) => {
      const leText  = m.legalEntityId || '—';
      const sysText = m.systemId || '—';

      const lf = findFieldById(m.localFieldId);
      const gf = findFieldById(m.globalFieldId);

      const localFieldText  = lfLabel(lf) || (m.localFieldId  || '—');
      const globalFieldText = gfLabel(gf) || (m.globalFieldId || '—');

      // ValueMap (Paare) ermitteln
      const vm    = findValueMapByMappingId(m.id);
      const pairs = (vm && Array.isArray(vm.pairs) && vm.pairs.length)
        ? vm.pairs
        : [{ from: '—', to: '—' }];

      // Für jedes Paar eine Zeile
      pairs.forEach((p) => {
        const tr = document.createElement('tr');

        const tdLE        = document.createElement('td');
        const tdSYS       = document.createElement('td');
        const tdLocal     = document.createElement('td');
        const tdGlobal    = document.createElement('td');
        const tdLocalVal  = document.createElement('td');
        const tdGlobalVal = document.createElement('td');
        const tdStatus    = document.createElement('td');
        const tdActions   = document.createElement('td');

        // Klassen setzen (für Styles/Monospace/Fixed widths etc.)
        tdLE.className        = 'col-le mono';
        tdSYS.className       = 'col-system';
        tdLocal.className     = 'col-local';
        tdGlobal.className    = 'col-global';
        tdLocalVal.className  = 'col-local-val';
        tdGlobalVal.className = 'col-global-val';
        tdStatus.className    = 'col-status';
        tdActions.className   = 'col-actions table-actions';

        // Inhalte
        tdLE.textContent        = leText;
        tdSYS.textContent       = sysText;
        tdLocal.textContent     = localFieldText;
        tdGlobal.textContent    = globalFieldText;
        tdLocalVal.textContent  = (p?.from ?? '—') || '—';
        tdGlobalVal.textContent = (p?.to   ?? '—') || '—';
        tdStatus.innerHTML      = `<span class="badge badge--${(m.status || 'DRAFT').toLowerCase()}">${m.status || 'DRAFT'}</span>`;

        // Actions
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn--sm btn--ghost';
        editBtn.textContent = '✎ Edit';
        editBtn.addEventListener('click', () => openEditor(m));

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn--sm btn--ghost';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => {
          if (!confirm('Mapping wirklich löschen?')) return;
          state.mappings = state.mappings.filter(x => x.id !== m.id);
          state.valueMaps = state.valueMaps.filter(vm => vm.fieldMappingId !== m.id);
          saveMappings(state.mappings);
          saveValueMaps(state.valueMaps);
          renderList();
        });

        tdActions.append(editBtn, delBtn);

        tr.append(tdLE, tdSYS, tdLocal, tdGlobal, tdLocalVal, tdGlobalVal, tdStatus, tdActions);
        tbody.append(tr);
      });
    });
  }
  // Auch extern nutzbar machen (showMainView ruft das optional auf)
  window.__renderMappingsList = renderList;

  // 5) Editor öffnen/füllen
  let currentEditing = null;

  function openEditor(mapping) {
    const modal = document.getElementById('mappingEditorModal');
    if (!modal) {
      console.error('[Mappings] #mappingEditorModal fehlt im DOM');
      alert('Mapping-Editor-Modal nicht gefunden.');
      return;
    }
  
    // Modal sichtbar machen (mit deinem CSS kompatibel)
    modal.removeAttribute('hidden');
    modal.style.display = 'flex';
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
  
    // Editierzustand
    currentEditing = mapping ? { ...mapping } : null;
  
    try {
      // ---- DOM-Refs
      const selLE       = document.getElementById('mapEditLE');
      const selSYS      = document.getElementById('mapEditSystem');
      const selLocal    = document.getElementById('mapEditLocalField');
      const selGlobal   = document.getElementById('mapEditGlobalField');
      const pairsTbody  = document.getElementById('mapPairsTbody');
      const btnAddGlobalValue = document.getElementById('mapAddGlobalAllowedValue');
      const btnClose    = document.getElementById('mapEditClose');
      const btnCancel   = document.getElementById('mapEditCancel');
      const btnSave     = document.getElementById('mapEditSave');
  
      const missing = [];
      if (!selLE)       missing.push('#mapEditLE');
      if (!selSYS)      missing.push('#mapEditSystem');
      if (!selLocal)    missing.push('#mapEditLocalField');
      if (!selGlobal)   missing.push('#mapEditGlobalField');
      if (!pairsTbody)  missing.push('#mapPairsTbody');
      if (!btnSave)     missing.push('#mapEditSave');
      if (missing.length) {
        console.error('[Mappings] Fehlende Editor-Elemente:', missing.join(', '));
        alert('Einige Editor-Elemente fehlen: ' + missing.join(', '));
        return;
      }
  
      // ---- Helper
      const uniq = (arr) => Array.from(new Set(arr)).filter(Boolean);
      const fLEFilter  = document.getElementById('mapFilterLE');
      const fSYSFilter = document.getElementById('mapFilterSystem');
      const fDOFilter  = document.getElementById('mapFilterDO');
  
      function fillSelect(sel, items, getLabel = x => x, getValue = x => x, withBlank = false) {
        sel.innerHTML = '';
        if (withBlank) sel.append(new Option('— Select —', ''));
        items.forEach(item => sel.append(new Option(getLabel(item), getValue(item))));
      }
  
      // ---- Kandidatenlisten
      function allLocalFields()  { return getLocalFields?.()  || []; }
      function allGlobalFields() { return getGlobalFields?.() || []; }
  
      // LE/SYS-Listen aus lokalen Feldern ableiten (nur vorhandene)
      const LE_LIST  = uniq(allLocalFields().map(f => String(f.legalEntityNumber || '')));
      const SYS_LIST = uniq(allLocalFields().map(f => String(f.system || '')));
  
      fillSelect(selLE,  LE_LIST,  v => v, v => v, true);
      fillSelect(selSYS, SYS_LIST, v => v, v => v, true);
  
      // Vorbelegung nur wenn wir editieren (nicht bei neuem Mapping)
      // Legal Entity should NOT be pre-filled per requirement
      if (currentEditing?.systemId) {
        selSYS.value = currentEditing.systemId;
      }
  
      // Locals nach LE+SYS (+ optional DO-Filter aus der Liste) filtern
      function candidateLocals() {
        return getLocalFields({
          legalEntityId: selLE.value || undefined,
          systemId:      selSYS.value || undefined,
          dataObjectId:  fDOFilter?.value || undefined
        });
      }
  
      // Globals nach SYS und DataObject (vom aktuell gewählten Local) filtern
      function candidateGlobals() {
        const sys = (selSYS.value || '').trim();
        const localFO = findFieldById?.(selLocal.value)?.foundationObjectId || (fDOFilter?.value || '');
        return allGlobalFields().filter(f => {
          const okScope  = !f.local; // echte globale Felder
          const okSys    = !sys || f.system === sys;
          const okFO     = !localFO || f.foundationObjectId === localFO;
          return okScope && okSys && okFO;
        });
      }
  
      // ---- Wert-Paare rendern
      function renderPairs() {
        const localFieldId  = selLocal.value;
        const globalFieldId = selGlobal.value;
  
        const gVals = globalFieldId ? (getAllowedValues?.(globalFieldId) || []) : [];
        const lVals = localFieldId  ? (getAllowedValues?.(localFieldId)  || []) : [];
  
        // Tabelle
        pairsTbody.innerHTML = '';
  
        if (!localFieldId || !globalFieldId) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 2; td.textContent = 'Bitte Local Field und Global Field auswählen.';
          td.style.textAlign = 'center'; td.style.color = '#888';
          tr.append(td); pairsTbody.append(tr);
          return;
        }
        if (!lVals.length) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 2; td.textContent = 'Das Local Field hat keine Allowed Values.';
          td.style.textAlign = 'center'; td.style.color = '#888';
          tr.append(td); pairsTbody.append(tr);
          return;
        }
  
        // vorhandene Paare beim Editieren
        let vm = currentEditing?.id ? findValueMapByMappingId?.(currentEditing.id) : null;
        if (!vm) vm = { id: `vmap_${Date.now()}`, fieldMappingId: currentEditing?.id || '__temp__', pairs: [] };
        const toMap = new Map(vm.pairs.map(p => [p.from, p.to || '']));
  
        lVals.forEach(fromVal => {
          const tr  = document.createElement('tr');
          tr.className = 'map-pair-row';
  
          const tdL = document.createElement('td');
          tdL.className = 'col-left';
          tdL.textContent = fromVal;
  
          const tdR = document.createElement('td');
          tdR.className = 'col-right';
          const sel = document.createElement('select');
          sel.className = 'form-control';
          sel.setAttribute('aria-label', `Global Value für "${fromVal}"`);
  
          sel.append(new Option('—', ''));
          gVals.forEach(v => sel.append(new Option(v, v)));
          sel.value = toMap.get(fromVal) || '';
  
          sel.addEventListener('change', () => {
            if (!currentEditing) currentEditing = {};
            if (!(currentEditing._pairs instanceof Map)) {
              currentEditing._pairs = new Map(vm.pairs.map(p => [p.from, p.to || '']));
            }
            currentEditing._pairs.set(fromVal, sel.value || '');
          });
  
          tdR.append(sel);
          tr.append(tdL, tdR);
          pairsTbody.append(tr);
        });
      }
  
      // ---- Selects befüllen (reihenfolgenrichtig!)
      function rebuildFieldOptions() {
        // 1) Locals - preserve current selection
        const currentLocalFieldId = selLocal.value;
        const locals = candidateLocals();
        fillSelect(selLocal, locals,
          f => `${f.name} (${f.foundationObjectId || '-'})`,
          f => f.id,
          true // Blank-Option
        );

        // Restore previous selection if it's still in the list, otherwise use editing value
        if (currentLocalFieldId && locals.some(f => f.id === currentLocalFieldId)) {
          selLocal.value = currentLocalFieldId;
        } else if (currentEditing?.localFieldId && locals.some(f => f.id === currentEditing.localFieldId)) {
          selLocal.value = currentEditing.localFieldId;
        }

        // 2) Globals hängen von Local (DataObject) + System ab
        const globals = candidateGlobals();
        fillSelect(selGlobal, globals,
          f => `${f.name} (${f.system || '-'})`,
          f => f.id,
          true // Blank-Option
        );

        if (currentEditing?.globalFieldId && globals.some(f => f.id === currentEditing.globalFieldId)) {
          selGlobal.value = currentEditing.globalFieldId;
        }

        // 3) Paare erst jetzt
        renderPairs();
      }
  
      // ---- Events (onchange überschreibt alte Listener -> keine Doppelbindung)
      selLE.onchange  = () => { selGlobal.value = ''; rebuildFieldOptions(); };
      selSYS.onchange = () => { selGlobal.value = ''; rebuildFieldOptions(); };
      selLocal.onchange  = () => {
        // Local ändert das Data Object -> Globals neu filtern
        const globals = candidateGlobals();
        fillSelect(selGlobal, globals, f => `${f.name} (${f.system || '-'})`, f => f.id, true);
        selGlobal.value = globals[0]?.id || '';
        renderPairs();
      };
      selGlobal.onchange = renderPairs;
  
      btnAddGlobalValue?.addEventListener('click', () => {
        const globalFieldId = selGlobal.value;
        if (!globalFieldId) { alert('Bitte zuerst ein Global Field wählen.'); return; }
        const newVal = prompt('Neuen globalen Allowed Value eingeben:');
        if (!newVal) return;
  
        const gf = findFieldById?.(globalFieldId);
        if (!gf) return;
        if (!Array.isArray(gf.allowedValues)) gf.allowedValues = [];
        if (!gf.allowedValues.includes(newVal)) {
          gf.allowedValues.push(newVal);
          saveFields?.();
          document.dispatchEvent(new CustomEvent('gdf:fields-updated'));
        }
        renderPairs();
      });
  
      // ---- Modal schließen
      function closeEditor() {
        modal.classList.remove('is-open');
        modal.style.display = '';
        modal.setAttribute('hidden', '');
        document.body.classList.remove('modal-open');
        currentEditing = null;
      }
      btnClose.onclick  = closeEditor;
      btnCancel.onclick = closeEditor;
  
      // ---- Speichern
      btnSave.onclick = () => {
        try {
          const legalEntityId = (selLE.value  || '').trim();
          const systemId      = (selSYS.value || '').trim();
          const localFieldId  = (selLocal.value  || '').trim();
          const globalFieldId = (selGlobal.value || '').trim();
  
          if (!legalEntityId || !systemId || !localFieldId) {
            alert('Bitte Legal Entity, System und Local Field auswählen.');
            return;
          }
          if (!globalFieldId) {
            alert('Bitte ein Global Field auswählen.');
            return;
          }
  
          const id  = currentEditing?.id || `map_${legalEntityId}_${systemId}_${localFieldId}`;
          const pos = state.mappings.findIndex(mm => mm.id === id);
  
          const mapping = {
            id,
            legalEntityId,
            systemId,
            dataObjectId: findFieldById?.(localFieldId)?.foundationObjectId || '',
            localFieldId,
            globalFieldId,
            status: currentEditing?.status || 'DRAFT',
            mode: 'LOOKUP',
            defaultValue: '',
            owner: currentEditing?.owner || '',
            effectiveFrom: currentEditing?.effectiveFrom || '',
            updatedAt: new Date().toISOString()
          };
          if (pos >= 0) state.mappings[pos] = mapping; else state.mappings.push(mapping);
          saveMappings?.(state.mappings);
  
          // ValueMap speichern
          const gVals = getAllowedValues?.(globalFieldId) || [];
          const lVals = getAllowedValues?.(localFieldId)  || [];
          const pairsMap = (currentEditing && currentEditing._pairs instanceof Map)
            ? currentEditing._pairs : new Map();
  
          const pairs = lVals.map(from => {
            const to = pairsMap.get(from) || '';
            return (!to || gVals.includes(to)) ? { from, to } : { from, to: '' };
          });
  
          let vm = findValueMapByMappingId?.(id);
          if (!vm) {
            vm = { id: `vmap_${Date.now()}`, fieldMappingId: id, pairs: [] };
            state.valueMaps.push(vm);
          }
          vm.pairs = pairs;
          saveValueMaps?.(state.valueMaps);
  
          closeEditor();
          window.__renderMappingsList?.();
        } catch (e) {
          console.error('Mapping speichern fehlgeschlagen:', e);
          alert('Speichern fehlgeschlagen: ' + (e?.message || e));
        }
      };
  
      // ---- Initial füllen
      rebuildFieldOptions();
      selLE.focus();
    } catch (err) {
      console.error('[Mappings] openEditor crash:', err);
      alert('Fehler im Editor: ' + (err?.message || err));
    }
  } // Ende openEditor

// 6) Filter-Events
[fLE, fSYS, fDO].forEach(sel => sel && sel.addEventListener('change', renderList));

// 7) „+ New Mapping“ – immer öffnen
if (addBtn) {
  addBtn.onclick = () => {
    try {
      openEditor(null);
    } catch (err) {
      console.error('[Mappings] openEditor failed:', err);
      alert('Editor konnte nicht geöffnet werden: ' + (err?.message || err));
    }
  };
}

// 8) Für externe Refreshes (z. B. nach Speichern)
window.__renderMappingsList = renderList;

// 9) Initialisieren
fillFilters();
renderList();
} // <-- Ende von setupMappingsFeature()

// exportieren, ohne sofort auszuführen
window.setupMappingsFeature = setupMappingsFeature;

// ===== Dashboard Rendering Functions =====
function renderDashboard() {
  console.log('[Dashboard] Rendering dashboard...');
  
  // Update active nav state
  const dashboardNavItem = document.getElementById('dashboardNavItem');
  if (dashboardNavItem) {
    dashboardNavItem.classList.add('is-active');
  }
  
  // Initialize filters
  initializeDashboardFilters();
  
  // Calculate and display metrics
  updateDashboardMetrics();
  
  // Render charts
  renderDashboardCharts();
  
  // Setup event handlers
  setupDashboardHandlers();
}

function initializeDashboardFilters() {
  const systemSelect = document.getElementById('dashFilterSystem');
  const domainSelect = document.getElementById('dashFilterDomain');
  const dataObjectSelect = document.getElementById('dashFilterDataObject');
  
  if (!systemSelect || !domainSelect || !dataObjectSelect) return;
  
  // Populate systems
  systemSelect.innerHTML = '<option value="">All Systems</option>';
  systems.forEach(sys => {
    const opt = document.createElement('option');
    opt.value = sys.name;
    opt.textContent = sys.name;
    systemSelect.appendChild(opt);
  });
  
  // Populate domains
  domainSelect.innerHTML = '<option value="">All Domains</option>';
  dataDomains.forEach(domain => {
    const opt = document.createElement('option');
    opt.value = domain.name;
    opt.textContent = domain.name;
    domainSelect.appendChild(opt);
  });
  
  // Populate data objects
  dataObjectSelect.innerHTML = '<option value="">All Data Objects</option>';
  dataObjects.forEach(obj => {
    const opt = document.createElement('option');
    opt.value = obj.id;
    opt.textContent = obj.name;
    dataObjectSelect.appendChild(opt);
  });
}

function getFilteredData() {
  const systemFilter = document.getElementById('dashFilterSystem')?.value || '';
  const domainFilter = document.getElementById('dashFilterDomain')?.value || '';
  const dataObjectFilter = document.getElementById('dashFilterDataObject')?.value || '';
  
  let filteredSystems = systems;
  let filteredFields = fields;
  
  if (systemFilter) {
    filteredSystems = filteredSystems.filter(s => s.name === systemFilter);
    filteredFields = filteredFields.filter(f => f.system === systemFilter);
  }
  
  if (domainFilter) {
    filteredSystems = filteredSystems.filter(s => s.dataDomain === domainFilter);
    const systemNames = filteredSystems.map(s => s.name);
    filteredFields = filteredFields.filter(f => systemNames.includes(f.system));
  }
  
  if (dataObjectFilter) {
    filteredFields = filteredFields.filter(f => String(f.foundationObjectId) === String(dataObjectFilter));
  }
  
  return { filteredSystems, filteredFields };
}

function updateDashboardMetrics() {
  const { filteredSystems, filteredFields } = getFilteredData();
  
  // Systems metrics - Note: Systems with scope 'both' are counted in both categories
  const globalSystems = filteredSystems.filter(s => s.scope === 'global' || s.scope === 'both').length;
  const localSystems = filteredSystems.filter(s => s.scope === 'local' || s.scope === 'both').length;
  const totalSystems = filteredSystems.length;
  
  updateMetricValue('metricGlobalSystems', globalSystems);
  updateMetricValue('metricLocalSystems', localSystems);
  updateMetricValue('metricTotalSystems', totalSystems);
  
  // Fields metrics
  const globalFields = filteredFields.filter(f => !f.local).length;
  const localFields = filteredFields.filter(f => f.local).length;
  const totalFields = filteredFields.length;
  
  updateMetricValue('metricGlobalFields', globalFields);
  updateMetricValue('metricLocalFields', localFields);
  updateMetricValue('metricTotalFields', totalFields);
  
  // Definitions metrics
  const fieldsWithDef = filteredFields.filter(f => f.glossaryRef).length;
  const fieldsWithoutDef = totalFields - fieldsWithDef;
  const defCoverage = totalFields > 0 ? Math.round((fieldsWithDef / totalFields) * 100) : 0;
  
  updateMetricValue('metricWithDef', fieldsWithDef);
  updateMetricValue('metricWithoutDef', fieldsWithoutDef);
  updateMetricValue('metricDefCoverage', defCoverage + '%');
  
  // Glossary metrics - Count fields that reference glossary terms
  const totalGlossaryTerms = glossaryTerms.length;
  const linkedFields = filteredFields.filter(f => f.glossaryRef && f.glossaryRef !== '').length;
  
  updateMetricValue('metricGlossaryTerms', totalGlossaryTerms);
  updateMetricValue('metricLinkedFields', linkedFields);
}

function updateMetricValue(elementId, value) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const oldValue = el.textContent;
  el.textContent = value;
  
  // Add pulse animation if value changed
  if (oldValue !== String(value)) {
    el.classList.remove('updated');
    void el.offsetWidth; // Force reflow
    el.classList.add('updated');
    setTimeout(() => el.classList.remove('updated'), 400);
  }
}

function renderDashboardCharts() {
  renderDataObjectsChart();
  renderDefinitionsChart();
  renderDomainsChart();
}

function renderDataObjectsChart() {
  const canvas = document.getElementById('chartDataObjects');
  if (!canvas) return;
  
  const { filteredFields } = getFilteredData();
  const ctx = canvas.getContext('2d');
  
  // Count fields per data object
  const dataObjectCounts = {};
  filteredFields.forEach(f => {
    const objId = f.foundationObjectId;
    if (objId) {
      const obj = dataObjects.find(o => String(o.id) === String(objId));
      const name = obj ? obj.name : `Object ${objId}`;
      dataObjectCounts[name] = (dataObjectCounts[name] || 0) + 1;
    }
  });
  
  render3DPieChart(ctx, dataObjectCounts);
}

function renderDefinitionsChart() {
  const canvas = document.getElementById('chartDefinitions');
  if (!canvas) return;
  
  const { filteredFields } = getFilteredData();
  const ctx = canvas.getContext('2d');
  
  const withDef = filteredFields.filter(f => f.glossaryRef).length;
  const withoutDef = filteredFields.length - withDef;
  
  const data = {
    'With Definition': withDef,
    'Without Definition': withoutDef
  };
  
  render3DPieChart(ctx, data);
}

function renderDomainsChart() {
  const canvas = document.getElementById('chartDomains');
  if (!canvas) return;
  
  const { filteredSystems } = getFilteredData();
  const ctx = canvas.getContext('2d');
  
  // Count systems per domain
  const domainCounts = {};
  filteredSystems.forEach(s => {
    const domain = s.dataDomain || 'Unassigned';
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  });
  
  render3DPieChart(ctx, domainCounts);
}

function renderSimpleBarChart(ctx, data, title) {
  // Chart constants - adjusted for more Apple-like appearance
  const CHART_HEIGHT = 340;
  const CHART_PADDING = 50;
  const CHART_PADDING_BOTTOM = 80; // More space for straight labels
  const BAR_WIDTH_RATIO = 0.65;
  const GAP_WIDTH_RATIO = 0.35;
  const MAX_LABEL_LENGTH = 15;
  const TRUNCATED_LABEL_LENGTH = 12;
  
  const canvas = ctx.canvas;
  const width = canvas.width = canvas.offsetWidth * 2;
  const height = canvas.height = CHART_HEIGHT;
  
  const labels = Object.keys(data);
  const values = Object.values(data);
  const maxValue = Math.max(...values, 1);
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Apple-inspired blue gradient colors with better progression
  const colors = [
    '#007AFF', '#0A84FF', '#5AC8FA', '#30B0C7', '#0071E3',
    '#4A90E2', '#64B5F6', '#42A5F5', '#1E88E5', '#1976D2'
  ];
  
  // Chart dimensions
  const chartWidth = width - CHART_PADDING * 2;
  const chartHeight = height - CHART_PADDING - CHART_PADDING_BOTTOM;
  const barWidth = chartWidth / labels.length * BAR_WIDTH_RATIO;
  const gap = chartWidth / labels.length * GAP_WIDTH_RATIO;
  
  ctx.font = '24px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  
  labels.forEach((label, i) => {
    const value = values[i];
    const barHeight = (value / maxValue) * chartHeight;
    const x = CHART_PADDING + i * (barWidth + gap) + gap / 2;
    const y = height - CHART_PADDING_BOTTOM - barHeight;
    
    // Draw bar with smoother gradient
    const gradient = ctx.createLinearGradient(0, y, 0, height - CHART_PADDING_BOTTOM);
    const baseColor = colors[i % colors.length];
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(0.5, baseColor);
    // Convert hex to rgba for smoother fade
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.6)`);
    
    ctx.fillStyle = gradient;
    // Add rounded corners to bars
    roundRect(ctx, x, y, barWidth, barHeight, 6);
    ctx.fill();
    
    // Draw value on top of bar
    ctx.fillStyle = '#1D1D1F';
    ctx.font = '600 26px -apple-system, system-ui, sans-serif';
    ctx.fillText(value, x + barWidth / 2, y - 12);
    
    // Draw label straight (no rotation) - Apple style
    ctx.fillStyle = '#86868B';
    ctx.font = '500 20px -apple-system, system-ui, sans-serif';
    const displayLabel = label.length > MAX_LABEL_LENGTH 
      ? label.substring(0, TRUNCATED_LABEL_LENGTH) + '...' 
      : label;
    ctx.fillText(displayLabel, x + barWidth / 2, height - CHART_PADDING_BOTTOM + 30);
  });
}

// Helper function to draw rounded rectangles
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function render3DPieChart(ctx, data) {
  const CHART_HEIGHT = 340;
  
  const canvas = ctx.canvas;
  const width = canvas.width = canvas.offsetWidth * 2;
  const height = canvas.height = CHART_HEIGHT;
  
  const labels = Object.keys(data);
  const values = Object.values(data);
  const total = values.reduce((sum, v) => sum + v, 0);
  
  if (total === 0) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#86868B';
    ctx.font = '300 18px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', width / 2, height / 2);
    return;
  }
  
  ctx.clearRect(0, 0, width, height);
  
  const centerX = width / 2;
  const centerY = height / 2 - 30; // Adjusted for 2D
  const radius = Math.min(width, height) * 0.30; // Slightly larger for 2D
  
  // Modern blue tones palette
  const baseColors = [
    '#1E88E5', // Vibrant Blue
    '#42A5F5', // Sky Blue
    '#64B5F6', // Light Blue
    '#2196F3', // Material Blue
    '#1976D2', // Deep Blue
    '#1565C0', // Dark Blue
    '#0D47A1', // Navy Blue
    '#0277BD', // Cyan Blue
    '#0288D1', // Light Cyan Blue
    '#03A9F4', // Bright Cyan Blue
  ];
  
  let startAngle = -Math.PI / 2;
  
  // Draw flat 2D pie chart
  labels.forEach((label, i) => {
    const value = values[i];
    const sliceAngle = (value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    
    // Draw slice with flat color
    ctx.fillStyle = baseColors[i % baseColors.length];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
    
    // Add white stroke for separation
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    startAngle = endAngle;
  });
  
  // Draw values inside slices to avoid overlaps
  startAngle = -Math.PI / 2;
  labels.forEach((label, i) => {
    const value = values[i];
    const sliceAngle = (value / total) * 2 * Math.PI;
    const midAngle = startAngle + sliceAngle / 2;
    const percentage = Math.round((value / total) * 100);
    
    // Only show label if slice is large enough (>5%)
    if (percentage >= 5) {
      // Position label inside the slice
      const labelDistance = radius * 0.65;
      const textX = centerX + Math.cos(midAngle) * labelDistance;
      const textY = centerY + Math.sin(midAngle) * labelDistance;
      
      // Draw white text inside slices
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${value}`, textX, textY - 8);
      ctx.font = '500 14px -apple-system, system-ui, sans-serif';
      ctx.fillText(`${percentage}%`, textX, textY + 10);
    }
    
    startAngle += sliceAngle;
  });
  
  // Draw elegant legend at bottom
  const legendY = height - 50;
  const legendItemHeight = 25;
  const legendItemsPerRow = Math.min(labels.length, 3);
  const rows = Math.ceil(labels.length / legendItemsPerRow);
  
  labels.forEach((label, i) => {
    const row = Math.floor(i / legendItemsPerRow);
    const col = i % legendItemsPerRow;
    
    ctx.font = '300 15px -apple-system, system-ui, sans-serif';
    const itemWidth = 180;
    const totalRowWidth = legendItemsPerRow * itemWidth;
    const legendX = (width - totalRowWidth) / 2 + col * itemWidth;
    const legendYPos = legendY + row * legendItemHeight;
    
    // Color indicator (small circle)
    ctx.fillStyle = baseColors[i % baseColors.length];
    ctx.beginPath();
    ctx.arc(legendX + 6, legendYPos, 5, 0, 2 * Math.PI);
    ctx.fill();
    
    // Label text with value
    ctx.fillStyle = '#86868B';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const percentage = Math.round((values[i] / total) * 100);
    const text = `${label} (${values[i]})`;
    ctx.fillText(text, legendX + 18, legendYPos);
  });
}

function setupDashboardHandlers() {
  // Filter change handlers
  const systemFilter = document.getElementById('dashFilterSystem');
  const domainFilter = document.getElementById('dashFilterDomain');
  const dataObjectFilter = document.getElementById('dashFilterDataObject');
  const resetFilters = document.getElementById('dashResetFilters');
  const refreshBtn = document.getElementById('dashboardRefresh');
  
  const updateDashboard = () => {
    updateDashboardMetrics();
    renderDashboardCharts();
  };
  
  systemFilter?.addEventListener('change', updateDashboard);
  domainFilter?.addEventListener('change', updateDashboard);
  dataObjectFilter?.addEventListener('change', updateDashboard);
  
  resetFilters?.addEventListener('click', () => {
    if (systemFilter) systemFilter.value = '';
    if (domainFilter) domainFilter.value = '';
    if (dataObjectFilter) dataObjectFilter.value = '';
    updateDashboard();
  });
  
  refreshBtn?.addEventListener('click', updateDashboard);
  
  // Individual metric value click handlers (show filtered details)
  document.querySelectorAll('.metric-value.metric-clickable').forEach(value => {
    value.addEventListener('click', (e) => {
      e.stopPropagation();
      const filter = value.dataset.filter;
      const rect = value.getBoundingClientRect();
      showDetailsOverlay(filter, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    });
  });
  
  // Metric card click handlers (show general details) - removed to avoid conflicts
  // Chart details buttons
  document.querySelectorAll('.chart-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const chart = btn.dataset.chart;
      showDetailsOverlay(chart);
    });
  });
  
  // Setup overlay close handlers
  const overlay = document.getElementById('detailsOverlay');
  const closeBtn = document.getElementById('detailsOverlayClose');
  
  closeBtn?.addEventListener('click', () => {
    hideDetailsOverlay();
  });
  
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('details-overlay-backdrop')) {
      hideDetailsOverlay();
    }
  });
  
  // ESC key to close overlay
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.getAttribute('aria-hidden') === 'false') {
      hideDetailsOverlay();
    }
  });
  
  // Old close details button (keeping for backward compatibility)
  document.getElementById('closeDetails')?.addEventListener('click', () => {
    document.getElementById('dashboardDetails').style.display = 'none';
  });
}

function showDetailsOverlay(type, position = null) {
  const overlay = document.getElementById('detailsOverlay');
  const title = document.getElementById('detailsOverlayTitle');
  const body = document.getElementById('detailsOverlayBody');
  const card = overlay?.querySelector('.details-overlay-card');
  
  if (!overlay || !title || !body) return;
  
  const { filteredFields, filteredSystems } = getFilteredData();
  
  let titleText = 'Details';
  let content = '';
  let dataToShow = [];
  
  switch (type) {
    // New specific metric filters
    case 'global-systems':
      titleText = 'Global Systems';
      dataToShow = filteredSystems.filter(s => s.scope === 'global' || s.scope === 'both');
      content = renderSystemsDetails(dataToShow);
      break;
      
    case 'local-systems':
      titleText = 'Local Systems';
      dataToShow = filteredSystems.filter(s => s.scope === 'local' || s.scope === 'both');
      content = renderSystemsDetails(dataToShow);
      break;
      
    case 'all-systems':
      titleText = 'All Systems';
      content = renderSystemsDetails(filteredSystems);
      break;
      
    case 'global-fields':
      titleText = 'Global Fields';
      dataToShow = filteredFields.filter(f => !f.local);
      content = renderFieldsDetails(dataToShow);
      break;
      
    case 'local-fields':
      titleText = 'Local Fields';
      dataToShow = filteredFields.filter(f => f.local);
      content = renderFieldsDetails(dataToShow);
      break;
      
    case 'all-fields':
      titleText = 'All Fields';
      content = renderFieldsDetails(filteredFields);
      break;
      
    case 'with-definition':
      titleText = 'Fields With Definition';
      dataToShow = filteredFields.filter(f => f.glossaryRef);
      content = renderFieldsDetails(dataToShow);
      break;
      
    case 'without-definition':
      titleText = 'Fields Without Definition';
      dataToShow = filteredFields.filter(f => !f.glossaryRef);
      content = renderFieldsDetails(dataToShow);
      break;
      
    case 'all-glossary':
      titleText = 'All Glossary Terms';
      content = renderGlossaryDetails();
      break;
      
    case 'linked-fields':
      titleText = 'Fields with Glossary Links';
      dataToShow = filteredFields.filter(f => f.glossaryRef && f.glossaryRef !== '');
      content = renderFieldsDetails(dataToShow);
      break;
    
    // Original general categories
    case 'systems':
      titleText = 'Systems';
      content = renderSystemsDetails(filteredSystems);
      break;
      
    case 'fields':
      titleText = 'Data Fields';
      content = renderFieldsDetails(filteredFields);
      break;
      
    case 'definitions':
      titleText = 'Field Definitions';
      content = renderDefinitionsDetails(filteredFields);
      break;
      
    case 'dataObjects':
      titleText = 'Data Objects';
      content = renderDataObjectsDetails(filteredFields);
      break;
      
    case 'glossary':
      titleText = 'Glossary Terms';
      content = renderGlossaryDetails();
      break;
      
    case 'domains':
      titleText = 'Systems by Domain';
      content = renderDomainsDetails(filteredSystems);
      break;
      
    default:
      content = '<div class="details-empty">No details available</div>';
  }
  
  title.textContent = titleText;
  body.innerHTML = content;
  
  // Position overlay near click if position provided
  if (position && card) {
    // Remove centering and position near click
    card.style.position = 'fixed';
    card.style.left = `${Math.min(position.x, window.innerWidth - 320)}px`;
    card.style.top = `${Math.min(position.y, window.innerHeight - 400)}px`;
    card.style.transform = 'translate(-50%, -50%)';
    card.style.maxWidth = '500px';
  } else if (card) {
    // Reset to default centering
    card.style.position = 'relative';
    card.style.left = '';
    card.style.top = '';
    card.style.transform = '';
    card.style.maxWidth = '';
  }
  
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function hideDetailsOverlay() {
  const overlay = document.getElementById('detailsOverlay');
  if (!overlay) return;
  
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function renderSystemsDetails(systems) {
  if (systems.length === 0) {
    return '<div class="details-empty">No systems to display</div>';
  }
  
  return `
    <div style="overflow-x: auto;">
      <table class="table" style="margin: 0;">
        <thead>
          <tr>
            <th>Name</th>
            <th>Owner</th>
            <th>Scope</th>
            <th>Domain</th>
          </tr>
        </thead>
        <tbody>
          ${systems.map(sys => `
            <tr>
              <td><strong>${escapeHtml(sys.name)}</strong></td>
              <td>${escapeHtml(sys.owner || '—')}</td>
              <td>${escapeHtml(sys.scope || '—')}</td>
              <td>${escapeHtml(sys.dataDomain || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderFieldsDetails(fields) {
  if (fields.length === 0) {
    return '<div class="details-empty">No fields to display</div>';
  }
  
  return `
    <div style="overflow-x: auto;">
      <table class="table" style="margin: 0;">
        <thead>
          <tr>
            <th>Field Name</th>
            <th>System</th>
            <th>Type</th>
            <th>Data Object</th>
          </tr>
        </thead>
        <tbody>
          ${fields.map(f => {
            const dataObj = f.foundationObjectId ? dataObjects.find(o => String(o.id) === String(f.foundationObjectId)) : null;
            return `
              <tr>
                <td><strong>${escapeHtml(f.name)}</strong></td>
                <td>${escapeHtml(f.system)}</td>
                <td>${f.local ? 'Local' : 'Global'}</td>
                <td>${dataObj ? escapeHtml(dataObj.name) : '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDefinitionsDetails(fields) {
  if (fields.length === 0) {
    return '<div class="details-empty">No fields to display</div>';
  }
  
  return `
    <div style="overflow-x: auto;">
      <table class="table" style="margin: 0;">
        <thead>
          <tr>
            <th>Field Name</th>
            <th>System</th>
            <th>Has Definition</th>
            <th>Term</th>
          </tr>
        </thead>
        <tbody>
          ${fields.map(f => {
            const glossaryTerm = f.glossaryRef ? glossaryTerms.find(t => t.id === f.glossaryRef) : null;
            return `
              <tr>
                <td><strong>${escapeHtml(f.name)}</strong></td>
                <td>${escapeHtml(f.system)}</td>
                <td>${f.glossaryRef ? 'Yes' : 'No'}</td>
                <td>${glossaryTerm ? escapeHtml(glossaryTerm.term) : '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDataObjectsDetails(fields) {
  if (fields.length === 0) {
    return '<div class="details-empty">No fields to display</div>';
  }
  
  return `
    <div style="overflow-x: auto;">
      <table class="table" style="margin: 0;">
        <thead>
          <tr>
            <th>Field Name</th>
            <th>Data Object</th>
            <th>System</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          ${fields.map(f => {
            const obj = dataObjects.find(o => String(o.id) === String(f.foundationObjectId));
            return `
              <tr>
                <td><strong>${escapeHtml(f.name)}</strong></td>
                <td>${escapeHtml(obj?.name || '—')}</td>
                <td>${escapeHtml(f.system)}</td>
                <td>${f.local ? 'Local' : 'Global'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderGlossaryDetails() {
  if (glossaryTerms.length === 0) {
    return '<div class="details-empty">No glossary terms to display</div>';
  }
  
  return `
    <div style="overflow-x: auto;">
      <table class="table" style="margin: 0;">
        <thead>
          <tr>
            <th>Term</th>
            <th>Type</th>
            <th>Definition</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          ${glossaryTerms.map(t => `
            <tr>
              <td><strong>${escapeHtml(t.term)}</strong></td>
              <td>${escapeHtml(t.type || '—')}</td>
              <td>${escapeHtml(t.definition || '—')}</td>
              <td>${escapeHtml(t.owner || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDomainsDetails(systems) {
  if (systems.length === 0) {
    return '<div class="details-empty">No systems to display</div>';
  }
  
  return `
    <div style="overflow-x: auto;">
      <table class="table" style="margin: 0;">
        <thead>
          <tr>
            <th>System Name</th>
            <th>Domain</th>
            <th>Owner</th>
            <th>Scope</th>
          </tr>
        </thead>
        <tbody>
          ${systems.map(sys => `
            <tr>
              <td><strong>${escapeHtml(sys.name)}</strong></td>
              <td>${escapeHtml(sys.dataDomain || 'Unassigned')}</td>
              <td>${escapeHtml(sys.owner || '—')}</td>
              <td>${escapeHtml(sys.scope || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Helper function to escape HTML (if not already defined)
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function showDashboardDetails(type) {
  const detailsSection = document.getElementById('dashboardDetails');
  const detailsTitle = document.getElementById('detailsTitle');
  const tableHead = document.getElementById('detailsTableHead');
  const tableBody = document.getElementById('detailsTableBody');
  
  if (!detailsSection || !detailsTitle || !tableHead || !tableBody) return;
  
  const { filteredFields, filteredSystems } = getFilteredData();
  
  let title = 'Details';
  let headers = [];
  let rows = [];
  
  switch (type) {
    case 'systems':
      title = 'Systems Details';
      headers = ['System', 'Owner', 'Scope', 'Domain'];
      rows = filteredSystems.map(s => [s.name, s.owner || '-', s.scope, s.dataDomain || '-']);
      break;
      
    case 'fields':
      title = 'Fields Details';
      headers = ['Field Name', 'System', 'Type', 'Mandatory'];
      rows = filteredFields.map(f => [f.name, f.system, f.local ? 'Local' : 'Global', f.mandatory ? 'Yes' : 'No']);
      break;
      
    case 'definitions':
      title = 'Fields by Definition Status';
      headers = ['Field Name', 'System', 'Has Definition', 'Glossary Term'];
      rows = filteredFields.map(f => {
        const term = f.glossaryRef ? glossaryTerms.find(t => t.id === f.glossaryRef) : null;
        return [f.name, f.system, f.glossaryRef ? 'Yes' : 'No', term?.term || '-'];
      });
      break;
      
    case 'dataObjects':
      title = 'Fields by Data Object';
      headers = ['Data Object', 'Field Name', 'System', 'Type'];
      rows = filteredFields.map(f => {
        const obj = dataObjects.find(o => String(o.id) === String(f.foundationObjectId));
        return [obj?.name || '-', f.name, f.system, f.local ? 'Local' : 'Global'];
      });
      break;
      
    case 'glossary':
      title = 'Glossary Terms';
      headers = ['Term', 'Type', 'Definition', 'Owner'];
      rows = glossaryTerms.map(t => [t.term, t.type, t.definition || '-', t.owner || '-']);
      break;
      
    case 'domains':
      title = 'Systems by Domain';
      headers = ['Domain', 'System', 'Owner', 'Scope'];
      rows = filteredSystems.map(s => [s.dataDomain || 'Unassigned', s.name, s.owner || '-', s.scope]);
      break;
  }
  
  // Render table
  detailsTitle.textContent = title;
  
  tableHead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
  tableBody.innerHTML = rows.map(row => 
    '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>'
  ).join('');
  
  detailsSection.style.display = 'block';
  detailsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Export dashboard function
window.renderDashboard = renderDashboard;

// ===== Allowed Values Spalte – robust (erstellt fehlendes THEAD/TR, wartet auf Zeilen) =====
(function addAllowedValuesColumnRobust() {
  const AV_HEADER_TEXT = 'Allowed Values';

  function escapeHtml(s){
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // System-ID/Name -> Anzeigename (für Vergleich mit Tabellenzelle)
  function resolveSystemDisplay(sys) {
    if (!sys) return '';
    const systems = Array.isArray(window.state?.systems) ? window.state.systems : [];
    let m = systems.find(x => x.id === sys);
    if (m) return m.name || sys;
    m = systems.find(x => x.name === sys);
    if (m) return m.name;
    m = systems.find(x => String(x.name).toLowerCase() === String(sys).toLowerCase());
    if (m) return m.name;
    return sys;
  }

  // Sorgt dafür, dass es ein <thead><tr> gibt
  function ensureHead(table){
    let thead = table.querySelector('thead');
    if (!thead){
      thead = document.createElement('thead');
      table.insertBefore(thead, table.firstChild || null);
    }
    let headRow = thead.querySelector('tr');
    if (!headRow){
      headRow = document.createElement('tr');
      thead.appendChild(headRow);
    }
    return { thead, headRow };
  }

  function indexOfHeader(headRow, label){
    const t = String(label||'').trim().toLowerCase();
    const cells = [...(headRow?.children||[])];
    return cells.findIndex(th => (th.textContent||'').trim().toLowerCase() === t);
  }

  // Fügt den AV-Header vor "Legal Entity" ein (sonst hinter Definition, sonst vor Actions, sonst ans Ende)
  function ensureAvHeader(table){
    const { headRow } = ensureHead(table);

    const idxLE  = indexOfHeader(headRow, 'Legal Entity');
    const idxDef = indexOfHeader(headRow, 'Definition');
    const idxAct = Math.max(indexOfHeader(headRow,'Actions'), indexOfHeader(headRow,'Aktionen'));

    let insertIdx = -1;
    if (idxLE >= 0) insertIdx = idxLE;
    else if (idxDef >= 0) insertIdx = idxDef + 1;
    else if (idxAct >= 0) insertIdx = idxAct;
    else insertIdx = headRow.children.length;

    let avIdx = indexOfHeader(headRow, AV_HEADER_TEXT);
    let changed = false;
    if (avIdx < 0){
      const th = document.createElement('th');
      th.textContent = AV_HEADER_TEXT;
      headRow.insertBefore(th, headRow.children[insertIdx] || null);
      avIdx = insertIdx;
      changed = true;
    } else if (avIdx !== insertIdx){
      headRow.insertBefore(headRow.children[avIdx], headRow.children[insertIdx] || null);
      avIdx = insertIdx;
      changed = true;
    }
    return { avIndex: avIdx, colCount: headRow.children.length, changed };
  }

  function valuesToHtml(list){
    if (!Array.isArray(list) || list.length === 0) return '—';
    return list.map(v=>`<div class="av-item">${escapeHtml(v)}</div>`).join('');
  }

  function ensureAvCell(tr, avIndex){
    // doppelte av-col entfernen
    const allAv = tr.querySelectorAll('td.av-col');
    for (let i=1;i<allAv.length;i++) allAv[i].remove();

    // an Zielposition schon vorhanden?
    if (tr.children[avIndex]?.classList?.contains('av-col')) return tr.children[avIndex];

    // existiert irgendwo eine av-col? -> verschieben
    const stray = tr.querySelector('td.av-col');
    if (stray){
      tr.insertBefore(stray, tr.children[avIndex] || null);
      return stray;
    }

    // neue Zelle exakt an Zielposition
    const td = document.createElement('td');
    td.className = 'av-col';
    tr.insertBefore(td, tr.children[avIndex] || null);
    return td;
  }

  // ---- GLOBAL ----
  function fillGlobal(table){
    const tbody = table.querySelector('tbody');
    if(!tbody) return false;
    const rows = tbody.querySelectorAll('tr');
    if (!rows.length) return false;

    const info = ensureAvHeader(table);
    if (info.avIndex < 0) return info.changed;

    const fields = (window.state?.fields || []).filter(f => f && f.local !== true);
    const map = new Map(
      fields.map(f => {
        const sysDisp = resolveSystemDisplay(f.system);
        const key = `${f.name}@@${sysDisp}`;
        return [key, Array.isArray(f.allowedValues)?f.allowedValues:[]];
      })
    );

    let mutated = info.changed;
    rows.forEach(tr=>{
      const tds = tr.children;
      if (tds.length < 2) return;
      const name   = (tds[0]?.textContent||'').trim().replace(/\s+/g,' ');
      const sysTxt = (tds[1]?.textContent||'').trim().replace(/\s+/g,' ');
      const key = `${name}@@${sysTxt}`;
      const av = map.get(key) || [];
      const td = ensureAvCell(tr, info.avIndex);
      const html = valuesToHtml(av);
      if (td.innerHTML !== html){ td.innerHTML = html; mutated = true; }
    });
    return mutated;
  }

  // ---- LOCAL ----
  function fillLocal(container){
    const tables = container.querySelectorAll('table');
    const locals = (window.state?.fields || []).filter(f => f && f.local === true);
    let mutated = false;

    const locMap = new Map(
      locals.map(f => {
        const sysDisp = resolveSystemDisplay(f.system);
        const le = String(f.legalEntityNumber || '');
        const key = `${f.name}@@${sysDisp}@@${le}`;
        return [key, Array.isArray(f.allowedValues)?f.allowedValues:[]];
      })
    );

    tables.forEach(table=>{
      const tbody = table.querySelector('tbody');
      if(!tbody) return;
      const rows = tbody.querySelectorAll('tr');
      if (!rows.length) return;

      const info = ensureAvHeader(table);
      if (info.avIndex < 0){ mutated = mutated || info.changed; return; }

      rows.forEach(tr=>{
        const tds = tr.children;
        if (tds.length < 2) return;

        const name   = (tds[0]?.textContent||'').trim().replace(/\s+/g,' ');
        const sysTxt = (tds[1]?.textContent||'').trim().replace(/\s+/g,' ');

        // LE steht in der vorletzten Spalte als "7010 — LEONI Shanghai"
        const leCell = tds[tds.length - 2];
        let leNum = '';
        if (leCell){
          const m = (leCell.textContent||'').trim().match(/^(\d{3,})/);
          leNum = m ? m[1] : '';
        }

        const key = `${name}@@${sysTxt}@@${leNum}`;
        const av = locMap.get(key) || [];
        const td = ensureAvCell(tr, info.avIndex);
        const html = valuesToHtml(av);
        if (td.innerHTML !== html){ td.innerHTML = html; mutated = true; }
      });
      mutated = mutated || info.changed;
    });
    return mutated;
  }

  // Rebind-Logik (ohne Konsole nutzbar)
  let applying = false;
  let scheduled = false;
  let observer;

  function apply(){
    if (applying) return;
    applying = true;
    if (observer) observer.disconnect();
    try{
      const gTable = document.getElementById('fieldsBody')?.closest('table');
      if (gTable) fillGlobal(gTable);

      const lWrap = document.getElementById('localTables');
      if (lWrap) fillLocal(lWrap);
    } finally {
      startObserver();
      applying = false;
    }
  }

  function scheduleApply(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; apply(); });
  }

  function startObserver(){
    const targets = [];
    const gTable = document.getElementById('fieldsBody')?.closest('table');
    if (gTable) targets.push(gTable);
    const lWrap = document.getElementById('localTables');
    if (lWrap) targets.push(lWrap);
    if (!targets.length) return;

    if (!observer) observer = new MutationObserver(() => scheduleApply());
    targets.forEach(t => observer.observe(t, { childList:true, subtree:true }));
  }

  // Event: nach saveFields() sofort refreshen
  document.addEventListener('gdf:fields-updated', scheduleApply);

  // Initial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { apply(); }, { once:true });
  } else {
    apply();
  }

  // kleines CSS
  if (!document.getElementById('av-col-style')){
    const st = document.createElement('style');
    st.id = 'av-col-style';
    st.textContent = `.av-col{vertical-align:top}.av-col .av-item{line-height:1.25;padding:2px 0}`;
    document.head.appendChild(st);
  }

  // Optional: unsichtbarer Refresh-Button (IPad-Workaround ohne Konsole)
  if (!document.getElementById('av-refresh-btn')) {
    const btn = document.createElement('button');
    btn.id = 'av-refresh-btn';
    btn.type = 'button';
    btn.textContent = 'Refresh Allowed Values';
    btn.style.cssText = 'position:fixed;bottom:-9999px;right:-9999px;opacity:0;pointer-events:none;';
    btn.addEventListener('click', scheduleApply);
    document.body.appendChild(btn);
  }

  // Externer manueller Trigger
  window.__refreshAllowedValuesColumn = scheduleApply;
})();
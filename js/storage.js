import { state } from './state.js';
import {
  STORAGE_KEY_COLUMNS,
  STORAGE_KEY_FIELDS,
  STORAGE_KEY_GLOSSARY,
  STORAGE_KEY_LE_SYS,
  STORAGE_KEY_MAP_FILTERS,
  STORAGE_KEY_MAP_POS,
  STORAGE_KEY_SYSTEMS,
} from './constants.js';

export const storage = (() => {
  try {
    const testKey = '__gdf_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (err) {
    const memoryStore = {};
    return {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
      },
      setItem(key, value) {
        memoryStore[key] = String(value);
      },
      removeItem(key) {
        delete memoryStore[key];
      },
    };
  }
})();

export function saveLeSystems() {
  try {
    storage.setItem(STORAGE_KEY_LE_SYS, JSON.stringify(state.leSystemMap));
  } catch (err) {
    console.error('saveLeSystems() failed', err);
  }
}

export function loadLeSystems() {
  try {
    const raw = storage.getItem(STORAGE_KEY_LE_SYS);
    if (raw) {
      const parsed = JSON.parse(raw) || {};
      Object.keys(state.leSystemMap).forEach((key) => delete state.leSystemMap[key]);
      Object.assign(state.leSystemMap, parsed);
    }
  } catch (err) {
    console.error('loadLeSystems() failed', err);
  }
}

export function saveSystems() {
  try {
    storage.setItem(STORAGE_KEY_SYSTEMS, JSON.stringify(state.systems));
  } catch (err) {
    console.error('saveSystems() failed', err);
  }
}

export function loadSystems() {
  try {
    const raw = storage.getItem(STORAGE_KEY_SYSTEMS);
    if (!raw) return;
    const fromStore = JSON.parse(raw) || [];
    if (Array.isArray(fromStore) && fromStore.length > 0) {
      state.systems.splice(0, state.systems.length, ...fromStore);
    }
  } catch (err) {
    console.error('loadSystems() failed', err);
  }
}

export function saveColumns() {
  try {
    storage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(state.fieldColumns));
  } catch (err) {
    console.error('saveColumns() failed', err);
  }
}

export function loadColumns() {
  try {
    const raw = storage.getItem(STORAGE_KEY_COLUMNS);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.fieldColumns.splice(0, state.fieldColumns.length, ...parsed);
    }
  } catch (err) {
    console.error('loadColumns() failed', err);
  }
}

export function saveFields() {
  try {
    storage.setItem(STORAGE_KEY_FIELDS, JSON.stringify(state.fields));
  } catch (err) {
    console.error('saveFields() failed:', err);
  }
}

export function loadFields() {
  try {
    let raw = storage.getItem(STORAGE_KEY_FIELDS);
    if (!raw) {
      const legacy = storage.getItem('gdf_fields_v1');
      if (legacy) {
        storage.setItem(STORAGE_KEY_FIELDS, legacy);
        storage.removeItem('gdf_fields_v1');
        raw = legacy;
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw) || [];
      state.fields.splice(0, state.fields.length, ...parsed);
    }
    state.fields.forEach((field) => {
      if (field.glossaryRef && !field.glossaryId) field.glossaryId = field.glossaryRef;
    });
  } catch (err) {
    console.error('loadFields() failed:', err);
  }
}

export function savePositions() {
  try {
    storage.setItem(STORAGE_KEY_MAP_POS, JSON.stringify(state.mapPositions));
  } catch (err) {
    console.error('savePositions() failed', err);
  }
}

export function loadPositions() {
  try {
    const raw = storage.getItem(STORAGE_KEY_MAP_POS);
    if (raw) {
      const parsed = JSON.parse(raw) || {};
      Object.keys(state.mapPositions).forEach((key) => delete state.mapPositions[key]);
      Object.assign(state.mapPositions, parsed);
    }
  } catch (err) {
    console.error('loadPositions() failed', err);
  }
}

export function saveFilters() {
  try {
    storage.setItem(STORAGE_KEY_MAP_FILTERS, JSON.stringify(state.mapFilters));
  } catch (err) {
    console.error('saveFilters() failed', err);
  }
}

export function loadFilters() {
  try {
    const raw = storage.getItem(STORAGE_KEY_MAP_FILTERS);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      state.mapFilters.systems = parsed.systems || [];
      state.mapFilters.domains = parsed.domains || [];
      state.mapFilters.scope = parsed.scope || { global: true, local: true };
      state.mapFilters.search = parsed.search || '';
    }
  } catch (err) {
    console.error('loadFilters() failed', err);
  }
  if (state.mapFilters.scope?.global === false && state.mapFilters.scope?.local === false) {
    state.mapFilters.scope = { global: true, local: true };
    saveFilters();
  }
}

export function saveGlossary() {
  try {
    storage.setItem(STORAGE_KEY_GLOSSARY, JSON.stringify(state.glossaryTerms));
  } catch (err) {
    console.error('saveGlossary() failed', err);
  }
}

export function loadGlossary() {
  try {
    const raw = storage.getItem(STORAGE_KEY_GLOSSARY);
    if (!raw) return;
    const fromStore = JSON.parse(raw) || [];
    state.glossaryTerms.forEach((term) => {
      if (!term.type) term.type = 'Term';
    });
    if (Array.isArray(fromStore) && fromStore.length > 0) {
      state.glossaryTerms.splice(0, state.glossaryTerms.length, ...fromStore);
    }
  } catch (err) {
    console.error('loadGlossary() failed:', err);
  }
}

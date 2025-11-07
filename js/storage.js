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

/** LocalStorage shim with safe fallback */
export const storage = (() => {
  try {
    const testKey = '__gdf_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
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

/* ---------------------------- Columns ---------------------------- */
export function saveColumns() {
  try {
    storage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(state.fieldColumns || []));
  } catch (err) {
    console.error('saveColumns() failed', err);
  }
}

export function loadColumns() {
  try {
    const raw = storage.getItem(STORAGE_KEY_COLUMNS);
    if (raw) {
      state.fieldColumns = JSON.parse(raw) || [];
    } else if (!Array.isArray(state.fieldColumns)) {
      state.fieldColumns = [];
    }
  } catch (err) {
    console.error('loadColumns() failed', err);
    state.fieldColumns = [];
  }
}

/* ---------------------------- Map Positions ---------------------------- */
export function savePositions() {
  try {
    storage.setItem(STORAGE_KEY_MAP_POS, JSON.stringify(state.mapPositions || {}));
  } catch (err) {
    console.error('savePositions() failed', err);
  }
}

export function loadPositions() {
  try {
    const raw = storage.getItem(STORAGE_KEY_MAP_POS);
    state.mapPositions = raw ? (JSON.parse(raw) || {}) : (state.mapPositions || {});
  } catch (err) {
    console.error('loadPositions() failed', err);
    state.mapPositions = state.mapPositions || {};
  }
}

/* ---------------------------- Map Filters ---------------------------- */
export function saveFilters() {
  try {
    storage.setItem(STORAGE_KEY_MAP_FILTERS, JSON.stringify(state.mapFilters || {}));
  } catch (err) {
    console.error('saveFilters() failed', err);
  }
}

export function loadFilters() {
  try {
    const raw = storage.getItem(STORAGE_KEY_MAP_FILTERS);
    state.mapFilters = raw ? (JSON.parse(raw) || {}) : (state.mapFilters || {});
  } catch (err) {
    console.error('loadFilters() failed', err);
    state.mapFilters = state.mapFilters || {};
  }
}

/* ---------------------------- LE ↔ System Map ---------------------------- */
export function saveLeSystems() {
  try {
    storage.setItem(STORAGE_KEY_LE_SYS, JSON.stringify(state.leSystemMap || {}));
  } catch (err) {
    console.error('saveLeSystems() failed', err);
  }
}

export function loadLeSystems() {
  try {
    const raw = storage.getItem(STORAGE_KEY_LE_SYS);
    if (raw) {
      const parsed = JSON.parse(raw) || {};
      state.leSystemMap = parsed;
    } else {
      state.leSystemMap = state.leSystemMap || {};
    }
  } catch (err) {
    console.error('loadLeSystems() failed', err);
    state.leSystemMap = state.leSystemMap || {};
  }
}

/* ---------------------------- Systems ---------------------------- */
export function saveSystems() {
  try {
    storage.setItem(STORAGE_KEY_SYSTEMS, JSON.stringify(state.systems || []));
  } catch (err) {
    console.error('saveSystems() failed', err);
  }
}

export function loadSystems() {
  try {
    const raw = storage.getItem(STORAGE_KEY_SYSTEMS);
    if (raw) {
      state.systems = JSON.parse(raw) || [];
    } else {
      state.systems = state.systems || [];
    }
  } catch (err) {
    console.error('loadSystems() failed', err);
    state.systems = state.systems || [];
  }
}

/* ---------------------------- Fields ---------------------------- */
/* ---------------------------- Fields (inkl. allowedValues) ---------------------------- */
export function saveFields() {
  try {
    // komplette Feldobjekte inkl. allowedValues sichern
    const payload = Array.isArray(state.fields) ? state.fields : [];
    storage.setItem(STORAGE_KEY_FIELDS, JSON.stringify(payload));
  } catch (err) {
    console.error('saveFields() failed', err);
  }
}

export function loadFields() {
  try {
    let raw = storage.getItem(STORAGE_KEY_FIELDS);
    // Migration: ältere Version
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
      // sicherstellen, dass allowedValues immer ein Array ist
      state.fields = Array.isArray(parsed)
        ? parsed.map(f => ({
            ...f,
            allowedValues: Array.isArray(f.allowedValues) ? f.allowedValues : [],
          }))
        : [];
    } else {
      state.fields = state.fields || [];
    }
  } catch (err) {
    console.error('loadFields() failed', err);
    state.fields = state.fields || [];
  }
}
/* ---------------------------- Glossary ---------------------------- */
export function saveGlossary() {
  try {
    storage.setItem(STORAGE_KEY_GLOSSARY, JSON.stringify(state.glossary || []));
  } catch (err) {
    console.error('saveGlossary() failed', err);
  }
}

export function loadGlossary() {
  try {
    const raw = storage.getItem(STORAGE_KEY_GLOSSARY);
    if (raw) {
      state.glossary = JSON.parse(raw) || [];
    } else {
      state.glossary = state.glossary || [];
    }
  } catch (err) {
    console.error('loadGlossary() failed', err);
    state.glossary = state.glossary || [];
  }
}

/* ---------------------------- Mappings & ValueMaps ---------------------------- */
const STORAGE_KEY_MAPPINGS = 'gdf_mappings_v1';
const STORAGE_KEY_VALUEMAPS = 'gdf_valueMaps_v1';

export function loadMappings() {
  try {
    const raw = storage.getItem(STORAGE_KEY_MAPPINGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMappings(list) {
  try {
    storage.setItem(STORAGE_KEY_MAPPINGS, JSON.stringify(list || []));
  } catch (err) {
    console.error('saveMappings() failed', err);
  }
}

export function loadValueMaps() {
  try {
    const raw = storage.getItem(STORAGE_KEY_VALUEMAPS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveValueMaps(list) {
  try {
    storage.setItem(STORAGE_KEY_VALUEMAPS, JSON.stringify(list || []));
  } catch (err) {
    console.error('saveValueMaps() failed', err);
  }
}
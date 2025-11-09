export const state = {
  editDataObjectIndex: null,
  dataDomains: [
    { name: 'HR', manager: 'Michael Hasenbrinck', active: true, color: '#2e6df6' },
    { name: 'Finance', manager: 'Ellen Lunz', active: true, color: '#6b5e4c' },
  ],
  systems: [
    { id: 'sys-ec', name: 'Employee Central', owner: 'HR', version: '1.0', scope: 'both', dataDomain: 'HR' },
    { id: 'sys-4p', name: '4Plan', owner: 'Finance', version: '1.0', scope: 'global', dataDomain: 'HR' },
    { id: 'sys-sem', name: 'SAP SEM', owner: 'HR', version: '1.0', scope: 'global', dataDomain: 'HR' },
    { id: 'sys-smr', name: 'Smart Recruiters', owner: 'HR', version: '1.0', scope: 'both', dataDomain: 'HR' },
    { id: 'sys-p01', name: 'P01', owner: 'Finance', version: '1.0', scope: 'global', dataDomain: 'Finance' },
  ],
  dataObjects: [
    { id: 114, name: 'Position Data', domain: 'HR' },
    { id: 130, name: 'Applicant Data', domain: 'HR' },
    { id: 135, name: 'Employee Data', domain: 'HR' },
    { id: 159, name: 'Job Data', domain: 'HR' },
  ],
  fields: [
    { id: 'f1', name: 'Global ID', system: 'Employee Central', type: 'String', length: 10, mandatory: true, local: false, mapping: '', foundationObjectId: '135' },
    { id: 'f2', name: 'Org-Code', system: 'Employee Central', type: 'String', length: 12, mandatory: false, local: false, mapping: '', foundationObjectId: '114' },
    { id: 'f3', name: 'Position ID', system: 'Employee Central', type: 'String', length: 8, mandatory: true, local: false, mapping: '', glossaryRef: undefined, foundationObjectId: '114' },
    { id: 'f4', name: 'Position ID', system: '4Plan', type: 'Number', length: 9, mandatory: true, local: false, mapping: '', foundationObjectId: '114', source: { system: 'Employee Central', field: 'PositionID' } },
    { id: 'f5', name: 'Global ID', system: '4Plan', type: 'String', length: 10, mandatory: true, local: false, mapping: '', foundationObjectId: '135', source: { system: 'Employee Central', field: 'EmployeeID' } },
    { id: 'f6', name: 'Location', system: 'Employee Central', type: 'String', length: 10, mandatory: true, local: false, mapping: '', foundationObjectId: '114' },
    { id: 'f7', name: 'Status', system: 'Employee Central', type: 'String', length: 10, mandatory: true, local: false, mapping: '', foundationObjectId: '135', allowedValues: ['Active','Passive'] },
    { id: 'f9', name: 'Last Name', system: 'Employee Central', type: 'String', length: 10, mandatory: true, local: false, mapping: '', foundationObjectId: '135' },
    { id: 'f10', name: 'First Name', system: 'Employee Central', type: 'String', length: 10, mandatory: true, local: false, mapping: '', foundationObjectId: '135' },
    { id: 'f11', name: 'First Name', system: '4Plan', type: 'String', length: 10, mandatory: true, local: false, mapping: '', foundationObjectId: '135' },
    { id: 'f12', name: 'Last Name', system: '4Plan', type: 'String', length: 10, mandatory: true, local: false, mapping: '', foundationObjectId: '135' },
    { id: 'f15', name: 'Master Cost Center', system: 'P01', type: 'String', length: 10, mandatory: true, local: false, mapping: '', foundationObjectId: '135' },
    { id: 'f16', name: 'Job Code', system: 'Employee Central', type: 'String', length: 10, mandatory: true, local: false, mapping: '', foundationObjectId: '159' },
    { id: 'le7010_f17', name: 'Local Status', system: 'Employee Central', type: 'String', length: 10, mandatory: true, local: true, mapping: '', foundationObjectId: '135', legalEntityNumber: '7010', allowedValues: ['Short term Absence','Long-term-absend','Military service','active'] },
    { id: 'le6006_f18', name: 'Local Contract Type', system: 'Employee Central', type: 'String', length: 10, mandatory: true, local: true, mapping: '', foundationObjectId: '135', legalEntityNumber: '6006', allowedValues: ['Short term contract','Limited','Permanent contract','Unlimited'] },
  ],
  fieldColumns: [
    { name: 'Field Name', visible: true, order: 1 },
    { name: 'System', visible: true, order: 2 },
    { name: 'Mandatory', visible: true, order: 3 },
    { name: 'Mapping', visible: true, order: 4 },
    { name: 'Data Object', visible: true, order: 5 },
    { name: 'Definition', visible: true, order: 6 },
  ],
  legalEntities: [
    { id: 1, number: '4004', name: 'LEONI B', country: 'Germany' },
    { id: 2, number: '2001', name: 'LEONI Inc.', country: 'US' },
    { id: 3, number: '6004', name: 'LEONI Egypt', country: 'Egypt' },
    { id: 4, number: '6006', name: 'LEONI Tunisia', country: 'Tunisia' },
    { id: 5, number: '7010', name: 'LEONI Shanghai', country: 'China' },
  ],

  leSystemMap: {
    '6006': ['sys-ec'],
    '7010': ['sys-ec'],
    '2001': ['sys-smr'],            // LEONI INC nutzt Smart Recruiters
  },


  glossaryTerms: [
    { id: 'gls-001', term: 'Global ID', definition: 'Unique ID of Employee at LEONI', info: 'Created in IDM', owner: 'HR Analytics', fieldRef: '', type: 'Term' },
    { id: 'gls-002', term: 'Org-Code', definition: 'Shows the organizational allocation of a position', info: 'As shown in Org-Man', owner: 'Org Dev', fieldRef: '', type: 'Term' },
    { id: 'gls-003', term: 'Position ID', definition: 'Unique Position ID within LEONI', info: 'Starts with X_', owner: 'HR Analytics', fieldRef: '', type: 'Term' },
    { id: 'gls-004', term: 'Status', definition: 'Shows if the employee is active or passive', info: '', owner: 'HR Analytics', fieldRef: '', type: 'Term' },
    { id: 'gls-005', term: 'Working Hours', definition: 'Contractual working hours of the employee', info: '', owner: 'HR Analytics', fieldRef: '', type: 'Term' },
    { id: 'gls-006', term: 'Time to recruit', definition: 'Time from final approval of PR until contract signed', info: '', owner: 'HR Analytics', fieldRef: '', type: 'KPI' },
  ],
  glossaryVersion: { major: 1, minor: 0 },
  glossaryChanges: [],
  currentSystem: 'All Systems',
  currentDomain: null,
  editFieldIndex: null,
  editSystemIndex: null,
  editFoundationIndex: null,
  editColumnIndex: null,
  editDomainIndex: null,
  editLegalIndex: null,
  editGlossaryIndex: null,
  glossaryTypeFilter: 'ALL',
  nodeCollapsed: new Map(),
  mapTransformState: { x: 20, y: 20, k: 1 },
  mapFilters: {
    systems: [],
    domains: [],
    scope: { global: true, local: true },
    search: '',
  },
  mapPositions: {},
  selectedFieldRef: null,
  editingLeIndexForSystems: null,
  globalSort: { key: 'system', dir: 'asc' },
  showGlobalFilters: false,
  showLocalFilters: false,
  isPanning: false,
  panStart: { x: 0, y: 0 },
  currentMapView: 'system', // 'system' or 'dataobject'
  selectedDataObject: null, // { id, name } when a data object is selected
  dataObjectPositions: {}, // positions for data objects in the map
};

export function resetSelectionState() {
  state.editFieldIndex = null;
  state.editSystemIndex = null;
  state.editFoundationIndex = null;
  state.editColumnIndex = null;
  state.editDomainIndex = null;
  state.editLegalIndex = null;
  state.editGlossaryIndex = null;
  state.selectedFieldRef = null;
  state.editingLeIndexForSystems = null;
}
// === MAPPINGS STATE HELPERS (replace) ===
// WICHTIG: KEIN erneutes "export const state = …" hier!
// Oben existiert bereits: export const state = { … }

if (!state.mappings) state.mappings = [];
if (!state.valueMaps) state.valueMaps = [];

/** Felderzugriff zentralisieren (deine Felder liegen in state.fields) */
export function getAllFields() {
  return Array.isArray(state.fields) ? state.fields : [];
}

/**
 * Deine Datenstruktur:
 * - Lokale Felder: f.local === true
 * - System steht als NAME in f.system (z.B. "Employee Central")
 * - Legal Entity steht in f.legalEntityNumber (z.B. "7010")
 * - Data Object steht in f.foundationObjectId (z.B. "135")
 */
export function getLocalFields({ legalEntityId, systemId, dataObjectId } = {}) {
  const list = getAllFields().filter(f => f.local === true);
  return list.filter(f =>
    (legalEntityId ? String(f.legalEntityNumber || '') === String(legalEntityId) : true) &&
    (systemId ? String(f.system || '') === String(systemId) : true) &&
    (dataObjectId ? String(f.foundationObjectId || '') === String(dataObjectId) : true)
  );
}

export function getGlobalFields({ dataObjectId } = {}) {
  const list = getAllFields().filter(f => f.local !== true);
  return list.filter(f =>
    (dataObjectId ? String(f.foundationObjectId || '') === String(dataObjectId) : true)
  );
}

export function findFieldById(id) {
  return getAllFields().find(f => f.id === id);
}

export function getAllowedValues(fieldId) {
  const f = findFieldById(fieldId);
  return Array.isArray(f?.allowedValues) ? f.allowedValues : [];
}

/** Mapping-Helpers
 * Hinweis: Wir speichern im Mapping später:
 *  - legalEntityId  (bei dir entspricht das der number, z.B. "7010")
 *  - systemId       (bei dir verwenden wir den System-NAMEN, z.B. "Employee Central")
 *  - dataObjectId   (entspricht foundationObjectId des Local Fields)
 */
export function findMappings(filter = {}) {
  const { legalEntityId, systemId, dataObjectId } = filter;
  const list = Array.isArray(state.mappings) ? state.mappings : [];
  return list.filter(m =>
    (legalEntityId ? String(m.legalEntityId || '') === String(legalEntityId) : true) &&
    (systemId ? String(m.systemId || '') === String(systemId) : true) &&
    (dataObjectId ? String(m.dataObjectId || '') === String(dataObjectId) : true)
  );
}

export function findValueMapByMappingId(fieldMappingId) {
  const list = Array.isArray(state.valueMaps) ? state.valueMaps : [];
  return list.find(vm => vm.fieldMappingId === fieldMappingId);
}
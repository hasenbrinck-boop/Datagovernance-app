const STORAGE_KEY_PERMS = 'gdf_permissions_v1';

export const defaultPermissions = {
  roles: ['public', 'viewer', 'editor', 'owner', 'admin'],
  tabs: {
    systems: { public: false, viewer: true, editor: true, owner: true, admin: true },
    global: { public: true, viewer: true, editor: true, owner: true, admin: true },
    local: { public: true, viewer: true, editor: true, owner: true, admin: true },
    glossary: { public: true, viewer: true, editor: true, owner: true, admin: true },
    dataMap: { public: true, viewer: true, editor: true, owner: true, admin: true },
    admin: { public: false, viewer: false, editor: false, owner: true, admin: true }
  },
  actions: {
    global: { create: false, edit: false, delete: false, approve: false, export: true },
    local: { create: true, edit: true, delete: false, approve: false, export: true },
    glossary: { create: false, edit: false, delete: false, approve: false, export: false },
    systems: { create: false, edit: false, delete: false, approve: false, export: false },
    admin: { create: true, edit: true, delete: true, approve: true, export: false }
  },
  roleOverrides: {
    public: {},
    viewer: {},
    editor: {
      local: { create: true, edit: true, delete: false, approve: false }
    },
    owner: {
      local: { approve: true },
      global: { approve: true }
    },
    admin: { '*': { create: true, edit: true, delete: true, approve: true, export: true } }
  }
};

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function mergePermissions(base, override) {
  const result = deepClone(base);
  if (!override || typeof override !== 'object') {
    return result;
  }

  if (Array.isArray(override.roles)) {
    result.roles = override.roles.filter((role) => typeof role === 'string');
  }

  if (override.tabs && typeof override.tabs === 'object') {
    result.tabs = { ...result.tabs };
    Object.entries(override.tabs).forEach(([tabKey, tabValue]) => {
      if (!tabValue || typeof tabValue !== 'object') return;
      result.tabs[tabKey] = { ...(result.tabs[tabKey] || {}) };
      Object.entries(tabValue).forEach(([role, allowed]) => {
        if (typeof allowed === 'boolean') {
          result.tabs[tabKey][role] = allowed;
        }
      });
    });
  }

  if (override.actions && typeof override.actions === 'object') {
    result.actions = { ...result.actions };
    Object.entries(override.actions).forEach(([section, actions]) => {
      if (!actions || typeof actions !== 'object') return;
      result.actions[section] = { ...(result.actions[section] || {}) };
      Object.entries(actions).forEach(([action, allowed]) => {
        if (typeof allowed === 'boolean') {
          result.actions[section][action] = allowed;
        }
      });
    });
  }

  if (override.roleOverrides && typeof override.roleOverrides === 'object') {
    result.roleOverrides = { ...result.roleOverrides };
    Object.entries(override.roleOverrides).forEach(([role, sections]) => {
      if (!sections || typeof sections !== 'object') return;
      const current = { ...(result.roleOverrides[role] || {}) };
      Object.entries(sections).forEach(([section, actions]) => {
        if (!actions || typeof actions !== 'object') {
          current[section] = actions;
          return;
        }
        current[section] = { ...(current[section] || {}) };
        Object.entries(actions).forEach(([action, allowed]) => {
          if (typeof allowed === 'boolean') {
            current[section][action] = allowed;
          }
        });
      });
      result.roleOverrides[role] = current;
    });
  }

  return result;
}

export function loadPermissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PERMS);
    if (!raw) {
      return deepClone(defaultPermissions);
    }
    const parsed = JSON.parse(raw);
    return mergePermissions(defaultPermissions, parsed);
  } catch (error) {
    console.warn('[permissions] Failed to load permissions, using defaults.', error);
    return deepClone(defaultPermissions);
  }
}

export function savePermissions(perms) {
  localStorage.setItem(STORAGE_KEY_PERMS, JSON.stringify(perms));
}

function rolesOf(user) {
  if (Array.isArray(user?.roles) && user.roles.length) {
    return user.roles;
  }
  return ['public'];
}

function hasStarAllow(perms, role) {
  const star = perms.roleOverrides?.[role]?.['*'];
  if (!star || typeof star !== 'object') return false;
  return ['create', 'edit', 'delete', 'approve', 'export'].some(
    (action) => star[action] === true
  );
}

export function canViewTab(perms, tab, user) {
  const roles = rolesOf(user);
  return roles.some((role) => {
    if (hasStarAllow(perms, role)) {
      return true;
    }
    const tabConfig = perms.tabs?.[tab];
    if (!tabConfig) return false;
    const value = tabConfig[role];
    return typeof value === 'boolean' ? value : false;
  });
}

export function canDo(perms, section, action, user) {
  const roles = rolesOf(user);
  return roles.some((role) => {
    const star = perms.roleOverrides?.[role]?.['*'];
    if (star && typeof star === 'object' && typeof star[action] === 'boolean') {
      return star[action];
    }
    const override = perms.roleOverrides?.[role]?.[section];
    if (override && typeof override[action] === 'boolean') {
      return override[action];
    }
    const base = perms.actions?.[section]?.[action];
    return !!base;
  });
}

export { STORAGE_KEY_PERMS as _permissionsStorageKey };

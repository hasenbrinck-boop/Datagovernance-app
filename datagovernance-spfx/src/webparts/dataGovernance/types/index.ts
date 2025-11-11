// Type definitions for the Data Governance application
// Converted from the original JavaScript application

export interface IDataDomain {
  name: string;
  manager: string;
  active: boolean;
  color: string;
}

export interface ISystem {
  id: string;
  name: string;
  owner: string;
  version: string;
  scope: 'both' | 'global' | 'local';
  dataDomain: string;
}

export interface IDataObject {
  id: number;
  name: string;
  domain: string;
}

export interface IField {
  id: string;
  name: string;
  system: string;
  type?: string;
  length?: number;
  mandatory: boolean;
  local: boolean;
  mapping: string;
  foundationObjectId?: string;
  glossaryRef?: string;
  legalEntityNumber?: string;
  allowedValues?: string[];
  source?: {
    system: string;
    field: string;
  };
}

export interface IFieldColumn {
  name: string;
  visible: boolean;
  order: number;
}

export interface ILegalEntity {
  id: number;
  number: string;
  name: string;
  country: string;
}

export interface IGlossaryTerm {
  id: string;
  term: string;
  definition: string;
  info: string;
  owner: string;
  fieldRef: string;
  type: 'Field' | 'Term' | 'KPI' | 'Process' | 'System';
}

export interface IMapping {
  id?: string;
  legalEntityId: string;
  systemId: string;
  dataObjectId: string;
  localFieldId: string;
  globalFieldId: string;
  status?: 'draft' | 'active' | 'paused';
}

export interface IValueMap {
  fieldMappingId: string;
  pairs: Array<{
    localValue: string;
    globalValue: string;
  }>;
}

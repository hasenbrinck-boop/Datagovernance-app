import * as React from 'react';
import {
  IDataDomain,
  ISystem,
  IDataObject,
  IField,
  IFieldColumn,
  ILegalEntity,
  IGlossaryTerm,
  IMapping,
  IValueMap
} from '../types';

export interface IAppState {
  dataDomains: IDataDomain[];
  systems: ISystem[];
  dataObjects: IDataObject[];
  fields: IField[];
  fieldColumns: IFieldColumn[];
  legalEntities: ILegalEntity[];
  glossaryTerms: IGlossaryTerm[];
  mappings: IMapping[];
  valueMaps: IValueMap[];
}

// Create context with default empty state
export const AppContext = React.createContext<IAppState>({
  dataDomains: [],
  systems: [],
  dataObjects: [],
  fields: [],
  fieldColumns: [],
  legalEntities: [],
  glossaryTerms: [],
  mappings: [],
  valueMaps: []
});

// Hook to use the app context
export const useAppContext = (): IAppState => {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContext.Provider');
  }
  return context;
};

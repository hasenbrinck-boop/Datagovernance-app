import * as React from 'react';
import styles from './DataGovernance.module.scss';
import { IDataGovernanceProps } from './IDataGovernanceProps';
import { escape } from '@microsoft/sp-lodash-subset';

// Import sub-components (to be created)
import { AppContext, IAppState } from '../context/AppContext';
import { TopBar } from './TopBar/TopBar';
import { Sidebar } from './Sidebar/Sidebar';
import { MainContent } from './MainContent/MainContent';

export interface IDataGovernanceState extends IAppState {
  currentView: 'dashboard' | 'systems' | 'datamap' | 'glossary' | 'admin';
  currentTab: 'global' | 'local' | 'mappings';
  sidebarCollapsed: boolean;
}

export default class DataGovernance extends React.Component<IDataGovernanceProps, IDataGovernanceState> {
  
  constructor(props: IDataGovernanceProps) {
    super(props);
    
    // Initialize state with data from storage or defaults
    this.state = {
      currentView: 'systems',
      currentTab: 'global',
      sidebarCollapsed: false,
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
      fields: [],
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
      glossaryTerms: [],
      mappings: [],
      valueMaps: []
    };
  }

  public componentDidMount(): void {
    // Load data from storage if enabled
    if (this.props.enableLocalStorage) {
      this.loadFromLocalStorage();
    }
  }

  private loadFromLocalStorage = (): void => {
    try {
      // Load data from localStorage similar to the original app
      const fields = localStorage.getItem('gdf_fields_v2');
      const glossary = localStorage.getItem('gdf_glossary_v1');
      const mappings = localStorage.getItem('gdf_mappings_v1');
      
      if (fields) {
        this.setState({ fields: JSON.parse(fields) });
      }
      if (glossary) {
        this.setState({ glossaryTerms: JSON.parse(glossary) });
      }
      if (mappings) {
        const mappingsData = JSON.parse(mappings);
        this.setState({ 
          mappings: mappingsData.mappings || [],
          valueMaps: mappingsData.valueMaps || []
        });
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }

  private handleViewChange = (view: 'dashboard' | 'systems' | 'datamap' | 'glossary' | 'admin'): void => {
    this.setState({ currentView: view });
  }

  private handleTabChange = (tab: 'global' | 'local' | 'mappings'): void => {
    this.setState({ currentTab: tab });
  }

  private toggleSidebar = (): void => {
    this.setState(prevState => ({ sidebarCollapsed: !prevState.sidebarCollapsed }));
  }

  public render(): React.ReactElement<IDataGovernanceProps> {
    const { description } = this.props;
    const { currentView, currentTab, sidebarCollapsed } = this.state;

    return (
      <AppContext.Provider value={this.state}>
        <div className={styles.dataGovernance}>
          <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <TopBar 
              currentView={currentView}
              onViewChange={this.handleViewChange}
              onToggleSidebar={this.toggleSidebar}
            />
            
            <Sidebar 
              currentView={currentView}
              collapsed={sidebarCollapsed}
            />
            
            <MainContent 
              currentView={currentView}
              currentTab={currentTab}
              onTabChange={this.handleTabChange}
            />
          </div>
        </div>
      </AppContext.Provider>
    );
  }
}

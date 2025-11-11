import * as React from 'react';
import styles from './Sidebar.module.scss';
import { useAppContext } from '../../context/AppContext';

export interface ISidebarProps {
  currentView: 'dashboard' | 'systems' | 'datamap' | 'glossary' | 'admin';
  collapsed: boolean;
}

export const Sidebar: React.FC<ISidebarProps> = ({ currentView, collapsed }) => {
  const { systems } = useAppContext();
  
  const renderSystemsList = (): JSX.Element => {
    return (
      <ul id="systemList" className="sidebar-list">
        {systems.map(system => (
          <li key={system.id}>
            <button className="system-item" type="button">
              {system.name}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  const renderDataMapSubmenu = (): JSX.Element => {
    return (
      <ul id="dataMapSubnav" className="sidebar-list" style={{ display: currentView === 'datamap' ? 'block' : 'none' }}>
        <li><button className="map-view-filter is-active" data-view="system">System-View</button></li>
        <li><button className="map-view-filter" data-view="dataobject">Data Object-View</button></li>
      </ul>
    );
  };

  const renderGlossarySubmenu = (): JSX.Element => {
    const glossaryTypes = ['ALL', 'Field', 'Term', 'KPI', 'Process', 'System'];
    return (
      <ul id="glossarySubnav" className="sidebar-list" style={{ display: currentView === 'glossary' ? 'block' : 'none' }}>
        {glossaryTypes.map(type => (
          <li key={type}>
            <button className="gls-filter" data-type={type}>{type === 'ALL' ? 'All Definitions' : type}</button>
          </li>
        ))}
      </ul>
    );
  };

  const renderAdminSubmenu = (): JSX.Element => {
    const adminSections = [
      { id: 'admin-domains', label: 'Data Domains' },
      { id: 'admin-systems', label: 'Systems' },
      { id: 'admin-legal', label: 'Legal Entities' },
      { id: 'admin-dataObjects', label: 'Data Objects' },
      { id: 'admin-columns', label: 'Field Information' }
    ];
    
    return (
      <ul id="adminSubnav" className="sidebar-list" style={{ display: currentView === 'admin' ? 'block' : 'none' }}>
        {adminSections.map(section => (
          <li key={section.id}>
            <button className="admin-nav-item" data-admin-tab={section.id}>
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-head">
          <div className="sidebar-title">Navigation</div>
        </div>
        
        {currentView === 'systems' && renderSystemsList()}
        {currentView === 'datamap' && renderDataMapSubmenu()}
        {currentView === 'glossary' && renderGlossarySubmenu()}
        {currentView === 'admin' && renderAdminSubmenu()}
      </div>
    </aside>
  );
};

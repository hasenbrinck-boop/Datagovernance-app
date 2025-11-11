import * as React from 'react';
import styles from './MainContent.module.scss';

export interface IMainContentProps {
  currentView: 'dashboard' | 'systems' | 'datamap' | 'glossary' | 'admin';
  currentTab: 'global' | 'local' | 'mappings';
  onTabChange: (tab: 'global' | 'local' | 'mappings') => void;
}

export const MainContent: React.FC<IMainContentProps> = ({ currentView, currentTab, onTabChange }) => {
  
  const renderTabs = (): JSX.Element | null => {
    if (currentView !== 'systems') return null;
    
    return (
      <div id="topTabs" className="top-tabs">
        <button 
          className={`tab ${currentTab === 'global' ? 'is-active' : ''}`}
          onClick={() => onTabChange('global')}
        >
          Global Data Fields
        </button>
        <button 
          className={`tab ${currentTab === 'local' ? 'is-active' : ''}`}
          onClick={() => onTabChange('local')}
        >
          Local Data Fields
        </button>
        <button 
          className={`tab ${currentTab === 'mappings' ? 'is-active' : ''}`}
          onClick={() => onTabChange('mappings')}
        >
          Mappings
        </button>
      </div>
    );
  };

  const renderContent = (): JSX.Element => {
    switch (currentView) {
      case 'dashboard':
        return <div>Dashboard View - To be implemented</div>;
      case 'systems':
        return (
          <div>
            {currentTab === 'global' && <div>Global Fields View - To be implemented</div>}
            {currentTab === 'local' && <div>Local Fields View - To be implemented</div>}
            {currentTab === 'mappings' && <div>Mappings View - To be implemented</div>}
          </div>
        );
      case 'datamap':
        return <div>Data Map View - To be implemented</div>;
      case 'glossary':
        return <div>Glossary View - To be implemented</div>;
      case 'admin':
        return <div>Admin View - To be implemented</div>;
      default:
        return <div>Unknown view</div>;
    }
  };

  return (
    <main className="main">
      {renderTabs()}
      {renderContent()}
      
      <footer className="main-footer">
        <button id="resetAllAppData" className="btn btn--ghost btn--sm">
          Reset App Data
        </button>
      </footer>
    </main>
  );
};

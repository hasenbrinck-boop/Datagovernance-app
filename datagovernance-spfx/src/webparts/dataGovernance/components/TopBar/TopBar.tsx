import * as React from 'react';
import styles from './TopBar.module.scss';

export interface ITopBarProps {
  currentView: 'dashboard' | 'systems' | 'datamap' | 'glossary' | 'admin';
  onViewChange: (view: 'dashboard' | 'systems' | 'datamap' | 'glossary' | 'admin') => void;
  onToggleSidebar: () => void;
}

export const TopBar: React.FC<ITopBarProps> = ({ currentView, onViewChange, onToggleSidebar }) => {
  return (
    <header className="topbar" role="banner">
      <div className="topbar-inner floating rounded">
        <button 
          id="sidebarToggle" 
          className="sidebar-toggle" 
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
        >
          ☰
        </button>
        <nav className="topnav" aria-label="Primary">
          <button 
            className={`topnav-item ${currentView === 'dashboard' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onViewChange('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`topnav-item ${currentView === 'systems' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onViewChange('systems')}
          >
            Systems
          </button>
          <button 
            className={`topnav-item ${currentView === 'datamap' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onViewChange('datamap')}
          >
            Data Map
          </button>
          <button 
            className={`topnav-item ${currentView === 'glossary' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onViewChange('glossary')}
          >
            Glossary
          </button>
          <button 
            className={`topnav-item ${currentView === 'admin' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onViewChange('admin')}
          >
            Admin
          </button>
        </nav>
      </div>
    </header>
  );
};

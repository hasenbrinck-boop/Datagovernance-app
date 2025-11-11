import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneToggle
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import * as strings from 'DataGovernanceWebPartStrings';
import DataGovernance from './components/DataGovernance';
import { IDataGovernanceProps } from './components/IDataGovernanceProps';
import { IDataGovernanceWebPartProps } from './IDataGovernanceWebPartProps';

export default class DataGovernanceWebPart extends BaseClientSideWebPart<IDataGovernanceWebPartProps> {

  public render(): void {
    const element: React.ReactElement<IDataGovernanceProps> = React.createElement(
      DataGovernance,
      {
        description: this.properties.description,
        enableLocalStorage: this.properties.enableLocalStorage,
        enableSharePointLists: this.properties.enableSharePointLists,
        context: this.context
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('description', {
                  label: strings.DescriptionFieldLabel
                }),
                PropertyPaneToggle('enableLocalStorage', {
                  label: strings.AppLocalStorageFieldLabel,
                  onText: 'Enabled',
                  offText: 'Disabled'
                }),
                PropertyPaneToggle('enableSharePointLists', {
                  label: strings.AppSharePointListsFieldLabel,
                  onText: 'Enabled',
                  offText: 'Disabled'
                })
              ]
            }
          ]
        }
      ]
    };
  }
}

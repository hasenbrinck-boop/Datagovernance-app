import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface IDataGovernanceProps {
  description: string;
  enableLocalStorage: boolean;
  enableSharePointLists: boolean;
  context: WebPartContext;
}

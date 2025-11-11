declare interface IDataGovernanceWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  DescriptionFieldLabel: string;
  AppLocalStorageFieldLabel: string;
  AppSharePointListsFieldLabel: string;
}

declare module 'DataGovernanceWebPartStrings' {
  const strings: IDataGovernanceWebPartStrings;
  export = strings;
}

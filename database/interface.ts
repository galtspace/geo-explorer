/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

export default interface IExplorerDatabase {
  flushDatabase(): Promise<void>;

  addOrUpdateContour(contourGeohashes: string[], spaceTokenId: number): Promise<void>;

  getContourBySpaceTokenId(spaceTokenId): Promise<string[]>;

  getContoursByParentGeohash(parentGeohash: string): Promise<[{ contour: string[], spaceTokenId: number }]>;

  getSpaceTokenGeoData(spaceTokenId): Promise<ISpaceTokenGeoData>;
  
  addOrUpdateGeoData(geoData: ISpaceTokenGeoData): Promise<ISpaceTokenGeoData>;

  getSaleOrder(orderId): Promise<ISaleOrder>;
  
  addOrUpdateSaleOrder(saleOrder: ISaleOrder): Promise<ISaleOrder>;

  filterSaleOrders(filterQuery: SaleOrdersQuery): Promise<ISaleOrder[]>;
  
  filterSaleOrdersCount(filterQuery: SaleOrdersQuery): Promise<number>;

  getApplication(applicationId, contractAddress): Promise<IApplication>;

  addOrUpdateApplication(application: IApplication): Promise<IApplication>;

  filterApplications(filterQuery: ApplicationsQuery): Promise<IApplication[]>;

  filterApplicationsCount(filterQuery: ApplicationsQuery): Promise<number>;
  
  getValue(key: string): Promise<string>;

  setValue(key: string, content: string): Promise<void>;

  clearValue(key: string): Promise<void>;
}

export interface ISpaceTokenGeoData {
  spaceTokenId;
  tokenType;
  type;
  subtype;
  fullRegion;
  regionLvl1?;
  regionLvl2?;
  regionLvl3?;
  regionLvl4?;
  regionLvl5?;
  regionLvl6?;
  regionLvl7?;
  regionLvl8?;
  regionLvl9?;
  photosCount;
  floorPlansCount;
  bathroomsCount;
  bedroomsCount;
  yearBuilt;
  area;
  owner;
  areaSource;
  ledgerIdentifier;
  dataLink;
  dataJson;
  geohashContourJson;
  heightsContourJson;
  featureArray;
}

export interface ISaleOrder {
  orderId;
  currency?;
  currencyAddress?;
  currencyName?;
  seller?;
  ask?;
  description?;
  lastBuyer?;
  dataJson?;

  featureArray?;
  typesSubtypesArray?;
  minLandArea?;
  maxLandArea?;
  sumLandArea?;
  minBuildingArea?;
  maxBuildingArea?;
  sumBuildingArea?;
  minYearBuilt?;
  maxYearBuilt?;
  sumBathroomsCount?;
  sumBedroomsCount?;
  maxBathroomsCount?;
  maxBedroomsCount?;
  minBathroomsCount?;
  minBedroomsCount?;
  
  addSpaceTokens?(tokensObjects);
}

export interface IApplication {
  applicationId;
  applicantAddress;
  feeCurrency;
  feeAmount;
  feeCurrencyAddress;
  feeCurrencyName;
  status;
  contractType;
  contractAddress;
  rolesArray;
  dataJson;

  addSpaceTokens?(tokensObjects);
}

export interface SaleOrdersQuery {
  limit?: number;
  offset?: number;
  
  sortBy?: string;
  sortDir?: string;
  
  tokensIds?: string[];
  
  features?: string[];
  
  currency?: string;
  currencyAddress?: string;
  
  regions?: string[];
  types?: string[];
  subtypes?: string[];
  
  askMin?: number;
  askMax?: number;

  buildingAreaMin?: number;
  buildingAreaMax?: number;

  landAreaMin?: number;
  landAreaMax?: number;

  bedroomsCountMin?: number;
  bathroomsCountMin?: number;
}

export interface ApplicationsQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  tokensIds?: string[];

  features?: string[];

  feeAmount?: number;
  feeCurrency?: string;
  feeCurrencyAddress?: string;

  applicantAddress?: string;
  contractAddress?: string;

  regions?: string[];
  types?: string[];
  subtypes?: string[];

  askMin?: number;
  askMax?: number;

  areaMin?: number;
  areaMax?: number;

  bedroomsCountMin?: number;
  bathroomsCountMin?: number;
}

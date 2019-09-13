/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import {IExplorerChainContourEvent} from "../interfaces";

export default interface IExplorerChainService {
  websocketProvider: any;
  web3: any;

  spaceGeoData: any;
  propertyMarket: any;
  contractsConfig: any;

  callbackOnReconnect: any;

  getEventsFromBlock(eventName: string, blockNumber?: number): Promise<IExplorerChainContourEvent[]>;

  subscribeForNewEvents(eventName: string, blockNumber: number, callback): void;

  getCurrentBlock(): Promise<number>;

  onReconnect(callback): void;

  getSpaceTokenArea(spaceTokenId): Promise<number>;

  getSaleOrder(orderId): Promise<ChainServiceSaleOrder>;
}

export enum ChainServiceEvents {
  SetSpaceTokenContour = 'SetSpaceTokenContour',
  SetSpaceTokenDataLink = 'SetSpaceTokenDataLink',
  SaleOrderStatusChanged = 'SaleOrderStatusChanged'
}

export interface ChainServiceSaleOrder {
  id: string;
  seller: string;
  operator: string;
  createdAt: number;
  ask: number;
  lastBuyer: string;
  tokenContract: string;

  escrowCurrency: number;

  details: ChainServiceSaleOrderDetails;
  status: number;
}

export interface ChainServiceSaleOrderDetails {
  spaceTokenIds: string[];
  dataAddress: string;
}

/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import {IExplorerGeoDataEvent, IExplorerSaleOrderEvent} from "../interfaces";
import {FilterSaleOrdersQuery, ISaleOrder} from "../../database/interface";

export default interface IExplorerGeoDataService {
  handleChangeSpaceTokenDataEvent(event: IExplorerGeoDataEvent): Promise<void>;
  
  handleSaleOrderEvent(event: IExplorerSaleOrderEvent): Promise<void>;

  filterOrders(ordersQuery: FilterSaleOrdersGeoQuery): Promise<ISaleOrder[]>;
}

export interface FilterSaleOrdersGeoQuery extends FilterSaleOrdersQuery {
  surroundingsGeohashBox?: string[];
}

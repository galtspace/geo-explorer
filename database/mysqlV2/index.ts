/*
 * Copyright ©️ 2019 GaltProject Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import IExplorerDatabase, {
  ISpaceTokenGeoData,
  ISaleOrder,
  SaleOrdersQuery,
  IApplication,
  ApplicationsQuery, SpaceTokensQuery, SaleOffersQuery, ISaleOffer
} from "../interface";

const _ = require("lodash");
const pIteration = require("p-iteration");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

const config = require('./config');

module.exports = async function (extendConfig?: any) {
  const extendedConfig = _.merge({}, config, extendConfig || {});
  // console.log('extendedConfig.options', extendedConfig.options);

  let sequelize = new Sequelize(extendedConfig.name, extendedConfig.user, extendedConfig.password, extendedConfig.options);

  let models;
  try {
    models = await require('./models/index')(sequelize);
  } catch (e) {
    return console.error('Error', e);
  }

  return new MysqlExplorerDatabase(sequelize, models, extendedConfig);
};

class MysqlExplorerDatabase implements IExplorerDatabase {
  sequelize: any;
  models: any;
  config: any;

  constructor(_sequelize, _models, _config) {
    this.sequelize = _sequelize;
    this.models = _models;
    this.config = _config;
  }

  async flushDatabase() {
    await this.models.GeohashSpaceToken.destroy({where: {}});
    
    await this.models.Application.destroy({where: {}});
    await this.models.SpaceTokensOrders.destroy({where: {}});
    await this.models.SpaceTokenGeoData.destroy({where: {}});
    
    await this.models.SaleOffer.destroy({where: {}});
    await this.models.SaleOrder.destroy({where: {}});
    
    await this.models.PrivatePropertyRegistry.destroy({where: {}});
    
    await this.models.Value.destroy({where: {}});
  }

  // =============================================================
  // Geohashes
  // =============================================================
  
  async addOrUpdateContour(contourGeohashes: string[], tokenId: number, contractAddress: string) {
    // find contour object with included geohashes

    let dbContourGeohashes = await this.models.GeohashSpaceToken.findAll({
      where: {tokenId, contractAddress}, attributes: ['contourGeohash']
    });

    // remove excluded geohashes and mark exists
    await pIteration.forEach(dbContourGeohashes, async (geohashObj) => {
      const contourGeohash = geohashObj.contourGeohash;

      if (!_.includes(contourGeohashes, contourGeohash)) {
        await this.models.GeohashSpaceToken.destroy({where: {tokenId, contractAddress, contourGeohash}});
      }
    });

    await pIteration.forEach(contourGeohashes, async (contourGeohash, position) => {
      // bind geohash to contour
      await this.models.GeohashSpaceToken.create({tokenId, contourGeohash, contractAddress, position}).catch(e => {
        // it exists so update it
        return this.models.GeohashSpaceToken.update({position}, {where: {tokenId, contourGeohash, contractAddress}});
      });
    });
  }

  async getContourBySpaceTokenId(tokenId, contractAddress) {
    const where: any = { tokenId };
    if(contractAddress) {
      where.contractAddress = contractAddress;
    }
    return this.models.GeohashSpaceToken.findAll({
      where, order: [['position', 'ASC']]
    }).then(spaceTokenGeohashes => {
      return spaceTokenGeohashes.map(geohashObj => geohashObj.contourGeohash);
    })
  }

  async getContoursByParentGeohash(parentGeohash: string, contractAddress?): Promise<[{ contour: string[], tokenId: number }]> {
    const where: any = { contourGeohash: {[Op.like]: parentGeohash + '%'} };
    if(contractAddress) {
      where.contractAddress = contractAddress;
    }
    let foundContourGeohashes = await this.models.GeohashSpaceToken.findAll({ where });

    foundContourGeohashes = _.uniqBy(foundContourGeohashes, 'tokenId');

    return await pIteration.map(foundContourGeohashes, async (geohashObj) => {
      const {tokenId, contractAddress} = geohashObj;

      let contour = await this.getContourBySpaceTokenId(tokenId, geohashObj.contractAddress);

      return {contour, tokenId, contractAddress};
    });
  }

  // =============================================================
  // SpaceGeoData
  // =============================================================
  
  async getSpaceTokenGeoData(tokenId, contractAddress) {
    return this.models.SpaceTokenGeoData.findOne({
      where: { tokenId, contractAddress: {[Op.like]: contractAddress}  }
    });
  }

  async addOrUpdateGeoData(geoData: ISpaceTokenGeoData) {
    let dbObject = await this.getSpaceTokenGeoData(geoData.tokenId, geoData.contractAddress);

    if(dbObject) {
      geoData.createdAtBlock = dbObject.createdAtBlock || geoData.createdAtBlock;
      await this.models.SpaceTokenGeoData.update(geoData, {
        where: {tokenId: geoData.tokenId, contractAddress: geoData.contractAddress}
      });
    } else {
      return this.models.SpaceTokenGeoData.create(geoData).catch(() => {});
    }
    return this.getSpaceTokenGeoData(geoData.tokenId, geoData.contractAddress);
  }

  async getSaleOrder(orderId, contractAddress) {
    const saleOrder = await this.models.SaleOrder.findOne({
      where: {orderId, contractAddress},
      include: [{
        model: this.models.SpaceTokenGeoData,
        as: 'spaceTokens',
      }]
    });

    if(!saleOrder) {
      return null;
    }
    saleOrder.spaceTokens = _.orderBy(saleOrder.spaceTokens, [(spaceToken) => {
      return spaceToken.spaceTokensOrders.position;
    }], ['asc']);
    
    return saleOrder;
  }
  
  async addOrUpdateSaleOrder(saleOrder: ISaleOrder) {
    // console.log('addOrUpdateSaleOrder', saleOrder);
    let dbObject = await this.getSaleOrder(saleOrder.orderId, saleOrder.contractAddress);

    if(dbObject) {
      saleOrder.createdAtBlock = dbObject.createdAtBlock || saleOrder.createdAtBlock;
      await this.models.SaleOrder.update(saleOrder, {
        where: {orderId: saleOrder.orderId}
      });
    } else {
      return this.models.SaleOrder.create(saleOrder).catch(() => {
        return this.models.SaleOrder.update(saleOrder, {
          where: {orderId: saleOrder.orderId}
        });
      });
    }
    return this.getSaleOrder(saleOrder.orderId, saleOrder.contractAddress);
  }
  
  prepareSaleOrdersWhere(ordersQuery) {
    const allWheres: any = {};

    ['ask', 'bedroomsCount', 'bathroomsCount'].forEach(field => {
      const minVal = parseFloat(ordersQuery[field + 'Min']);
      const maxVal = parseFloat(ordersQuery[field + 'Max']);
      if(!minVal && !maxVal)
        return;

      const fieldWhereObj = {};
      if(minVal)
        fieldWhereObj[Op.gte] = minVal;

      if(maxVal)
        fieldWhereObj[Op.lte] = maxVal;

      const dbFields = {
        'bedroomsCount': 'sumBedroomsCount',
        'bathroomsCount': 'sumBathroomsCount'
      };

      field = dbFields[field] || field;

      allWheres[field] = fieldWhereObj;
    });

    const filtersByTypes = {};
    ['land', 'building'].forEach(tokenType => {
      ['area'].forEach(field => {
        const filterField = tokenType + _.upperFirst(field);
        const minVal = ordersQuery[filterField + 'Min'];
        const maxVal = ordersQuery[filterField + 'Max'];
        if(!minVal && !maxVal)
          return;

        if(!filtersByTypes[field])
          filtersByTypes[field] = [];

        const fieldWhereObj = {
          type: tokenType,
          value: {}
        };

        if(minVal)
          fieldWhereObj.value[Op.gte] = minVal;

        if(maxVal)
          fieldWhereObj.value[Op.lte] = maxVal;

        filtersByTypes[field].push(fieldWhereObj)
      });
    });

    const orArray = [];

    _.forEach(filtersByTypes, (whereArr, field) => {
      whereArr.forEach(whereItem => {

        if(whereItem.type === 'building') {
          field = 'sumBuildingArea';
        }
        if(whereItem.type === 'land') {
          field = 'sumLandArea';
        }

        orArray.push({
          [field]: whereItem.value
        });
      });
    });

    if(orArray.length > 0) {
      allWheres[Op.and] = [{
        [Op.or]: orArray
      }];
    }

    if(ordersQuery.regions && ordersQuery.regions.length) {
      for(let i = 1; i <= 9; i++) {
        allWheres['regionLvl' + i] = {[Op.in]: ordersQuery.regions};
      }
    }

    if((ordersQuery.types && ordersQuery.types.length) || (ordersQuery.subtypes && ordersQuery.subtypes.length)) {
      let typeQueryRoot = { };

      let currentTypeQueryItem = typeQueryRoot;
      const allTypes = (ordersQuery.types || []).concat(ordersQuery.subtypes || []);
      allTypes.forEach((type, index) => {
        currentTypeQueryItem[Op.like] = `%|${type}|%`;
        if(index + 1 < allTypes.length) {
          currentTypeQueryItem[Op.and] = {};
          currentTypeQueryItem = currentTypeQueryItem[Op.and];
        }
      });
      allWheres['typesSubtypesArray'] = { [Op.and]: typeQueryRoot};
    }

    if(ordersQuery.tokensIds) {
      allWheres['tokenId'] = {[Op.in]: ordersQuery.tokensIds};
    }

    if(ordersQuery.features && ordersQuery.features.length) {
      let featureQueryRoot = { };

      let currentFeatureQueryItem = featureQueryRoot;
      ordersQuery.features.forEach((feature, index) => {
        currentFeatureQueryItem[Op.like] = `%|${feature}|%`;
        if(index + 1 < ordersQuery.features.length) {
          currentFeatureQueryItem[Op.and] = {};
          currentFeatureQueryItem = currentFeatureQueryItem[Op.and];
        }
      });
      allWheres['featureArray'] = { [Op.and]: featureQueryRoot};
    }

    ['currency', 'currencyAddress', 'contractAddress'].forEach((field) => {
      if(ordersQuery[field])
        allWheres[field] = { [Op.like]: ordersQuery[field]};
    });
    
    return allWheres;
  }
  
  saleOrdersQueryToFindAllParam(ordersQuery: SaleOrdersQuery) {
    const allWheres = this.prepareSaleOrdersWhere(ordersQuery);

    // console.log('allWheres', allWheres);
    
    // const queryOptions = {
    //   where: resultWhere(allWheres, ['ask', 'currency', 'currencyAddress']),
    //   include : {//[this.models.SaleOrder._conformInclude({
    //     association: 'spaceTokens',
    //     required: true,
    //     attributes: _.map(this.models.SpaceTokenGeoData.rawAttributes, (value, key) => key),
    //     where: resultWhere(allWheres, ['area', 'bedroomsCount', 'bathroomsCount', 'type', 'subtype', 'tokenId', 'regionLvl1', 'regionLvl2', 'regionLvl3', 'regionLvl4', 'regionLvl5', 'regionLvl6', 'regionLvl7', 'regionLvl8', 'regionLvl9'])
    //   }//, this.models.SaleOrder)]
    // };
    //
    // this.models.SaleOrder._conformOptions(queryOptions, this.models.SaleOrder);
    // this.models.SaleOrder._expandIncludeAll(queryOptions);
    // this.models.SaleOrder._validateIncludedElements(queryOptions, {
    //   [this.models.SaleOrder.getTableName(queryOptions)]: true
    // });
    //
    // let query = this.models.SaleOrder.sequelize.dialect.QueryGenerator.selectQuery(this.models.SaleOrder.getTableName(), queryOptions, this.models.SaleOrder);
    //
    // query = query.replace('ON `saleOrder`.`id` = `spaceTokens->spaceTokensOrders`.`saleOrderId` AND', 'ON `saleOrder`.`id` = `spaceTokens->spaceTokensOrders`.`saleOrderId` WHERE');
    //
    // console.log('query', query);
    //
    // this.sequelize.query(query).then(([results, metadata]) => {
    //   console.log('query result', results);
    // });

    //https://github.com/sequelize/sequelize/issues/10943
    //https://github.com/sequelize/sequelize/issues/4880
    //https://github.com/sequelize/sequelize/issues/10582
    
    const include: any = [{
      model: this.models.SpaceTokenGeoData,
      // association: this.models.SpaceTokenGeoData,
      // association: this.models.SpaceTokensOrders,
      as: 'spaceTokens',
      // include: 'SpaceTokenGeoData',
      // required: false
      // association: 'spaceTokens',
      // required: true,
      where: resultWhere(allWheres, ['tokenId', 'regionLvl1', 'regionLvl2', 'regionLvl3', 'regionLvl4', 'regionLvl5', 'regionLvl6', 'regionLvl7', 'regionLvl8', 'regionLvl9'])
    }];
    
    if(ordersQuery.buyer) {
      include.push({
        model: this.models.SaleOffer,
        as: 'offers',
        foreignKey: 'dbOrderId'
      });
      if(!allWheres[Op.and]) {
        allWheres[Op.and] = [];
      }
      const orArray: any = [{
        '$offers.buyer$': {[Op.like]: ordersQuery.buyer}
      }];
      if(ordersQuery.includeOrderIds && ordersQuery.includeOrderIds.length) {
        orArray.push({
          'orderId': {[Op.in]: ordersQuery.includeOrderIds}
        })
      }
      allWheres[Op.and].push({
        [Op.or]: orArray
      });
    }
    
    return {
      where: resultWhere(allWheres, ['ask', 'currency', 'currencyAddress', 'sumBedroomsCount', 'sumBathroomsCount', 'typesSubtypesArray', 'typesSubtypesArray', 'sumBuildingArea', 'sumLandArea', 'featureArray', 'contractAddress', Op.and]),
      include: include
    }
  }

  async filterSaleOrders(ordersQuery: SaleOrdersQuery) {
    if(ordersQuery.limit > 1000) {
      ordersQuery.limit = 1000;
    }
    
    const findAllParam: any = this.saleOrdersQueryToFindAllParam(ordersQuery);

    if(ordersQuery.includeOrderIds && ordersQuery.includeOrderIds.length) {
      delete findAllParam.limit;
      delete findAllParam.offset;
    } else {
      findAllParam.limit = ordersQuery.limit || 20;
      findAllParam.offset = ordersQuery.offset || 0;
    }

    const orders = await this.models.SaleOrder.findAll(findAllParam);
    
    findAllParam.where = { id: { [ Op.in]: orders.map(o => o.id) } };
    findAllParam.include.forEach(i => {
      i.where = null;
    });

    findAllParam.order = [
      [ordersQuery.sortBy || 'createdAt', ordersQuery.sortDir || 'DESC']
    ];

    if(ordersQuery.includeOrderIds && ordersQuery.includeOrderIds.length) {
      findAllParam.limit = ordersQuery.limit || 20;
      findAllParam.offset = ordersQuery.offset || 0;
    } else {
      delete findAllParam.limit;
      delete findAllParam.offset;
    }
    
    const saleOrders = await this.models.SaleOrder.findAll(findAllParam);

    return saleOrders.map(saleOrder => {
      saleOrder.spaceTokens = _.orderBy(saleOrder.spaceTokens, [(spaceToken) => {
        return spaceToken.spaceTokensOrders.position;
      }], ['asc']);
      return saleOrder;
    });
  }

  async filterSaleOrdersCount(ordersQuery: SaleOrdersQuery) {
    const findAllParam: any = this.saleOrdersQueryToFindAllParam(ordersQuery);

    findAllParam.distinct = true;
    
    return this.models.SaleOrder.count(findAllParam);
  }
  
  // =============================================================
  // Applications
  // =============================================================

  async getApplication(applicationId, contractAddress) {
    return this.models.Application.findOne({
      where: {applicationId, contractAddress},
      include: [{
        model: this.models.SpaceTokenGeoData,
        as: 'spaceTokens',
      }]
    });
  }

  async addOrUpdateApplication(application: IApplication) {
    let dbObject = await this.getApplication(application.applicationId, application.contractAddress);

    if(dbObject) {
      application.createdAtBlock = dbObject.createdAtBlock || application.createdAtBlock;
      await this.models.Application.update(application, {
        where: {applicationId: application.applicationId, contractAddress: application.contractAddress}
      });
    } else {
      return this.models.Application.create(application).catch(() => {});
    }
    return this.getApplication(application.applicationId, application.contractAddress);
  }
  
  applicationsQueryToFindAllParam(applicationsQuery: ApplicationsQuery) {
    const allWheres: any = {};

    ['feeAmount', 'bedroomsCount', 'bathroomsCount', 'area', 'totalOraclesReward', 'geohashesCount'].forEach(field => {
      const minVal = parseFloat(applicationsQuery[field + 'Min']);
      const maxVal = parseFloat(applicationsQuery[field + 'Max']);
      if(!minVal && !maxVal)
        return;

      const fieldWhereObj = {};
      if(minVal)
        fieldWhereObj[Op.gte] = minVal;

      if(maxVal)
        fieldWhereObj[Op.lte] = maxVal;

      allWheres[field] = fieldWhereObj;
    });

    if(applicationsQuery.regions && applicationsQuery.regions.length) {
      for(let i = 1; i <= 9; i++) {
        allWheres['regionLvl' + i] = {[Op.in]: applicationsQuery.regions};
      }
    }

    if(applicationsQuery.types && applicationsQuery.types.length) {
      allWheres['type'] = {[Op.in]: applicationsQuery.types};
    }
    if(applicationsQuery.subtypes && applicationsQuery.subtypes.length) {
      allWheres['subtype'] = {[Op.in]: applicationsQuery.subtypes};
    }

    if(applicationsQuery.tokensIds) {
      allWheres['tokenId'] = {[Op.in]: applicationsQuery.tokensIds};
    }

    ['feeCurrency', 'contractType', 'tokenType', 'feeCurrencyName'].forEach((field) => {
      if(applicationsQuery[field])
        allWheres[field] = applicationsQuery[field];
    });

    ['feeCurrencyAddress', 'applicantAddress', 'contractAddress'].forEach((field) => {
      if(applicationsQuery[field])
        allWheres[field] = {[Op.like]: applicationsQuery[field]};
    });

    if(applicationsQuery.availableRoles && applicationsQuery.availableRoles.length) {
      let availableRolesQuery = applicationsQuery.availableRoles.map((roleName) => ({
        [Op.like]: `%|${roleName}|%`
      }));

      if(applicationsQuery.oracleAddress) {
        allWheres[Op.or] = [{ [Op.and]: {'availableRolesArray': {[Op.or]: availableRolesQuery} } }, {oraclesArray: {[Op.like]: '%' + applicationsQuery.oracleAddress + '%'}}];
      } else {
        allWheres['availableRolesArray'] = { [Op.or]: availableRolesQuery};
      }
    }

    // console.log('allWheres', allWheres);

    // const queryOptions = {
    //   where: resultWhere(allWheres, ['ask', 'currency', 'currencyAddress']),
    //   include : {//[this.models.SaleOrder._conformInclude({
    //     association: 'spaceTokens',
    //     required: true,
    //     attributes: _.map(this.models.SpaceTokenGeoData.rawAttributes, (value, key) => key),
    //     where: resultWhere(allWheres, ['area', 'bedroomsCount', 'bathroomsCount', 'type', 'subtype', 'tokenId', 'regionLvl1', 'regionLvl2', 'regionLvl3', 'regionLvl4', 'regionLvl5', 'regionLvl6', 'regionLvl7', 'regionLvl8', 'regionLvl9'])
    //   }//, this.models.SaleOrder)]
    // };
    //
    // this.models.SaleOrder._conformOptions(queryOptions, this.models.SaleOrder);
    // this.models.SaleOrder._expandIncludeAll(queryOptions);
    // this.models.SaleOrder._validateIncludedElements(queryOptions, {
    //   [this.models.SaleOrder.getTableName(queryOptions)]: true
    // });
    //
    // let query = this.models.SaleOrder.sequelize.dialect.QueryGenerator.selectQuery(this.models.SaleOrder.getTableName(), queryOptions, this.models.SaleOrder);
    //
    // query = query.replace('ON `saleOrder`.`id` = `spaceTokens->spaceTokensOrders`.`saleOrderId` AND', 'ON `saleOrder`.`id` = `spaceTokens->spaceTokensOrders`.`saleOrderId` WHERE');
    //
    // console.log('query', query);
    //
    // this.sequelize.query(query).then(([results, metadata]) => {
    //   console.log('query result', results);
    // });

    //https://github.com/sequelize/sequelize/issues/10943
    //https://github.com/sequelize/sequelize/issues/4880
    //https://github.com/sequelize/sequelize/issues/10582

    return {
      where: _.extend(
        resultWhere(allWheres, ['feeAmount', 'feeCurrency', 'feeCurrencyName', 'feeCurrencyAddress', 'applicantAddress', 'contractAddress', 'contractType', 'availableRolesArray', 'totalOraclesReward', Op.or]),
        // resultWhere(allWheres, ['area', 'bedroomsCount', 'bathroomsCount', 'type', 'subtype', 'tokenId', 'regionLvl1', 'regionLvl2', 'regionLvl3', 'regionLvl4', 'regionLvl5', 'regionLvl6', 'regionLvl7', 'regionLvl8', 'regionLvl9'], 'spaceTokenGeoDatum')
      ),
      include : [{
        model: this.models.SpaceTokenGeoData,
        // association: this.models.SpaceTokenGeoData,
        // association: this.models.SpaceTokensOrders,
        as: 'spaceTokens',
        // include: 'SpaceTokenGeoData',
        // required: false
        // association: 'spaceTokens',
        // required: true,
        where: resultWhere(allWheres, ['area', 'bedroomsCount', 'bathroomsCount', 'type', 'subtype', 'tokenId', 'regionLvl1', 'regionLvl2', 'regionLvl3', 'regionLvl4', 'regionLvl5', 'regionLvl6', 'regionLvl7', 'regionLvl8', 'regionLvl9', 'tokenType', 'geohashesCount', Op.and])
      }]
    }
  }

  async filterApplications(applicationsQuery: ApplicationsQuery) {
    if(applicationsQuery.limit > 1000) {
      applicationsQuery.limit = 1000;
    }

    const findAllParam: any = this.applicationsQueryToFindAllParam(applicationsQuery);

    findAllParam.limit = applicationsQuery.limit || 20;
    findAllParam.offset = applicationsQuery.offset || 0;

    const applications = await this.models.Application.findAll(findAllParam);

    findAllParam.where = { id: { [ Op.in]: applications.map(o => o.id) } };
    findAllParam.include.forEach(i => {
      i.where = null;
    });

    findAllParam.order = [
      [applicationsQuery.sortBy || 'createdAt', applicationsQuery.sortDir || 'DESC']
    ];

    delete findAllParam.limit;
    delete findAllParam.offset;

    return this.models.Application.findAll(findAllParam);
  }

  async filterApplicationsCount(applicationsQuery: ApplicationsQuery) {
    const findAllParam: any = this.applicationsQueryToFindAllParam(applicationsQuery);

    findAllParam.distinct = true;

    return this.models.Application.count(findAllParam);
  }

  // =============================================================
  // SpaceTokens
  // =============================================================

  spaceTokensQueryToFindAllParam(spaceTokensQuery: SpaceTokensQuery) {
    const allWheres: any = {};

    ['bedroomsCount', 'bathroomsCount', 'area', 'geohashesCount'].forEach(field => {
      const minVal = parseFloat(spaceTokensQuery[field + 'Min']);
      const maxVal = parseFloat(spaceTokensQuery[field + 'Max']);
      if(!minVal && !maxVal)
        return;

      const fieldWhereObj = {};
      if(minVal)
        fieldWhereObj[Op.gte] = minVal;

      if(maxVal)
        fieldWhereObj[Op.lte] = maxVal;

      allWheres[field] = fieldWhereObj;
    });

    if(spaceTokensQuery.regions && spaceTokensQuery.regions.length) {
      for(let i = 1; i <= 9; i++) {
        allWheres['regionLvl' + i] = {[Op.in]: spaceTokensQuery.regions};
      }
    }

    if(spaceTokensQuery.types && spaceTokensQuery.types.length) {
      allWheres['type'] = {[Op.in]: spaceTokensQuery.types};
    }
    if(spaceTokensQuery.subtypes && spaceTokensQuery.subtypes.length) {
      allWheres['subtype'] = {[Op.in]: spaceTokensQuery.subtypes};
    }

    if(spaceTokensQuery.tokensIds) {
      allWheres['tokenId'] = {[Op.in]: spaceTokensQuery.tokensIds};
    }

    ['tokenType', 'inLocker'].forEach((field) => {
      if(!_.isUndefined(spaceTokensQuery[field]) && !_.isNull(spaceTokensQuery[field]))
        allWheres[field] = spaceTokensQuery[field];
    });
    
    ['owner', 'contractAddress'].forEach((field) => {
      if(spaceTokensQuery[field])
        allWheres[field] = {[Op.like]: spaceTokensQuery[field]};
    });

    // console.log('allWheres', allWheres);

    return {
      where: _.extend(
        resultWhere(allWheres, ['area', 'inLocker', 'bedroomsCount', 'bathroomsCount', 'type', 'subtype', 'tokenId', 'regionLvl1', 'regionLvl2', 'regionLvl3', 'regionLvl4', 'regionLvl5', 'regionLvl6', 'regionLvl7', 'regionLvl8', 'regionLvl9', 'tokenType', 'geohashesCount', 'owner', 'contractAddress', Op.and]),
        // resultWhere(allWheres, ['area', 'bedroomsCount', 'bathroomsCount', 'type', 'subtype', 'tokenId', 'regionLvl1', 'regionLvl2', 'regionLvl3', 'regionLvl4', 'regionLvl5', 'regionLvl6', 'regionLvl7', 'regionLvl8', 'regionLvl9'], 'spaceTokenGeoDatum')
      )
    }
  }

  async filterSpaceTokens(spaceTokensQuery: SpaceTokensQuery) {
    if(spaceTokensQuery.limit > 1000) {
      spaceTokensQuery.limit = 1000;
    }

    const findAllParam: any = this.spaceTokensQueryToFindAllParam(spaceTokensQuery);

    findAllParam.limit = spaceTokensQuery.limit || 20;
    findAllParam.offset = spaceTokensQuery.offset || 0;

    findAllParam.order = [
      [spaceTokensQuery.sortBy || 'createdAt', spaceTokensQuery.sortDir || 'DESC']
    ];
    
    return this.models.SpaceTokenGeoData.findAll(findAllParam);
  }

  async filterSpaceTokensCount(spaceTokensQuery: SpaceTokensQuery) {
    const findAllParam: any = this.spaceTokensQueryToFindAllParam(spaceTokensQuery);

    return this.models.SpaceTokenGeoData.count(findAllParam);
  }
  
  async getSpaceToken(tokenId, contractAddress) {
    return this.models.SpaceTokenGeoData.findOne({
      where: { tokenId, contractAddress }
    });
  }

  // =============================================================
  // SaleOffers
  // =============================================================

  firstSaleOfferQueue = {};
  
  async addOrUpdateSaleOffer(saleOffer: ISaleOffer) {
    let dbObject = await this.getSaleOffer(saleOffer.orderId, saleOffer.buyer, saleOffer.contractAddress);
    
    const saleOfferParams = {orderId: saleOffer.orderId, buyer: {[Op.like]: saleOffer.buyer}, contractAddress: {[Op.like]: saleOffer.contractAddress}};
    if(dbObject) {
      saleOffer.createdAtBlock = dbObject.createdAtBlock || saleOffer.createdAtBlock;
      await this.models.SaleOffer.update(saleOffer, {
        where: saleOfferParams
      });
    } else {
      await this.models.SaleOffer.create(saleOffer).catch(() => {
        return this.models.SaleOffer.update(saleOffer, {
          where: saleOfferParams
        });
      });
    }

    if(!this.firstSaleOfferQueue[saleOffer.contractAddress]) {
      this.firstSaleOfferQueue[saleOffer.contractAddress] = {};
    }
    
    if(!this.firstSaleOfferQueue[saleOffer.contractAddress][saleOffer.orderId]) {
      this.firstSaleOfferQueue[saleOffer.contractAddress][saleOffer.orderId] = true;

      setTimeout(async () => {
        const firstSaleOffer = await this.models.SaleOffer.findOne({
          where: {orderId: saleOffer.orderId, contractAddress: {[Op.like]: saleOffer.contractAddress}},
          order: [ ['createdAtBlock', 'ASC'] ]
        });

        console.log('firstSaleOffer', firstSaleOffer.id, firstSaleOffer.orderId);

        await this.models.SaleOffer.update({isFirstOffer: false}, { where: {orderId: saleOffer.orderId, contractAddress: {[Op.like]: saleOffer.contractAddress}} });

        await this.models.SaleOffer.update({isFirstOffer: true}, { where: {id: firstSaleOffer.id} });

        this.firstSaleOfferQueue[saleOffer.contractAddress][saleOffer.orderId] = false;
      }, 1000);
    }
    
    return this.getSaleOffer(saleOffer.orderId, saleOffer.buyer, saleOffer.contractAddress);
  }

  saleOffersQueryToFindAllParam(saleOffersQuery: SaleOffersQuery) {
    let allWheres: any = {};

    ['ask', 'bid'].forEach(field => {
      const minVal = parseFloat(saleOffersQuery[field + 'Min']);
      const maxVal = parseFloat(saleOffersQuery[field + 'Max']);
      if(!minVal && !maxVal)
        return;

      const fieldWhereObj = {};
      if(minVal)
        fieldWhereObj[Op.gte] = minVal;

      if(maxVal)
        fieldWhereObj[Op.lte] = maxVal;

      allWheres[field] = fieldWhereObj;
    });

    ['status', 'orderId'].forEach((field) => {
      if(!_.isUndefined(saleOffersQuery[field]) && !_.isNull(saleOffersQuery[field]))
        allWheres[field] = {[Op.eq]: saleOffersQuery[field]};
    });

    ['buyer', 'seller', 'contractAddress'].forEach((field) => {
      if(saleOffersQuery[field])
        allWheres[field] = {[Op.like]: saleOffersQuery[field]};
    });

    if(saleOffersQuery.excludeOrderIds && saleOffersQuery.excludeOrderIds.length) {
      if(!allWheres['orderId']) {
        allWheres['orderId'] = {};
      }
      allWheres['orderId'][Op.notIn] = saleOffersQuery.excludeOrderIds;
    }
    
    let additionalWhere = {};
    if(saleOffersQuery.includeOrderIds && saleOffersQuery.includeOrderIds.length) {
      const orArray = [];
      if(allWheres['buyer']) {
        orArray.push({ 'buyer': allWheres['buyer'] });
        delete allWheres['buyer'];
      }
      orArray.push({'orderId': {[Op.in]: saleOffersQuery.includeOrderIds}, isFirstOffer: true});
      additionalWhere[Op.or] = orArray;
    }

    allWheres = _.extend(this.prepareSaleOrdersWhere(saleOffersQuery), allWheres);
    
    const offersWhere = resultWhere(allWheres, ['buyer', 'seller', 'contractAddress', 'status', 'orderId', 'ask', 'bid'])
    
    if(additionalWhere[Op.or]) {
      offersWhere[Op.and] = additionalWhere;
    }
    
    return {
      where: offersWhere,
      include: [{
        association: 'order',
        where: resultWhere(allWheres, ['ask', 'currency', 'currencyAddress', 'sumBedroomsCount', 'sumBathroomsCount', 'typesSubtypesArray', 'typesSubtypesArray', 'sumBuildingArea', 'sumLandArea', 'featureArray', 'contractAddress', Op.and]),
        include: [{
          model: this.models.SpaceTokenGeoData,
          as: 'spaceTokens',
          where: resultWhere(allWheres, ['tokenId', 'regionLvl1', 'regionLvl2', 'regionLvl3', 'regionLvl4', 'regionLvl5', 'regionLvl6', 'regionLvl7', 'regionLvl8', 'regionLvl9'])
        }]
      }]
    }
  }

  async filterSaleOffers(saleOffersQuery: SaleOffersQuery) {
    if(saleOffersQuery.limit > 1000) {
      saleOffersQuery.limit = 1000;
    }

    const findAllParam: any = this.saleOffersQueryToFindAllParam(saleOffersQuery);

    findAllParam.limit = saleOffersQuery.limit || 20;
    findAllParam.offset = saleOffersQuery.offset || 0;

    findAllParam.order = [
      [saleOffersQuery.sortBy || 'createdAt', saleOffersQuery.sortDir || 'DESC']
    ];
    
    if(!saleOffersQuery.includeOrders) {
      delete findAllParam.include;
    }

    let result = await this.models.SaleOffer.findAll(findAllParam);
    
    // if(saleOffersQuery.includeOrderIds && saleOffersQuery.includeOrderIds.length) {
    //  
    //   const orderIds = _.uniq(result.map(o => o.orderId).concat(saleOffersQuery.includeOrderIds));
    //  
    //   // console.log('orderIds', orderIds);
    //   findAllParam.where = { orderId: { [ Op.in]: orderIds }, isFirstOffer: true };
    //   if(saleOffersQuery.contractAddress) {
    //     findAllParam.where.contractAddress = {[Op.like]: saleOffersQuery.contractAddress};
    //   }
    //   if(findAllParam.include) {
    //     findAllParam.include.forEach(i => {
    //       i.where = null;
    //       if(i.include) {
    //         i.include.forEach(ii => {
    //           ii.where = null;
    //         });
    //       }
    //     });
    //   }
    //
    //   findAllParam.order = [
    //     [saleOffersQuery.sortBy || 'createdAt', saleOffersQuery.sortDir || 'DESC']
    //   ];
    //
    //   delete findAllParam.limit;
    //   delete findAllParam.offset;
    //
    //   result = await this.models.SaleOffer.findAll(findAllParam);
    // }
    return result;
  }

  async filterSaleOffersCount(saleOffersQuery: SaleOffersQuery) {
    const findAllParam: any = this.saleOffersQueryToFindAllParam(saleOffersQuery);

    return this.models.SaleOffer.count(findAllParam);
  }

  async getSaleOffer(orderId, buyer, contractAddress) {
    return this.models.SaleOffer.findOne({
      where: { orderId, buyer: {[Op.like]: buyer}, contractAddress: {[Op.like]: contractAddress} },
      include: [{ association: 'order', include: [{association: 'spaceTokens'}]}]
    });
  }
  
  // =============================================================
  // Values
  // =============================================================

  async getValue(key: string) {
    const valueObj = await this.models.Value.findOne({where: {key}});
    return valueObj ? valueObj.content : null;
  }

  async setValue(key: string, content: string) {
    const valueObj = await this.models.Value.findOne({where: {key}});
    if (valueObj) {
      return valueObj.update({content}, {where: {key}})
    } else {
      return this.models.Value.create({key, content});
    }
  }

  async clearValue(key: string) {
    return this.models.Value.destroy({where: {key}});
  }
}

function resultWhere(sourceWhere, fields, relation?) {
  const res = {};
  _.forEach(fields, (key) => {
    const value = sourceWhere[key];
    // console.log('key', key);
    if(_.isUndefined(value))
      return;

    if(relation) {
      key = `$${relation}.${key}$`;
    }
    res[key] = value;
  });
  // console.log('resultWhere', res);
  return res;
}

/*
 * Copyright ©️ 2019 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import IExplorerDatabase, {
  CommunityApprovedQuery,
  CommunityMeetingQuery,
  CommunityMemberQuery,
  CommunityMemberTokensQuery,
  CommunityProposalQuery,
  CommunityRuleQuery,
  CommunityTokensQuery,
  CommunityVotingQuery,
  ICommunity,
  IPrivatePropertyRegistry,
  ISaleOffer,
  PprMemberQuery,
  PrivatePropertyProposalQuery,
  PropertyLockersQuery,
  SaleOffersQuery,
  TokenizableMemberQuery
} from "../../../database/interface";
import {
  default as IExplorerGeoDataService,
  FilterApplicationsGeoQuery, FilterCommunityGeoQuery, FilterPrivatePropertyRegistryGeoQuery,
  FilterSaleOrdersGeoQuery,
  FilterSpaceTokensGeoQuery
} from "../interface";
import {
  IExplorerCommunityMintEvent,
  IExplorerGeoDataEvent, IExplorerNewApplicationEvent,
  IExplorerSaleOrderEvent
} from "../../interfaces";
import IExplorerChainService, {ChainServiceEvents} from "../../chainService/interface";
import IExplorerGeohashService from "../../geohashService/interface";

const _ = require("lodash");
const pIteration = require("p-iteration");
const galtUtils = require('@galtproject/utils');

const {GeesomeClient} = require('geesome-libs/src/GeesomeClient');
const {isIpldHash} = require('geesome-libs/src/ipfsHelper');
const log = require('../../logService');

const {bytes32ToIpfsHash, tokenData} = require('@galtproject/utils');

module.exports = async (database: IExplorerDatabase, geohashService: IExplorerGeohashService, chainService: IExplorerChainService) => {
  const geesome = new GeesomeClient({
    server: 'https://geesome-node.galtproject.io:7722',
    apiKey: "MCYK5V1-15Q48EQ-QSEKRWX-1ZS0SPW"
  });

  await geesome.init();
  // await geesome.initRuntimeIpfsNode();

  return new ExplorerGeoDataV1Service(database, geohashService, chainService, geesome);
};

class ExplorerGeoDataV1Service implements IExplorerGeoDataService {
  database: IExplorerDatabase;
  chainService: IExplorerChainService;
  geohashService: IExplorerGeohashService;
  geesome;

  constructor(_database, _geohashService, _chainService, _geesome) {
    this.database = _database;
    this.geesome = _geesome;
    this.geohashService = _geohashService;
    this.chainService = _chainService;
  }

  // =============================================================
  // Space Tokens
  // =============================================================

  async handleChangeSpaceTokenDataEvent(spaceGeoDataAddress, event: IExplorerGeoDataEvent) {
    // console.log('handleChangeSpaceTokenDataEvent', event.blockNumber);
    let tokenId: string = event.returnValues['id'] || event.returnValues['_tokenId'] || event.returnValues['tokenId'] || event.returnValues['_spaceTokenId'] || event.returnValues['spaceTokenId'] || event.returnValues['privatePropertyId'];
    await this.saveSpaceTokenById(spaceGeoDataAddress, tokenId, {createdAtBlock: event.blockNumber, blockNumber: event.blockNumber});
  };

  async saveSpaceTokenById(contractAddress, tokenId, additionalData: any = {}) {
    log('getSpaceTokenData', contractAddress, tokenId);

    const existToken = await this.database.getSpaceTokenGeoData(tokenId, contractAddress);
    // console.log('existToken', existToken && existToken.updatedAtBlock, additionalData.blockNumber);
    if(existToken && existToken.updatedAtBlock >= additionalData.blockNumber) {
      delete additionalData.createdAtBlock;
      delete additionalData.blockNumber;
      return this.database.addOrUpdateGeoData({tokenId, contractAddress, ...additionalData});
    }

    const geoData = await this.chainService.getSpaceTokenData(contractAddress, tokenId);
    const owner = await this.chainService.getSpaceTokenOwner(contractAddress, tokenId).catch(() => null);

    const innerHeight = geoData.highestPoint - _.orderBy(geoData.heightsContour, [(h) => h], ['asc'])[0];

    if(!owner || owner === '0x0000000000000000000000000000000000000000') {
      log('owner is null, token not exists');
      await this.database.deleteGeoData(tokenId, contractAddress);
      return this.database.deleteContour(tokenId, contractAddress);
    }

    log('saveSpaceTokenById', tokenId, owner);

    let level;
    if (geoData.humanAddress) {
      const {floor} = tokenData.getHumanAddressFromContractString(geoData.humanAddress);
      level = floor;
    }

    if (level || geoData.spaceTokenType) {
      await this.database.addOrUpdateContour(geoData.geohashContour, tokenId, contractAddress, level, geoData.spaceTokenType);
    }

    let lockerType = await this.chainService.getLockerType(owner);

    let lockerOwners = [];
    let lockerOwnersReputation;
    let lockerOwnersShares;
    let lockerTotalShare;

    if (lockerType) {
      lockerType = this.chainService.hexToString(lockerType);
      // log('lockerType', lockerType);

      const lockerContract = await this.chainService.getLockerContract(owner);
      if(lockerType === "REPUTATION" && lockerContract.methods.getLockerInfo) {
        const lockerInfo = await lockerContract.methods.getLockerInfo().call({});
        lockerOwners = lockerInfo._owners;
        lockerOwnersReputation = lockerInfo._ownersReputation;
        lockerOwnersShares = lockerInfo._shares;
        lockerTotalShare = lockerInfo._totalShares;
      } else {
        const contract = await this.chainService.getPropertyRegistryContract(contractAddress);
        const transferEvents = await this.chainService.getEventsFromBlock(
          contract,
          ChainServiceEvents.SpaceTokenTransfer,
          0,
          {tokenId}
        );
        const lastTransfer = _.last(transferEvents);
        if (lastTransfer) {
          lockerOwners = [lastTransfer.returnValues.from];
        }
      }

      log('lockerOwners', lockerOwners);
    }

    const dataLink = geoData.dataLink.replace('config_address=', '');

    return this.saveSpaceTokenByDataLink(contractAddress, dataLink, {
      tokenId: tokenId,
      owner: lockerOwners.length > 1 ? 'shared' : lockerOwners[0] || owner,
      locker: lockerOwners.length ? owner : null,
      inLocker: !!lockerOwners.length,
      innerHeight,
      level,
      lockerType,
      lockerOwners,
      lockerOwnersReputation,
      lockerOwnersShares,
      lockerTotalShare,
      ...geoData,
      ...additionalData
    })
  }

  async saveSpaceTokenByDataLink(contractAddress, dataLink, geoData) {
    let geoDataToSave = {
      contractAddress,
      isPpr: !this.chainService.spaceGeoData || contractAddress.toLowerCase() !== this.chainService.spaceGeoData._address.toLowerCase(),
      level: geoData.level || '0',
      levelNumber: parseFloat((geoData.level || '0').toString().match(/\d+/g)[0]),
      tokenType: geoData.spaceTokenType,
      dataLink: dataLink,
      contractContourJson: JSON.stringify(geoData.contractContour),
      geohashContourJson: JSON.stringify(geoData.geohashContour),
      geohashesCount: geoData.geohashContour.length,
      heightsContourJson: JSON.stringify(geoData.heightsContour),
      ...geoData
    };

    if (!isIpldHash(dataLink)) {
      return this.addOrUpdateGeoData(geoDataToSave);
    }

    const spaceData = (await this.geesome.getObject(dataLink).catch(() => null)) || {};
    let {details, floorPlans, photos, models, modelIpfsHash, offset, viewOptions, supportFields} = spaceData;

    if (!details) {
      details = spaceData.data;
    }

    if (!floorPlans) {
      floorPlans = [];
    }

    if (!details) {
      return this.addOrUpdateGeoData(geoDataToSave);
    }

    // console.log('geoData.contractContour', geoData.contractContour);
    const latLonContour = geoData.contractContour.map(cPoint => galtUtils.contractPoint.decodeToLatLonHeight(cPoint));
    // console.log('latLonContour', latLonContour.map(({lat, lon}) => [lat, lon]));
    const latLonCenter = galtUtils.coordinates.polygonCenter(latLonContour.map(({lat, lon}) => [lat, lon]));

    let latLonShiftedContour;
    let latLonShiftedCenter;
    let contractShiftedContour;
    if(offset) {
      let {mapbox} = offset;
      latLonShiftedContour = galtUtils.coordinates.polygonShift(
        latLonContour.map(({lat, lon}) => [lat, lon]),
        mapbox.x, mapbox.y, mapbox.angle || 0, mapbox.scaleX || 1, mapbox.scaleY || 1
      );
      contractShiftedContour = latLonShiftedContour.map(latLon => {
        return galtUtils.contractPoint.encodeFromLatLng(latLon[0], latLon[1]);
      });
      latLonShiftedCenter = galtUtils.coordinates.polygonCenter(latLonShiftedContour);
    }

    let latLonBaseContour;
    let latLonShiftedBaseContour;

    if(viewOptions && viewOptions.showBaseContour && supportFields && supportFields.baseContour) {
      latLonBaseContour = supportFields.baseContour.map(cPoint => galtUtils.contractPoint.decodeToLatLonHeight(cPoint));
      if(offset) {
        let {mapbox} = offset;
        latLonShiftedBaseContour = galtUtils.coordinates.polygonShift(
          latLonBaseContour.map(({lat, lon}) => [lat, lon]),
          mapbox.x, mapbox.y, mapbox.angle || 0, mapbox.scaleX || 1, mapbox.scaleY || 1
        );
      }
    }

    let imageHash;
    if (photos && photos[0]) {
      const link = await this.geesome.getContentLink(photos[0], 'large').catch(() => '');
      imageHash = _.last(_.trim(link, '/').split('/'))
    }

    if (!modelIpfsHash && models && models[0]) {
      const link = await this.geesome.getContentLink(models[0]).catch(() => '');
      modelIpfsHash = _.last(_.trim(link, '/').split('/'))
    }

    const ppr = await this.getPrivatePropertyRegistry(contractAddress);
    let pprId;
    if (ppr) {
      pprId = ppr.id;
    }

    const spaceToken = await this.database.getSpaceToken(geoDataToSave.tokenId, contractAddress);
    let communitiesCount = 0;

    if(spaceToken) {
      communitiesCount = await this.database.getTokenCommunitiesCount(spaceToken);
    }

    // console.log('geoData', geoData);
    const owners = (geoData.lockerOwners && geoData.lockerOwners.length > 1 ? geoData.lockerOwners : [geoData.owner]).map(o => o.toLowerCase());

    geoDataToSave = _.extend({
      pprId,
      type: details.type,
      subtype: details.subtype,
      purpose: details.purpose,
      imageHash,
      modelIpfsHash,
      photosCount: (photos || []).length,
      floorPlansCount: (floorPlans || []).length,
      bathroomsCount: details.bathrooms,
      bedroomsCount: details.bedrooms,
      yearBuilt: details.yearBuilt,
      dataJson: JSON.stringify(spaceData),
      ownersJson: JSON.stringify(owners),
      communitiesCount,

      offsetJson: offset ? JSON.stringify(offset) : null,
      latLonBaseContourJson: latLonBaseContour ? JSON.stringify(latLonBaseContour) : null,
      contractShiftedContourJson: contractShiftedContour ? JSON.stringify(contractShiftedContour) : null,
      latLonShiftedBaseContourJson: latLonShiftedBaseContour ? JSON.stringify(latLonShiftedBaseContour) : null,
      latLonContourJson: latLonContour ? JSON.stringify(latLonContour) : null,
      latLonShiftedContourJson: latLonShiftedContour ? JSON.stringify(latLonShiftedContour) : null,
      latLonCenterJson: latLonCenter ? JSON.stringify(latLonCenter) : null,
      latLonShiftedCenterJson: latLonShiftedCenter ? JSON.stringify(latLonShiftedCenter) : null,

      ledgerIdentifier: details.ledgerIdentifier || geoData.ledgerIdentifier,
      featureArray: details.features ? '|' + details.features.join('|') + '|' : ''
    }, geoDataToSave);

    await this.addOrUpdateGeoData(geoDataToSave);

    await this.database.setTokenOwners(geoDataToSave.tokenId, contractAddress, owners);

    if (geoData.lockerOwners.length) {
      const lockerContract = await this.chainService.getLockerContract(geoDataToSave.locker);
      if(geoDataToSave.lockerType === "REPUTATION" && lockerContract.methods.getLockerInfo) {
        const communityAddresses = await lockerContract.methods.getTras().call({});
        await pIteration.forEachSeries(communityAddresses, async (communityAddress) => {
          const community = await this.database.getCommunity(communityAddress);
          if(!community) {
            return;
          }
          return this.updateCommunityTokenOwners(
            community,
            await this.database.getSpaceTokenGeoData(geoDataToSave.tokenId, geoDataToSave.contractAddress)
          );
        })
      }
    }
  }

  async addOrUpdateGeoData(geoDataToSave) {
    if (geoDataToSave.owner) {
      if (geoDataToSave.isPpr) {
        const ppr = await this.database.getPrivatePropertyRegistry(geoDataToSave.contractAddress);
        if (ppr) {
          await this.database.addOrUpdatePprMember(ppr, {
            address: geoDataToSave.owner
          });
        }
      }
      return this.database.addOrUpdateGeoData(geoDataToSave).catch((e) => {
        console.warn('WARN addOrUpdateGeoData', e);
        return this.database.addOrUpdateGeoData(geoDataToSave);
      });
    } else {
      if (geoDataToSave.isPpr) {
        await this.deletePprMember(geoDataToSave.contractAddress, geoDataToSave.owner);
      }
      await this.database.deleteGeoData(geoDataToSave.tokenId, geoDataToSave.contractAddress);
      return this.database.deleteContour(geoDataToSave.tokenId, geoDataToSave.contractAddress);
    }
  }

  async deletePprMember(registryAddress, memberAddress) {
    const pprMember = await this.database.getPprMember(registryAddress, memberAddress);
    if (pprMember) {
      await pprMember.destroy();
    }
  }

  async filterSpaceTokens(filterQuery: FilterSpaceTokensGeoQuery) {
    if (filterQuery.surroundingsGeohashBox && filterQuery.surroundingsGeohashBox.length) {
      filterQuery.tokensIds = (await this.geohashService.getTokenIdsByParentGeohashArray(filterQuery.surroundingsGeohashBox, filterQuery.contractAddress)).map(i => i.tokenId.toString());
    }
    return {
      list: await this.database.filterSpaceTokens(filterQuery),
      total: await this.database.filterSpaceTokensCount(filterQuery)
    };
  }

  async getSpaceTokenById(tokenId, contractAddress) {
    return this.database.getSpaceToken(tokenId, contractAddress);
  }

  async getSpaceTokenMetadataById(tokenId, contractAddress) {
    const spaceGeoData = await this.database.getSpaceToken(tokenId, contractAddress);

    const ipldData = JSON.parse(spaceGeoData.dataJson);
    let attributes = [];

    attributes.push({
      trait_type: 'type',
      value: spaceGeoData.type
    });
    attributes.push({
      trait_type: 'subtype',
      value: spaceGeoData.subtype
    });

    attributes.push({
      trait_type: 'area',
      value: spaceGeoData.area
    });

    let description = '';

    if (ipldData.details) {
      attributes = attributes.concat(ipldData.details.features.map(f => ({trait_type: 'feature', value: f})));

      description = ipldData.details.description;
      if (ipldData.details.legalDescription) {
        description += '\n\n' + ipldData.details.legalDescription;
      }
    }

    let name = '';

    const humanAddress = tokenData.getHumanAddressFromIpld(ipldData);
    if (humanAddress) {
      name = humanAddress.country || '';

      if (name && humanAddress.region) {
        name += ', ' + humanAddress.region;
      }

      if (name && humanAddress.city) {
        name += ', ' + humanAddress.city;
      }

      if (name && humanAddress.street) {
        name += ', ' + humanAddress.street;
      }

      if (name && humanAddress.buildingNumber) {
        name += ', ' + humanAddress.buildingNumber;
      }

      if (spaceGeoData.tokenType === 'room') {
        if (humanAddress.floor)
          name += ', Floor ' + humanAddress.floor;

        if (humanAddress.roomNumber)
          name += ', ' + humanAddress.roomNumber;
      }
    } else {
      name = spaceGeoData.ledgerIdentifier || 'Token #' + spaceGeoData.tokenId;
    }

    return {
      name,
      description,
      attributes,
      image: await this.geesome.getContentLink(spaceGeoData.imageHash).catch(() => null),
      external_url: `https://app.galtproject.io/#/${_.first(this.chainService.configFile.split('.'))}/property/token/${tokenId}?contractAddress=${contractAddress}`
    };
  }

  // =============================================================
  // Sale Orders
  // =============================================================

  async handleSaleOrderEvent(event: IExplorerSaleOrderEvent) {
    let orderId: string = event.returnValues.orderId;

    const chainOrder = await this.chainService.getSaleOrder(event.contractAddress, orderId);

    let dbSpaceTokens = (await pIteration.map(chainOrder.details.tokenIds, async (id, position) => {
      const geoDataAddress = chainOrder.details.propertyToken || this.chainService.spaceGeoData._address;
      const spaceToken = await this.database.getSpaceTokenGeoData(id, geoDataAddress);
      if (spaceToken) {
        spaceToken.spaceTokensOrders = {position};
      }
      return spaceToken;
    })).filter(t => t);

    dbSpaceTokens = _.uniqBy(dbSpaceTokens, (s) => s.id);

    let orderData: any = {};
    let dataLink = chainOrder.details.dataAddress || chainOrder.details.dataLink;
    if (dataLink) {
      orderData = await this.geesome.getObject(dataLink).catch(() => ({}));
    }

    let allFeatures = [];
    dbSpaceTokens.forEach(token => {
      try {
        const spaceData = JSON.parse(token.dataJson);
        if (spaceData) {
          allFeatures = allFeatures.concat((spaceData.details || {}).features || []);
        }
      } catch (e) {
      }
    });

    allFeatures = _.uniq(allFeatures);

    let allTypesSubTypes = [];
    dbSpaceTokens.forEach(token => {
      allTypesSubTypes = allTypesSubTypes.concat([token.type, token.subtype].filter(s => s));
    });

    allTypesSubTypes = _.uniq(allTypesSubTypes);

    const currency = chainOrder.escrowCurrency.toString(10) == '0' ? 'eth' : 'erc20';
    let currencyName = 'ETH';
    if (currency === 'erc20') {
      currencyName = await this.chainService.getContractSymbol(chainOrder.tokenContract);
    }

    log(orderId, 'tokens types', dbSpaceTokens.map(s => [s.tokenType, s.area]));

    log('chainOrder.statusName', chainOrder.statusName);

    const dbOrder = await this.database.addOrUpdateSaleOrder({
      orderId,
      currency,
      currencyName,
      statusName: chainOrder.statusName,
      contractAddress: event.contractAddress,
      isPpr: !this.chainService.propertyMarket || event.contractAddress.toLowerCase() !== this.chainService.propertyMarket._address.toLowerCase(),
      currencyAddress: chainOrder.tokenContract,
      ask: chainOrder.ask,
      seller: chainOrder.seller,
      description: orderData.description,
      dataJson: JSON.stringify(orderData),
      lastBuyer: chainOrder.lastBuyer,
      sumBathroomsCount: _.sumBy(dbSpaceTokens, 'bathroomsCount'),
      sumBedroomsCount: _.sumBy(dbSpaceTokens, 'bedroomsCount'),
      sumLandArea: _.sumBy(_.filter(dbSpaceTokens, {tokenType: 'land'}), 'area'),
      sumBuildingArea: _.sumBy(_.filter(dbSpaceTokens, {tokenType: 'building'}), 'area'),
      featureArray: '|' + allFeatures.join('|') + '|',
      typesSubtypesArray: '|' + allTypesSubTypes.join('|') + '|',
      createdAtBlock: event.blockNumber,
      updatedAtBlock: event.blockNumber
    });

    log('order saved', dbOrder.orderId, event.contractAddress);

    await dbOrder.setSpaceTokens(dbSpaceTokens).catch(() => {/*already set */
    });
  };

  async filterOrders(filterQuery: FilterSaleOrdersGeoQuery) {
    if (filterQuery.surroundingsGeohashBox && filterQuery.surroundingsGeohashBox.length) {
      filterQuery.tokensIds = (await this.geohashService.getTokenIdsByParentGeohashArray(filterQuery.surroundingsGeohashBox)).map(i => i.tokenId.toString());
    }
    return {
      list: await this.database.filterSaleOrders(filterQuery),
      total: await this.database.filterSaleOrdersCount(filterQuery)
    };
  }

  async getOrderById(orderId, contractAddress) {
    return this.database.getSaleOrder(orderId, contractAddress);
  }

  // =============================================================
  // Sale Offers
  // =============================================================

  async handleSaleOfferEvent(event) {
    let {orderId, buyer} = event.returnValues;
    if (!orderId) {
      orderId = event.returnValues.saleOrderId;
    }

    const saleOffer = await this.chainService.getSaleOffer(event.contractAddress, orderId, buyer);

    const dbOrder = await this.database.getSaleOrder(orderId, event.contractAddress);

    const saleOfferData: ISaleOffer = {
      contractAddress: event.contractAddress,
      orderId: orderId,
      buyer,
      seller: dbOrder.seller,
      ask: saleOffer.ask,
      bid: saleOffer.bid,
      lastOfferAskAt: new Date().setTime(saleOffer.lastAskAt),
      lastOfferBidAt: new Date().setTime(saleOffer.lastBidAt),
      createdOfferAt: new Date().setTime(saleOffer.createdAt),
      dbOrderId: dbOrder ? dbOrder.id : null
    };

    await this.database.addOrUpdateSaleOffer(saleOfferData);
  }

  async getSaleOfferById(orderId, buyer, contractAddress) {
    return this.database.getSaleOffer(orderId, buyer, contractAddress);
  }

  async filterSaleOffers(filterQuery: SaleOffersQuery) {
    return {
      list: await this.database.filterSaleOffers(filterQuery),
      total: await this.database.filterSaleOffersCount(filterQuery)
    };
  }

  // =============================================================
  // Applications
  // =============================================================

  async handleNewApplicationEvent(event: IExplorerNewApplicationEvent) {
    const {contractAddress} = event;
    const {applicationId, applicant} = event.returnValues;

    const spaceGeoDataAddress = this.chainService.spaceGeoData._address;

    const [application, applicationDetails] = await Promise.all([
      this.chainService.getNewPropertyApplication(applicationId),
      this.chainService.getNewPropertyApplicationDetails(applicationId)
    ]);

    const oracles = [];
    const availableRoles = [];
    let totalOraclesReward = 0;

    await pIteration.map(application.assignedOracleTypes, async (roleName) => {
      const roleOracle = await this.chainService.getNewPropertyApplicationOracle(applicationId, roleName);
      if (roleOracle.status === 'pending') {
        availableRoles.push(roleName);
      }
      if (roleOracle.address) {
        oracles.push(roleOracle.address);
      }
      totalOraclesReward += roleOracle.reward;
    });

    const applicationData = {
      applicationId,
      applicantAddress: applicant,
      credentialsHash: applicationDetails.credentialsHash,
      feeCurrency: application.currency == '0' ? 'eth' : 'erc20',
      //TODO: get currency address of GALT
      feeCurrencyAddress: '',
      feeCurrencyName: application.currency == '0' ? 'ETH' : 'GALT',
      statusName: application.statusName,
      contractType: 'newPropertyManager',
      contractAddress,
      //TODO: fee amount
      feeAmount: 0,
      rolesArray: '|' + application.assignedOracleTypes.join('|') + '|',
      availableRolesArray: '|' + availableRoles.join('|') + '|',
      oraclesArray: '|' + oracles.join('|') + '|',
      dataJson: '',
      createdAtBlock: event.blockNumber,
      updatedAtBlock: event.blockNumber,
      totalOraclesReward
    };

    let dbApplication = await this.database.addOrUpdateApplication(applicationData);

    if (!dbApplication) {
      dbApplication = await this.database.addOrUpdateApplication(applicationData);
    }

    if (parseInt(application.tokenId)) {
      console.log('handleNewApplicationEvent', event.blockNumber);
      const spaceToken = await this.saveSpaceTokenById(spaceGeoDataAddress, application.tokenId, {
        createdAtBlock: event.blockNumber,
        blockNumber: event.blockNumber,
        ...applicationDetails
      });
      if (spaceToken) {
        await dbApplication.addSpaceTokens([spaceToken]);
      }
    } else {
      const spaceToken = await this.saveSpaceTokenByDataLink(spaceGeoDataAddress, applicationDetails.dataLink, {
        tokenId: application.tokenId || 'application_' + contractAddress + '_' + applicationId,
        createdAtBlock: event.blockNumber,
        ...applicationDetails
      });
      if (spaceToken) {
        await dbApplication.addSpaceTokens([spaceToken]);
      }
    }
    // log('spaceToken', spaceToken);

  };

  async filterApplications(filterQuery: FilterApplicationsGeoQuery) {
    if (filterQuery.surroundingsGeohashBox && filterQuery.surroundingsGeohashBox.length) {
      filterQuery.tokensIds = (await this.geohashService.getTokenIdsByParentGeohashArray(filterQuery.surroundingsGeohashBox)).map(i => i.tokenId.toString());
    }
    return {
      list: await this.database.filterApplications(filterQuery),
      total: await this.database.filterApplicationsCount(filterQuery)
    };
  }

  async getApplicationById(applicationId, contractAddress) {
    return this.database.getApplication(applicationId, contractAddress);
  }

  async handleTokenizableTransferEvent(contractAddress, event) {
    const tokenizableContract = await this.chainService.getTokenizableContract(contractAddress);

    const memberFrom = event.returnValues._from;
    const memberTo = event.returnValues._to;

    await pIteration.forEach([memberFrom, memberTo], async (memberAddress) => {
      if (memberAddress === '0x0000000000000000000000000000000000000000') {
        return;
      }
      const memberBalance = await this.chainService.callContractMethod(tokenizableContract, 'balanceOf', [memberAddress], 'wei').catch(() => 0);
      if (memberBalance) {
        return this.database.addOrUpdateTokenizableMember(contractAddress, {
          balance: memberBalance,
          address: memberAddress
        });
      } else {
        const dbMember = await this.database.getTokenizableMember(contractAddress, memberAddress);
        if (dbMember) {
          return dbMember.destroy().catch(() => {/* already destroyed */
          });
        }
      }
    });
  }

  async filterTokenizableMembers(filterQuery: TokenizableMemberQuery) {
    return {
      list: await this.database.filterTokenizableMember(filterQuery),
      total: await this.database.filterTokenizableMemberCount(filterQuery)
    };
  }

  // =============================================================
  // Private Property Registries
  // =============================================================

  async handleNewPrivatePropertyRegistryEvent(event) {
    const address = event.returnValues.token;
    const timestamp = await this.chainService.getBlockTimestamp(event.blockNumber);
    const chainCreatedAt = new Date();
    chainCreatedAt.setTime(timestamp * 1000);
    return this.updatePrivatePropertyRegistry(address, {chainCreatedAt});
  }

  async updatePrivatePropertyRegistry(address, additionalData = {}) {
    const contract = await this.chainService.getPropertyRegistryContract(address);

    const owner = await contract.methods.owner().call({});

    if (owner === '0x0000000000000000000000000000000000000000') {
      const ppr = await this.database.getPrivatePropertyRegistry(address);
      if (ppr) {
        return ppr.destroy();
      }
      return;
    }

    const [name, symbol, controller] = await Promise.all([
      contract.methods.name().call({}),
      contract.methods.symbol().call({}),
      contract.methods.controller ? contract.methods.controller().call({}).catch(() => null) : null
    ]);


    let roles: any = {
      owner
    };

    if (controller) {
      const controllerContract = await this.chainService.getPropertyRegistryControllerContract(controller);
      const [controllerOwner, contourVerification, defaultBurnTimeout] = await Promise.all([
        controllerContract.methods.owner().call({}),
        controllerContract.methods.contourVerificationManager ? controllerContract.methods.contourVerificationManager().call({}).catch(() => null) : '0x0000000000000000000000000000000000000000',
        controllerContract.methods.defaultBurnTimeoutDuration().call({})
      ]);

      let verificationContract;
      if (contourVerification && contourVerification !== '0x0000000000000000000000000000000000000000') {
        verificationContract = await this.chainService.getPropertyRegistryVerificationContract(contourVerification);
      }

      let minter = await controllerContract.methods.minter().call({});

      const [geoDataManager, feeManager, burner, contourVerificationOwner] = await Promise.all([
        controllerContract.methods.geoDataManager().call({}),
        controllerContract.methods.feeManager().call({}),
        controllerContract.methods.burner().call({}),
        verificationContract ? verificationContract.methods.owner().call({}) : null
      ]);

      roles = {
        ...roles,
        owner,
        controllerOwner,
        minter,
        geoDataManager,
        feeManager,
        burner,
        contourVerificationOwner
      };

      additionalData = {
        ...additionalData,
        contourVerification,
        defaultBurnTimeout
      }
    }

    await this.database.addOrPrivatePropertyRegistry({address});

    const dbObject = await this.database.getPrivatePropertyRegistry(address);

    await pIteration.forEach(['owner', 'minter', 'geoDataManager', 'feeManager', 'burner', 'contourVerificationOwner'], async (roleName) => {
      if (roles[roleName] && dbObject[roleName] != roles[roleName]) {
        if (dbObject[roleName]) {
          await this.deletePprMember(address, dbObject[roleName]);
        }
        await this.database.addOrUpdatePprMember(dbObject, {
          address: roles[roleName]
        });
      }
    });

    const totalSupply = parseInt((await contract.methods.totalSupply().call({})).toString(10));
    const dataLink = await contract.methods.contractDataLink().call({});

    let description = dataLink;
    let dataJson = '';
    if (isIpldHash(dataLink)) {
      const data = await this.geesome.getObject(dataLink).catch(() => ({}));
      description = data.description && data.description.lang ? data.description['en'] || data.description['ru'] : '';
      dataJson = JSON.stringify(data);
    }

    const pprData: IPrivatePropertyRegistry = {
      address, controller, owner, totalSupply, name, symbol, dataLink, dataJson, description
    };

    await this.database.addOrPrivatePropertyRegistry({
      ...pprData,
      ...additionalData,
      ...roles
    });
  }

  async getPrivatePropertyRegistry(address) {
    return this.database.getPrivatePropertyRegistry(address);
  }

  getPrivatePropertyRegistryByMediator(mediatorType, mediatorAddress) {
    return this.database.getPrivatePropertyRegistryByMediator(mediatorType, mediatorAddress);
  }

  async filterPrivatePropertyRegistries(filterQuery: FilterPrivatePropertyRegistryGeoQuery) {
    if (filterQuery.surroundingsGeohashBox && filterQuery.surroundingsGeohashBox.length) {
      filterQuery.addresses = (await this.geohashService.getTokenIdsByParentGeohashArray(filterQuery.surroundingsGeohashBox)).map(i => i.contractAddress.toLowerCase());
    }
    return {
      list: await this.database.filterPrivatePropertyRegistry(filterQuery),
      total: await this.database.filterPrivatePropertyRegistryCount(filterQuery)
    };
  }

  async handlePrivatePropertyRegistryProposalEvent(registryAddress, event) {
    // const pprContract = await this.chainService.getPropertyRegistryContract(registryAddress);
    const controllerContract = await this.chainService.getPropertyRegistryControllerContract(event.contractAddress);

    const burnMethod = this.chainService.getContractMethod('ppToken', 'burn');

    const proposalId = event.returnValues.proposalId;

    const proposalData: any = {
      registryAddress,
      proposalId,
      contractAddress: event.contractAddress,
    };

    if (event.returnValues.tokenId) {
      proposalData['tokenId'] = event.returnValues.tokenId;
      const spaceTokenGeoData = await this.getSpaceTokenById(proposalData['tokenId'], registryAddress);
      if (!spaceTokenGeoData) {
        // token not exists
        return;
      }
      proposalData['spaceGeoDataId'] = spaceTokenGeoData.id;
    }
    if (event.returnValues.creator) {
      proposalData['creator'] = event.returnValues.creator
    }

    const proposal = await this.chainService.callContractMethod(controllerContract, 'proposals', [proposalId]);

    // log('handlePrivatePropertyRegistryProposalEvent', event.returnValues, proposal);

    const dataLink = proposal.dataLink;
    let description = dataLink;
    let dataJson = '';
    if (isIpldHash(dataLink)) {
      const data = await this.geesome.getObject(dataLink).catch(() => ({}));
      description = this.getLangValue(data.description);
      if(isIpldHash(description)) {
        description = await this.geesome.getContentData(description).catch(() => '')
      }
      dataJson = JSON.stringify(data);
    }

    proposal.status = ({
      '0': 'null',
      '1': 'pending',
      '2': 'approved',
      '3': 'executed',
      '4': 'rejected'
    })[proposal.status];

    const signature = proposal.data.slice(0, 10);

    const resultProposal = await this.database.addOrPrivatePropertyProposal({
      ...proposalData,
      dataLink,
      description,
      dataJson,
      status: proposal.status,
      isExecuted: proposal.status == 'executed',
      data: proposal.data,
      signature,
      isBurnProposal: burnMethod.signature === signature,
      isApprovedByTokenOwner: proposal.tokenOwnerApproved,
      isApprovedByRegistryOwner: proposal.geoDataManagerApproved
    });

    const [pendingBurnProposalsForTokenOwnerCount, pendingEditProposalsForTokenOwnerCount, pendingBurnProposalsForRegistryOwnerCount, pendingEditProposalsForRegistryOwnerCount] = await Promise.all([
      this.database.filterPrivatePropertyProposalCount({
        registryAddress,
        tokenId: resultProposal.tokenId,
        status: ['pending'],
        isBurnProposal: true,
        isApprovedByTokenOwner: false
      }),
      this.database.filterPrivatePropertyProposalCount({
        registryAddress,
        tokenId: resultProposal.tokenId,
        status: ['pending'],
        isBurnProposal: false,
        isApprovedByTokenOwner: false
      }),
      this.database.filterPrivatePropertyProposalCount({
        registryAddress,
        tokenId: resultProposal.tokenId,
        status: ['pending'],
        isBurnProposal: true,
        isApprovedByRegistryOwner: false
      }),
      this.database.filterPrivatePropertyProposalCount({
        registryAddress,
        tokenId: resultProposal.tokenId,
        status: ['pending'],
        isBurnProposal: false,
        isApprovedByRegistryOwner: false
      })
    ]);

    // log('isBurnProposal', burnMethod.signature === signature);
    // log('pendingBurnProposalsForTokenOwnerCount', pendingBurnProposalsForTokenOwnerCount);

    console.log('handlePrivatePropertyRegistryProposalEvent', event.blockNumber);
    await this.saveSpaceTokenById(registryAddress, resultProposal.tokenId, {
      proposalsToEditForTokenOwnerCount: pendingEditProposalsForTokenOwnerCount,
      proposalsToBurnForTokenOwnerCount: pendingBurnProposalsForTokenOwnerCount,
      proposalsToEditForRegistryOwnerCount: pendingEditProposalsForRegistryOwnerCount,
      proposalsToBurnForRegistryOwnerCount: pendingBurnProposalsForRegistryOwnerCount,
      blockNumber: event.blockNumber
    } as any);

    return resultProposal;
  }

  async handlePrivatePropertyBurnTimeoutEvent(registryAddress, event) {
    let tokenId: string = event.returnValues['id'] || event.returnValues['_tokenId'] || event.returnValues['tokenId'] || event.returnValues['_spaceTokenId'] || event.returnValues['spaceTokenId'] || event.returnValues['privatePropertyId'];
    return this.updatePrivatePropertyTokenTimeout(registryAddress, event.contractAddress, tokenId, event);
  }

  async updatePrivatePropertyTokenTimeout(registryAddress, controllerAddress, tokenId, event) {
    const controllerContract = await this.chainService.getPropertyRegistryControllerContract(controllerAddress);

    let burnTimeoutDuration = await this.chainService.callContractMethod(controllerContract, 'burnTimeoutDuration', [tokenId], 'number');
    if (!burnTimeoutDuration) {
      burnTimeoutDuration = await this.chainService.callContractMethod(controllerContract, 'defaultBurnTimeoutDuration', [], 'number');
    }

    const burnTimeoutAt = await this.chainService.callContractMethod(controllerContract, 'burnTimeoutAt', [tokenId]);

    let burnOn = null;
    if (burnTimeoutAt) {
      burnOn = new Date();
      burnOn.setTime(burnTimeoutAt * 1000);
    }

    console.log('updatePrivatePropertyTokenTimeout', event.blockNumber);
    return this.saveSpaceTokenById(registryAddress, tokenId, {
      burnTimeout: burnTimeoutDuration,
      burnOn,
      blockNumber: event.blockNumber
    } as any);
  }

  async handlePrivatePropertyPledgeBurnTimeoutEvent(registryAddress, event) {
    return this.updatePrivatePropertyPledgeTokenTimeout(registryAddress, event.contractAddress);
  }

  async updatePrivatePropertyPledgeTokenTimeout(registryAddress, verificationAddress?) {
    if (!verificationAddress) {
      const ppr = await this.database.getPrivatePropertyRegistry(registryAddress);
      verificationAddress = ppr.contourVerification;
    }
    if (!verificationAddress || verificationAddress === '0x0000000000000000000000000000000000000000') {
      return;
    }
    const verificationContract = await this.chainService.getPropertyRegistryVerificationContract(verificationAddress);

    let activeFromTimestamp = await this.chainService.callContractMethod(verificationContract, 'activeFrom', [], 'number');
    console.log('activeFromTimestamp', activeFromTimestamp);
    if (!activeFromTimestamp) {//verificationPledge
      return this.database.updateMassSpaceTokens(registryAddress, {
        burnWithoutPledgeOn: null
      })
    }

    const activeFrom = new Date();
    activeFrom.setTime(activeFromTimestamp * 1000);

    let minimalDeposit = await this.chainService.callContractMethod(verificationContract, 'minimalDeposit', [], 'wei');
    console.log('minimalDeposit', minimalDeposit);

    await this.database.updateMassSpaceTokens(registryAddress, {burnWithoutPledgeOn: null}, {
      verificationPledgeMin: minimalDeposit
    });

    await this.database.updateMassSpaceTokens(registryAddress, {burnWithoutPledgeOn: activeFrom}, {
      verificationPledgeMax: minimalDeposit,
      verificationDisabled: false
    });
  }

  handlePrivatePropertyPledgeChangeEvent(e) {
    return this.updatePrivatePropertyPledge(e.returnValues.tokenContract, e.returnValues.tokenId, e);
  }

  async updatePrivatePropertyPledge(registryAddress, tokenId, event) {
    if (!this.chainService.ppDepositHolder) {
      return;
    }
    const ppr = await this.database.getPrivatePropertyRegistry(registryAddress);
    const verificationPledge = await this.chainService.callContractMethod(this.chainService.ppDepositHolder, 'balanceOf', [registryAddress, tokenId], 'wei');

    const contract = await this.chainService.getPropertyRegistryContract(registryAddress);

    let creationTimeoutEndOn;
    if (ppr.contourVerification && ppr.contourVerification !== '0x0000000000000000000000000000000000000000') {
      const creationTimestamp = await this.chainService.callContractMethod(contract, 'propertyCreatedAt', [tokenId], 'number');
      const verificationContract = await this.chainService.getPropertyRegistryVerificationContract(ppr.contourVerification);
      const newTokenTimeout = await this.chainService.callContractMethod(verificationContract, 'newTokenTimeout', [], 'number');
      creationTimeoutEndOn = new Date();
      creationTimeoutEndOn.setTime((creationTimestamp + newTokenTimeout) * 1000);
    }

    console.log('updatePrivatePropertyPledge', event.blockNumber);
    await this.saveSpaceTokenById(registryAddress, tokenId, {
      verificationPledge,
      creationTimeoutEndOn,
      blockNumber: event.blockNumber
    } as any);
    return this.updatePrivatePropertyPledgeTokenTimeout(registryAddress)
  }

  async filterPrivatePropertyTokeProposals(filterQuery: PrivatePropertyProposalQuery) {
    return {
      list: await this.database.filterPrivatePropertyProposal(filterQuery),
      total: await this.database.filterPrivatePropertyProposalCount(filterQuery)
    };
  }

  async handlePrivatePropertyLegalAgreementEvent(registryAddress, event) {
    const timestamp = await this.chainService.getBlockTimestamp(event.blockNumber);

    const setAt = new Date();
    setAt.setTime(timestamp * 1000);

    const ipfsHash = bytes32ToIpfsHash(event.returnValues.legalAgreementIpfsHash || event.returnValues._legalAgreementIpfsHash);

    // const content = await this.geesome.getContentData(ipfsHash).catch(() => '');

    return this.database.addLegalAgreement({
      setAt,
      registryAddress,
      ipfsHash,
      // content
    });
  }

  async filterPrivatePropertyLegalAgreements(filterQuery: PrivatePropertyProposalQuery) {
    return {
      list: await this.database.filterPrivatePropertyLegalAgreement(filterQuery),
      total: await this.database.filterPrivatePropertyLegalAgreementCount(filterQuery)
    };
  }

  async filterPrivatePropertyMembers(filterQuery: PprMemberQuery) {
    return {
      list: await this.database.filterPprMember(filterQuery),
      total: await this.database.filterPprMemberCount(filterQuery)
    };
  }

  async handleMediatorCreation(event, mediatorType) {
    // console.log('handleMediatorCreation', event.returnValues);
    const {mediator, tokenId} = event.returnValues;
    return this.updatePrivateRegistryMediatorAddress(tokenId, mediator, mediatorType);
  }

  async handleMediatorOtherSideSet(registryAddress, event, mediatorType) {
    console.log('handleMediatorOtherSideSet', event.returnValues);
    const ppr = await this.getPrivatePropertyRegistry(registryAddress);
    return this.updatePrivateRegistryMediatorAddress(registryAddress, mediatorType === 'foreign' ? ppr.foreignMediator : ppr.homeMediator, mediatorType);
  }

  async updatePrivateRegistryMediatorAddress(registryAddress, mediatorAddress, mediatorType) {
    const mediatorContract = await this.chainService.getMediatorContract(mediatorAddress, mediatorType);
    const network = await this.chainService.callContractMethod(mediatorContract, 'oppositeChainId', []);
    const mediatorContractOnOtherSide = await this.chainService.callContractMethod(mediatorContract, 'mediatorContractOnOtherSide', []);

    let additionalData = {};
    if (mediatorType === 'home') {
      additionalData['isBridgetHome'] = true;
      additionalData['homeMediator'] = mediatorAddress;
      additionalData['homeMediatorNetwork'] = await this.chainService.getNetworkId();

      additionalData['foreignMediator'] = mediatorContractOnOtherSide;
      additionalData['foreignMediatorNetwork'] = network;
    } else {
      additionalData['isBridgetForeign'] = true;
      additionalData['foreignMediator'] = mediatorAddress;
      additionalData['foreignMediatorNetwork'] = await this.chainService.getNetworkId();

      additionalData['homeMediator'] = mediatorContractOnOtherSide;
      additionalData['homeMediatorNetwork'] = network;
    }
    console.log('updatePrivateRegistryMediatorAddress', registryAddress, additionalData);
    return this.updatePrivatePropertyRegistry(registryAddress, additionalData);
  }

  async handlePropertyLockerCreation(event) {
    return this.database.addOrUpdatePropertyLocker({
      address: event.returnValues.locker,
      depositManager: event.returnValues.owner,
    })
  }

  async filterPropertyLockers(filterQuery: PropertyLockersQuery) {
    return {
      list: await this.database.filterPropertyLockers(filterQuery),
      total: await this.database.filterPropertyLockersCount(filterQuery)
    };
  }

  // =============================================================
  // Communities
  // =============================================================

  async handleNewCommunityEvent(event, isPpr) {
    const factoryContract = await this.chainService.getCommunityFactoryContract(event.contractAddress);
    const {fundRegistry} = await this.chainService.callContractMethod(factoryContract, 'fundContracts', [event.returnValues.fundId]);
    const registryContract = await this.chainService.getCommunityFundRegistryContract(fundRegistry);

    const raAddress = await this.chainService.callContractMethod(registryContract, 'getRAAddress', []);
    await this.updateCommunity(raAddress, isPpr, event.blockNumber);
    return this.database.getCommunity(raAddress);
  }

  async updateCommunity(raAddress, isPpr, createdAtBlock?) {
    // log('updateCommunity', raAddress, isPpr);
    const raContract = await this.chainService.getCommunityRaContract(raAddress, isPpr);
    const registryAddress = await this.chainService.callContractMethod(raContract, 'fundRegistry', []);

    const registryContract = await this.chainService.getCommunityFundRegistryContract(registryAddress);

    const [storageAddress, multiSigAddress, ruleRegistryAddress] = await Promise.all([
      this.chainService.callContractMethod(registryContract, 'getStorageAddress', []),
      this.chainService.callContractMethod(registryContract, 'getMultiSigAddress', []),
      this.chainService.callContractMethod(registryContract, 'getRuleRegistryAddress', []).catch(() => null)
    ]);

    const [storageContract, ruleRegistryContract, multisigContract, community] = await Promise.all([
      this.chainService.getCommunityStorageContract(storageAddress, isPpr),
      ruleRegistryAddress ? this.chainService.getCommunityRuleRegistryContract(ruleRegistryAddress) : null,
      this.chainService.getCommunityMultiSigContract(multiSigAddress),
      this.database.getCommunity(raAddress)
    ]);


    let [name, dataLink, owners, activeFundRulesCount, tokensCount, reputationTotalSupply, isPrivate, spaceTokenOwnersCount] = await Promise.all([
      this.chainService.callContractMethod(storageContract, 'name', []),
      this.chainService.callContractMethod(storageContract, 'dataLink', []),
      this.chainService.callContractMethod(multisigContract, 'getOwners', []),
      this.chainService.callContractMethod(ruleRegistryContract || storageContract, 'getActiveFundRulesCount', [], 'number'),
      (async () => community ? await this.database.getCommunityTokensCount(community) : 0)(),
      this.chainService.callContractMethod(raContract, 'totalSupply', [], 'wei'),
      (async () => {
        const isPrivateKey = await this.chainService.callContractMethod(storageContract, 'IS_PRIVATE', []);
        return (await this.chainService.callContractMethod(storageContract, 'config', [isPrivateKey])) != '0x0000000000000000000000000000000000000000000000000000000000000000';
      })(),
      this.database.filterCommunityMemberCount({communityAddress: raAddress})
    ]);

    // log('community', raAddress, 'tokensCount', tokensCount, 'spaceTokenOwnersCount', spaceTokenOwnersCount, 'ruleRegistryAddress', ruleRegistryAddress);

    let description = dataLink;
    let dataJson = '';
    if (isIpldHash(dataLink)) {
      const data = await this.geesome.getObject(dataLink).catch(() => ({}));
      if(data.name) {
        name = this.getLangValue(data.name);
      }
      description = this.getLangValue(data.description);
      dataJson = JSON.stringify(data);
    }
    // log('community', dataJson, 'dataLink', dataLink);

    const _community = await this.database.addOrUpdateCommunity({
      address: raAddress,
      storageAddress,
      ruleRegistryAddress,
      multiSigAddress,
      isPpr,
      isPrivate,
      tokensCount,
      activeFundRulesCount,
      spaceTokenOwnersCount,
      reputationTotalSupply,
      dataLink,
      dataJson,
      description,
      name,
      createdAtBlock,
      multisigOwnersJson: JSON.stringify(owners)
    });
    if (!community) {
      log('community created', raAddress, JSON.stringify(_community))
    }
  }

  async updateCommunityMember(community: ICommunity, address, additionalData = {}) {
    address = address.toLowerCase();
    // console.log('updateCommunityMember', address);
    const [contract, raContract] = await Promise.all([
      this.chainService.getCommunityStorageContract(community.storageAddress, community.isPpr),
      this.chainService.getCommunityRaContract(community.address, community.isPpr)
    ]);

    let [currentReputation, basicReputation, fullNameHash, tokens] = await Promise.all([
      this.chainService.callContractMethod(raContract, 'balanceOf', [address], 'wei'),
      this.chainService.callContractMethod(raContract, 'ownedBalanceOf', [address], 'wei'),
      this.chainService.callContractMethod(contract, 'membersIdentification', [address], 'bytes32'),
      this.database.getCommunityMemberTokens(community, address)
    ]);

    // console.log('updateCommunityMember', address, tokens.length);

    tokens = await pIteration.filter(tokens, t => {
      return this.chainService.callContractMethod(raContract, 'ownerReputationMinted', [address, t.contractAddress, t.tokenId], 'wei');
    });

    if (tokens.length === 0) {
      const member = await this.database.getCommunityMember(community.id, address);
      if (member) {
        await member.destroy();
      }
      return this.updateCommunity(community.address, community.isPpr);
    }

    let photosJson = '[]';
    try {
      const tokenWithPhoto = tokens.filter(t => t.photosCount > 0)[0];
      if (tokenWithPhoto) {
        photosJson = JSON.stringify(JSON.parse(tokenWithPhoto.dataJson).photos);
      }
    } catch (e) {
      // photos not found
    }
    let tokensJson = tokens.map(t => ({
      tokenId: t.tokenId,
      contractAddress: t.contractAddress,
      tokenType: t.tokenType,
      humanAddress: t.humanAddress,
      type: t.type,
      subtype: t.subtype,
      area: t.area
    }));
    await this.database.addOrUpdateCommunityMember(community, {
      address,
      currentReputation,
      basicReputation,
      tokensCount: tokens.length,
      fullNameHash,
      communityAddress: community.address,
      isPpr: community.isPpr,
      photosJson,
      tokensJson: JSON.stringify(tokensJson),
      ...additionalData
    });
  }

  async handleCommunityMintEvent(communityAddress, event: IExplorerCommunityMintEvent, isPpr) {
    const [community, propertyToken] = await Promise.all([
      this.database.getCommunity(communityAddress),
      this.database.getSpaceToken(event.returnValues.tokenId, event.returnValues.registry || this.chainService.spaceGeoData._address)
    ]);

    const raContract = await this.chainService.getCommunityRaContract(community.address, community.isPpr);
    let isMinted;
    if (community.isPpr) {
      if (raContract._jsonInterface.filter(i => i.name === 'reputationMinted').length) {
        isMinted = parseFloat(await this.chainService.callContractMethod(raContract, 'reputationMinted', [event.returnValues.registry, event.returnValues.tokenId], 'wei'));
      } else {
        isMinted = await this.chainService.callContractMethod(raContract, 'tokenReputationMinted', [event.returnValues.registry, event.returnValues.tokenId], 'wei');
      }
    } else {
      isMinted = await this.chainService.callContractMethod(raContract, 'reputationMinted', [event.returnValues.tokenId]);
    }

    if (isMinted) {
      await community.addSpaceTokens([propertyToken]).catch(() => {/* already in community */
      });
    }

    if (propertyToken) {
      await this.updateCommunityTokenOwners(community, propertyToken);

      await this.database.addOrUpdateGeoData({
        tokenId: propertyToken.tokenId,
        contractAddress: propertyToken.contractAddress,
        communitiesCount: await this.database.getTokenCommunitiesCount(propertyToken)
      });
    }


    return this.updateCommunity(communityAddress, isPpr);
  }

  async handleCommunityBurnEvent(communityAddress, event, isPpr) {
    return this.checkMintedCommunityPropertyToken(communityAddress, event.returnValues.registry || this.chainService.spaceGeoData._address, event.returnValues.tokenId, isPpr);
  }

  async checkMintedCommunityPropertyToken(communityAddress, registryAddress, tokenId, isPpr) {
    const [community, propertyToken] = await Promise.all([
      this.database.getCommunity(communityAddress),
      this.database.getSpaceToken(tokenId, registryAddress)
    ]);

    const raContract = await this.chainService.getCommunityRaContract(community.address, community.isPpr);

    let reputationMinted;
    if (community.isPpr) {
      if (raContract._jsonInterface.filter(i => i.name === 'reputationMinted').length) {
        reputationMinted = parseFloat(await this.chainService.callContractMethod(raContract, 'reputationMinted', [registryAddress, tokenId], 'wei'));
      } else {
        reputationMinted = await this.chainService.callContractMethod(raContract, 'tokenReputationMinted', [registryAddress, tokenId], 'wei');
      }
    } else {
      reputationMinted = await this.chainService.callContractMethod(raContract, 'reputationMinted', [tokenId]);
    }


    if (!reputationMinted) {
      await community.removeSpaceTokens([propertyToken]);
    }

    if (propertyToken) {
      await this.updateCommunityTokenOwners(community, propertyToken);

      await this.database.addOrUpdateGeoData({
        tokenId: propertyToken.tokenId,
        contractAddress: propertyToken.contractAddress,
        communitiesCount: await this.database.getTokenCommunitiesCount(propertyToken)
      });
    }

    return this.updateCommunity(communityAddress, isPpr);
  }

  async updateCommunityTokenOwners(community, propertyToken, additionalData = {}) {
    const owners = await propertyToken.getOwners();
    // console.log('updateCommunityTokenOwners', owners);
    await pIteration.forEach(owners, (owner) => {
      return this.updateCommunityMember(community, owner.address, additionalData);
    })
  }

  async handleCommunityTransferReputationEvent(communityAddress, event, isPpr) {
    const community = await this.database.getCommunity(communityAddress);

    await this.updateCommunityMember(community, event.returnValues.from);
    await this.updateCommunityMember(community, event.returnValues.to);

    return this.updateCommunity(communityAddress, isPpr);
  }

  async handleCommunityRevokeReputationEvent(communityAddress, event, isPpr) {
    const community = await this.database.getCommunity(communityAddress);

    await this.updateCommunityMember(community, event.returnValues.from);
    await this.updateCommunityMember(community, event.returnValues.owner);

    return this.updateCommunity(communityAddress, isPpr);
  }

  async handleCommunityAddVotingEvent(communityAddress, event) {
    return this.updateCommunityVoting(communityAddress, event.returnValues.marker || event.returnValues.key);
  }

  async updateCommunityVoting(communityAddress, marker) {
    const community = await this.database.getCommunity(communityAddress);

    const storageContract = await this.chainService.getCommunityStorageContract(community.storageAddress, community.isPpr);

    let [markerData, communityProposalsCount] = await Promise.all([
      this.chainService.callContractMethod(storageContract, 'proposalMarkers', [marker]),
      this.database.filterCommunityProposalCount({communityAddress, marker})
    ]);
    // console.log('updateCommunityVoting', this.chainService.hexToString(markerData.name), marker, markerData);

    const proposalManager = markerData.proposalManager;
    if (proposalManager === '0x0000000000000000000000000000000000000000') {
      return;
    }

    const proposalManagerContract = await this.chainService.getCommunityProposalManagerContract(proposalManager);

    let contractToGetConfig = proposalManagerContract.methods.getProposalVotingConfig ? proposalManagerContract : storageContract;
    let {support, minAcceptQuorum, timeout} = await this.chainService.callContractMethod(contractToGetConfig, 'getProposalVotingConfig', [marker]);

    support = this.chainService.weiToEther(support);
    minAcceptQuorum = this.chainService.weiToEther(minAcceptQuorum);
    timeout = parseInt(timeout.toString(10));

    //TODO: get from database
    // const activeProposalsCount = await this.chainService.callContractMethod(proposalManagerContract, 'getActiveProposalsCount', [marker], 'number');
    // const approvedProposalsCount = await this.chainService.callContractMethod(proposalManagerContract, 'getApprovedProposalsCount', [marker], 'number');
    // const rejectedProposalsCount = await this.chainService.callContractMethod(proposalManagerContract, 'getRejectedProposalsCount', [marker], 'number');

    let dataLink = markerData.dataLink;
    let description = markerData.dataLink;
    let dataJson = '';
    if (isIpldHash(dataLink)) {
      const data = await this.geesome.getObject(dataLink).catch(() => ({}));
      description = data.description;
      dataJson = JSON.stringify(data);
    }
    await this.database.addOrUpdateCommunityVoting(community, {
      communityAddress,
      marker,
      proposalManager,
      name: this.chainService.hexToString(markerData.name),
      destination: markerData.destination,
      description,
      dataLink,
      dataJson,
      support,
      minAcceptQuorum,
      timeout,
      // activeProposalsCount,
      // approvedProposalsCount,
      // rejectedProposalsCount,
      totalProposalsCount: communityProposalsCount
    });

    await this.database.addOrUpdateCommunity({
      address: communityAddress,
      pmAddress: proposalManager
    });
  }

  async handleCommunityRemoveVotingEvent(communityAddress, event) {
    const community = await this.database.getCommunity(communityAddress);
    if (!community) {
      return;
    }

    const communityVoting = await this.database.getCommunityVoting(community.id, event.returnValues.marker);

    if (!communityVoting) {
      return;
    }

    return communityVoting.destroy();
  }

  async handleCommunityAddProposalEvent(communityAddress, event) {
    return this.updateCommunityProposal(communityAddress, event.contractAddress, event.returnValues.marker, event.returnValues.proposalId, event.transactionHash);
  }

  async handleCommunityUpdateProposalEvent(communityAddress, event) {
    return this.updateCommunityProposal(communityAddress, event.contractAddress, event.returnValues.marker, event.returnValues.proposalId);
  }

  getLangValue(value, lang = 'en') {
    if(!value) {
      return value;
    }
    return value.lang ? value[lang] || value['en'] || value['ru'] : value;
  }

  async updateCommunityProposal(communityAddress, pmAddress, marker, proposalId, proposeTxId?) {
    const [community, proposal] = await Promise.all([
      this.database.getCommunity(communityAddress),
      this.database.getCommunityProposalByVotingAddress(pmAddress, proposalId)
    ]);

    if (!marker) {
      if (!proposal) {
        // May appeared if AyeProposal event emited before the NewProposal
        return console.error('Not found proposal', proposalId, 'in', pmAddress);
      }
      marker = proposal.marker;
    }

    let [voting, proposalManagerContract, storageContract, ruleRegistryContract] = await Promise.all([
      this.database.getCommunityVoting(community.id, marker),
      this.chainService.getCommunityProposalManagerContract(pmAddress),
      this.chainService.getCommunityStorageContract(community.storageAddress, community.isPpr),
      community.ruleRegistryAddress ? this.chainService.getCommunityRuleRegistryContract(community.ruleRegistryAddress) : null
    ]);

    let txData: any = {};

    if (proposeTxId) {
      txData.proposeTxId = proposeTxId;
    }

    const [proposalData, proposalVotingData, proposalVotingProgress] = await Promise.all([
      this.chainService.callContractMethod(proposalManagerContract, 'proposals', [proposalId]),
      this.chainService.callContractMethod(proposalManagerContract, 'getProposalVoting', [proposalId]),
      this.chainService.callContractMethod(proposalManagerContract, 'getProposalVotingProgress', [proposalId]),
    ]);

    let dataLink = proposalData.dataLink;
    let description = dataLink;
    let uniqId;
    let dataJson = '';
    if (isIpldHash(dataLink)) {
      const data = await this.geesome.getObject(dataLink).catch((e) => {
        console.error('Failed to fetch', dataLink, e);
        return {};
      });
      description = this.getLangValue(data.description);
      uniqId = data.uniqId;
      dataJson = JSON.stringify(data);
    }

    const createdAtBlock = parseInt(proposalVotingData.creationBlock.toString(10));

    let status = {
      '0': null,
      '1': 'active',
      '2': 'executed'
    }[proposalData.status];

    let ruleDbId = proposal ? proposal.ruleDbId : null;
    let isActual = proposal ? proposal.isActual : true;

    console.log('status', status, (!proposal || !proposal.executeTxId));

    if (status === 'executed' && (!proposal || !proposal.executeTxId)) {
      const executeEvents = await this.chainService.getEventsFromBlock(proposalManagerContract, 'Execute', createdAtBlock, {
        success: true,
        proposalId
      });
      // console.log('executeEvents', executeEvents);
      if (executeEvents.length) {
        txData.executeTxId = executeEvents[0]['transactionHash'];
        txData.closedAtBlock = parseInt(executeEvents[0]['blockNumber'].toString(10));
        const closedAt = new Date();
        closedAt.setTime((await this.chainService.getBlockTimestamp(txData.closedAtBlock)) * 1000);
        txData.closedAt = closedAt;

        const txReceipt = await this.chainService.getTransactionReceipt(
          txData.executeTxId,
          [
            {address: community.storageAddress, abi: this.chainService.getCommunityStorageAbi(community.isPpr)},
            {address: community.ruleRegistryAddress, abi: this.chainService.getCommunityRuleRegistryAbi()}
          ]
        );

        const AddFundRuleEvent = txReceipt.events.filter(e => e.name === 'AddFundRule')[0];
        // console.log('AddFundRuleEvent', AddFundRuleEvent);
        if (AddFundRuleEvent) {
          const dbRule = await this.updateCommunityRule(communityAddress, AddFundRuleEvent.values.id, {
            addRuleProposalUniqId: uniqId
          });
          console.log('dbRule.meetingId', dbRule.meetingId);
          if (dbRule.meetingId) {
            const [meeting] = await this.database.filterCommunityMeeting({
              communityAddress,
              meetingId: dbRule.meetingId
            });
            console.log('meeting.id', meeting ? meeting.id : null);
            if (meeting) {
              const data = JSON.parse(meeting.dataJson);
              const insideMeetingId = _.findIndex(data.proposals, { uniqId }) + 1;
              await this.updateCommunityRule(communityAddress, AddFundRuleEvent.values.id, {insideMeetingId});
            }
          }

          ruleDbId = dbRule.id;
          const disableEvents = await this.chainService.getEventsFromBlock(ruleRegistryContract || storageContract, 'DisableFundRule', createdAtBlock, {id: AddFundRuleEvent.values.id});
          if (disableEvents.length) {
            isActual = false;
          }

          const abstractProposal = await this.database.getCommunityRule(community.id, pmAddress + '-' + proposalId);
          if (abstractProposal) {
            await abstractProposal.destroy();
          }
        }
      }
    }

    let proposalParsedData = this.chainService.parseData(proposalData.data, this.chainService.getCommunityStorageAbi(community.isPpr));
    if(!proposalParsedData.methodName) {
      proposalParsedData = this.chainService.parseData(proposalData.data, this.chainService.getCommunityRuleRegistryAbi());
    }
    // console.log('proposalParsedData.methodName', proposalParsedData.methodName);

    if (_.startsWith(proposalParsedData.methodName, 'disableRuleType')) {
      const dbRule = await this.updateCommunityRule(communityAddress, proposalParsedData.inputs.id);
      if (status === 'executed') {
        const addFundRuleProposal = (dbRule.proposals || []).filter(p => _.startsWith(p.markerName, 'storage.addRuleType'))[0];
        if (addFundRuleProposal) {
          await this.database.updateProposalByDbId(addFundRuleProposal.id, {isActual: false});
        }
      }
      ruleDbId = dbRule.id;
    }

    let timeoutAt = parseInt(proposalVotingProgress.timeoutAt.toString(10));

    // console.log('proposalVotingProgress', proposalVotingProgress);
    let [ayeShare, abstainShare, nayShare, createdAtBlockTimestamp] = await Promise.all([
      this.chainService.callContractMethod(proposalManagerContract, 'getAyeShare', [proposalId], 'wei'),
      this.chainService.callContractMethod(proposalManagerContract, 'getAbstainShare', [proposalId], 'wei'),
      this.chainService.callContractMethod(proposalManagerContract, 'getNayShare', [proposalId], 'wei'),
      this.chainService.getBlockTimestamp(createdAtBlock)
    ]);

    const timeoutDate = new Date();
    timeoutDate.setTime(timeoutAt * 1000);
    txData.closedAt = timeoutDate;

    if (status === 'active') {
      if (!ruleDbId && proposeTxId && _.startsWith(proposalParsedData.methodName, 'addRuleType')) {
        const ruleId = pmAddress + '-' + proposalId;
        const meetingId = proposalParsedData.inputs.meetingId.toString(10);
        txData.meetingId = meetingId;
        const dbRule = await this.abstractUpdateCommunityRule(community, {
          ruleId,
          addRuleProposalUniqId: uniqId,
          isActive: false,
          isAbstract: true,
          typeId: proposalParsedData.methodName.replace('addRuleType', ''),
          manager: pmAddress,
          meetingId: meetingId === '0' ? null : parseInt(meetingId),
          dataLink: proposalParsedData.inputs.dataLink,
          ipfsHash: this.chainService.hexToString(proposalParsedData.inputs.ipfsHash)
        });

        if (parseInt(meetingId)) {
          const meeting = await this.updateCommunityMeeting(community.address, meetingId);
          if (meeting) {
            const data = JSON.parse(meeting.dataJson);
            const insideMeetingId = _.findIndex(data.proposals, { uniqId }) + 1;
            await this.abstractUpdateCommunityRule(community, {ruleId, insideMeetingId});
          }
        }

        ruleDbId = dbRule.id;
      }
    }

    // if (isActual && status === 'rejected') {
    //   isActual = false;
    // }

    const createdAt = new Date();
    createdAt.setTime(createdAtBlockTimestamp * 1000);

    const votingName = voting ? voting.name : 'unknown';
    if (!votingName) {
      console.log('voting', JSON.stringify(voting));
    }

    let minAcceptQuorum: any = this.chainService.weiToEther(proposalVotingProgress.minAcceptQuorum);
    let requiredSupport: any = this.chainService.weiToEther(proposalVotingProgress.requiredSupport);
    const currentQuorum: any = this.chainService.weiToEther(proposalVotingProgress.currentQuorum || '0');
    const currentSupport: any = this.chainService.weiToEther(proposalVotingProgress.currentSupport);

    let acceptedEnoughToExecute = parseFloat(currentQuorum) >= parseFloat(minAcceptQuorum) && parseFloat(currentSupport) >= parseFloat(requiredSupport);

    console.log('proposal', proposalId, votingName, pmAddress, isActual);
    console.log('acceptedEnoughToExecute', acceptedEnoughToExecute, 'currentQuorum', currentQuorum, 'minAcceptQuorum', minAcceptQuorum, 'currentSupport', currentSupport, 'requiredSupport', requiredSupport);

    // console.log('proposalVotingProgress', proposalVotingProgress);

    await this.database.addOrUpdateCommunityProposal(voting, {
      communityAddress,
      marker,
      proposalId,
      pmAddress,
      markerName: votingName,
      destination: proposalData.destination,
      creatorAddress: proposalData.creator,
      communityId: community.id,
      acceptedShare: ayeShare,
      acceptedCount: proposalVotingData.ayes.length,
      abstainedShare: abstainShare,
      abstainedCount: proposalVotingData.abstains ? proposalVotingData.abstains.length : null,
      declinedCount: proposalVotingData.nays.length,
      declinedShare: nayShare,
      createdAtBlock,
      createdAt,
      ...txData,
      status,
      description,
      uniqId,
      dataLink,
      dataJson,
      data: proposalData.data,
      requiredSupport,
      minAcceptQuorum,
      acceptedEnoughToExecute,
      currentSupport,
      currentQuorum,
      totalAccepted: this.chainService.weiToEther(proposalVotingData.totalAyes),
      totalDeclined: this.chainService.weiToEther(proposalVotingData.totalNays),
      totalAbstained: this.chainService.weiToEther(proposalVotingData.totalAbstains || '0'),
      isActual,
      timeoutAt,
      ruleDbId
    });
    // log('newProposal', JSON.stringify(newProposal));

    await this.updateCommunityVoting(communityAddress, marker);
  }

  handleCommunityRuleEvent(communityAddress, event) {
    return this.updateCommunityRule(communityAddress, event.returnValues.id);
  }

  async updateCommunityRule(communityAddress, ruleId, additionalData = {}) {
    const community = await this.database.getCommunity(communityAddress);

    let contract;
    // console.log('community.ruleRegistryAddress', community.ruleRegistryAddress);
    if(community.ruleRegistryAddress) {
      contract = await this.chainService.getCommunityRuleRegistryContract(community.ruleRegistryAddress);
    } else {
      contract = await this.chainService.getCommunityStorageContract(community.storageAddress);
    }

    const ruleData = await this.chainService.callContractMethod(contract, 'fundRules', [ruleId]);

    ruleData.createdAt = undefined;
    ruleData.id = undefined;
    ruleData.ipfsHash = this.chainService.hexToString(ruleData.ipfsHash);
    ruleData.typeId = ruleData.typeId ? ruleData.typeId.toString(10) : null;
    ruleData.meetingId = ruleData.meetingId ? ruleData.meetingId.toString(10) : null;
    if(ruleData.meetingId === '0') {
      ruleData.meetingId = null;
    }

    return this.abstractUpdateCommunityRule(community, {
      ruleId,
      isActive: ruleData.active,
      ...ruleData,
      ...additionalData
    });
  }

  async abstractUpdateCommunityRule(community: ICommunity, ruleData) {
    console.log('abstractUpdateCommunityRule', ruleData);
    const {dataLink, createdAt} = ruleData;
    if (dataLink) {
      ruleData.description = 'Not found';
      if (isIpldHash(dataLink)) {
        const data = await this.geesome.getObject(dataLink).catch((e) => {
          console.error('Failed to fetch', dataLink, e);
          return {};
        });
        // log('dataItem', dataItem);
        try {
          log('rule data', data);
          if (data.description) {
            const ipldData = await this.geesome.getObject(this.getLangValue(data.description));
            ruleData.descriptionIpfsHash = ipldData.storageId;
            ruleData.description = await this.geesome.getContentData(ruleData.descriptionIpfsHash).catch(() => '');
          } else if (data.text) {
            const text = this.getLangValue(data.text);
            if (isIpldHash(text)) {
              ruleData.description = await this.geesome.getContentData(text).catch(() => '');
            } else {
              ruleData.description = text;
            }
          }
          ruleData.type = data.type;
          log('description', ruleData.description, 'type', ruleData.type);
          ruleData.dataJson = JSON.stringify(data);
        } catch (e) {
          console.error(e);
        }
      }
    }

    const result = await this.database.addOrUpdateCommunityRule(community, {
      ...ruleData,
      communityId: community.id,
      communityAddress: community.address
    });
    if (parseInt(ruleData.meetingId)) {
      await this.updateCommunityMeeting(community.address, ruleData.meetingId);
    }

    await this.updateCommunity(community.address, community.isPpr);
    return result;
  }

  handleCommunityMeetingEvent(communityAddress, event) {
    console.log('handleCommunityMeetingEvent', event.returnValues);
    return this.updateCommunityMeeting(communityAddress, event.returnValues.id, {createdAtBlock: event.blockNumber});
  }

  async updateCommunityMeeting(communityAddress, meetingId, additionalFields = {}) {
    const community = await this.database.getCommunity(communityAddress);

    let contract = await this.chainService.getCommunityRuleRegistryContract(community.ruleRegistryAddress);
    const meetingData = await this.chainService.callContractMethod(contract, 'meetings', [meetingId]);

    delete meetingData.createdAt;
    delete meetingData.id;
    delete meetingData.meetingId;
    meetingData.ipfsHash = this.chainService.hexToString(meetingData.ipfsHash);
    meetingData.typeId = meetingData.typeId ? meetingData.typeId.toString(10) : null;
    meetingData.creatorAddress = meetingData.creator;

    return this.abstractUpdateCommunityMeeting(community, {
      meetingId,
      isActive: meetingData.active,
      ...meetingData,
      ...additionalFields
    })
  }

  async abstractUpdateCommunityMeeting(community: ICommunity, meetingData) {
    const {dataLink, createdAt} = meetingData;
    let description = '';
    let dataJson = '';
    let data;
    if (isIpldHash(dataLink)) {
      data = await this.geesome.getObject(dataLink).catch((e) => {
        console.error('Failed to fetch', dataLink, e);
        return {};
      });
      // log('dataItem', dataItem);
      try {
        log('meeting data', data);
        if (data.description) {
          const descriptionLink = this.getLangValue(data.description);
          console.log('descriptionLink', descriptionLink);
          if(descriptionLink) {
            description = await this.geesome.getContentData(descriptionLink);
          }
        }
        dataJson = JSON.stringify(data);
      } catch (e) {
        console.error(e);
      }
    }

    const [activeProposal] = await this.database.filterCommunityProposal({
      meetingId: meetingData.meetingId,
      status: ['active'],
      limit: 1,
      sortBy: 'timeoutAt',
      sortDir: 'DESC'
    });

    const [executedProposal] = await this.database.filterCommunityProposal({
      meetingId: meetingData.meetingId,
      status: ['executed'],
      limit: 1,
      sortBy: 'timeoutAt',
      sortDir: 'DESC'
    });

    console.log('activeProposal', activeProposal);
    meetingData.startDateTime = new Date(parseInt(meetingData.startOn.toString(10)) * 1000);
    if(activeProposal || executedProposal) {
      let lastProposal = activeProposal || executedProposal;
      meetingData.endDateTime = new Date(parseInt(lastProposal.timeoutAt.toString(10)) * 1000);
    } else {
      meetingData.endDateTime = new Date(parseInt(meetingData.endOn.toString(10)) * 1000);
    }
    console.log('startDateTime', meetingData.startDateTime, 'endDateTime', meetingData.endDateTime);

    let rulesCount = await this.database.filterCommunityRuleCount({
      communityAddress: community.address,
      meetingId: meetingData.meetingId
    });
    console.log('rulesCount', rulesCount);

    let localProposalsToCreateCount = 0;
    if(data && data.proposals) {
      localProposalsToCreateCount = data.proposals.length - rulesCount;
    }

    const executedProposalsCount = await this.database.filterCommunityProposalCount({
      meetingId: meetingData.meetingId,
      status: ['executed']
    });

    const [lastProposalByTimeout] = await this.database.filterCommunityProposal({
      meetingId: meetingData.meetingId,
      sortBy: 'timeoutAt',
      sortDir: 'DESC'
    });

    let status;
    if(!meetingData.isActive) {
      status = 'deactivated';
    } else if(executedProposalsCount) {
      status = 'done';
    } else if(new Date() > meetingData.endDateTime) {
      status = 'failed';
    } else if(new Date() > meetingData.startDateTime) {
      status = 'in_process';
    } else {
      status = 'planned';
    }

    const result = await this.database.addOrUpdateCommunityMeeting(community, {
      ...meetingData,
      status,
      communityId: community.id,
      communityAddress: community.address,
      rulesCount,
      localProposalsToCreateCount,
      executedProposalsCount,
      lastProposalTimeoutAt: lastProposalByTimeout ? lastProposalByTimeout.timeoutAt : null,
      description,
      dataLink,
      dataJson
    });
    console.log('result.id', result.id, result.communityAddress);
    await this.updateCommunity(community.address, community.isPpr);
    return result;
  }

  handleCommunityTokenApprovedEvent(communityAddress, event) {
    return this.updateCommunityTokenApproved(communityAddress, event.returnValues.tokenId, event.returnValues.registry);
  }

  async updateCommunityTokenApproved(communityAddress, tokenId, registryAddress?) {
    const community = await this.database.getCommunity(communityAddress);

    const storageContract = await this.chainService.getCommunityStorageContract(community.storageAddress, community.isPpr);
    const raContract = await this.chainService.getCommunityStorageContract(community.address, community.isPpr);

    let isApproved;
    if (community.isPpr) {
      isApproved = await this.chainService.callContractMethod(storageContract, 'isMintApproved', [registryAddress, tokenId]);
    } else {
      isApproved = await this.chainService.callContractMethod(storageContract, 'isMintApproved', [tokenId]);
    }
    const propertyToken = await this.database.getSpaceToken(tokenId, registryAddress || this.chainService.spaceGeoData._address);

    let isExpelled;
    if (community.isPpr) {
      isExpelled = await this.chainService.callContractMethod(storageContract, 'getExpelledToken', [registryAddress, tokenId]);
    } else {
      isExpelled = await this.chainService.callContractMethod(storageContract, 'getExpelledToken', [tokenId]);
    }
    const expelledAmount = await this.chainService.callContractMethod(raContract, 'tokenReputationMinted', [registryAddress, tokenId]);

    if (!propertyToken) {
      return;
    }
    if (isApproved) {
      if (isExpelled) {
        await community.removeApprovedSpaceTokens([propertyToken]).catch(() => {/* already deleted */
        });
      } else {
        await community.addApprovedSpaceTokens([propertyToken]).catch(() => {/* already in community */
        });
      }
    } else {
      await community.removeApprovedSpaceTokens([propertyToken]).catch(() => {/* already deleted */
      });
    }

    const member = await this.database.getCommunityMember(communityAddress, propertyToken.owner);
    let expelledObj = {};
    const expelledKey = propertyToken.contractAddress + '_' + propertyToken.tokenId;
    try {
      expelledObj = JSON.parse(member.expelledJson);
    } catch (e) {
    }
    if (isExpelled) {
      expelledObj[expelledKey] = parseFloat(expelledAmount);
    }
    if (!isExpelled || !parseFloat(expelledObj[expelledKey])) {
      delete expelledObj[expelledKey];
    }
    // console.log('expelledJson', JSON.stringify(expelledObj));
    await this.checkMintedCommunityPropertyToken(communityAddress, propertyToken.contractAddress, propertyToken.tokenId, community.isPpr);
    return this.updateCommunityTokenOwners(community, propertyToken, {
      expelledJson: JSON.stringify(expelledObj)
    });
  }

  async getCommunity(address) {
    return this.database.getCommunity(address);
  }

  async filterCommunities(filterQuery: FilterCommunityGeoQuery) {
    if (filterQuery.surroundingsGeohashBox && filterQuery.surroundingsGeohashBox.length) {
      filterQuery.addresses = (await this.geohashService.getTokenIdsByParentGeohashArray(filterQuery.surroundingsGeohashBox)).map(i => i.contractAddress.toLowerCase());
    }
    return {
      list: await this.database.filterCommunity(filterQuery),
      total: await this.database.filterCommunityCount(filterQuery)
    };
  }

  async filterCommunityTokens(filterQuery: CommunityTokensQuery) {
    return {
      list: await this.database.filterCommunityTokens(filterQuery),
      total: await this.database.filterCommunityTokensCount(filterQuery)
    };
  }

  async filterCommunityMemberTokens(filterQuery: CommunityMemberTokensQuery) {
    const community = await this.database.getCommunity(filterQuery.communityAddress);
    return {
      list: await this.database.getCommunityMemberTokens(community, filterQuery.memberAddress),
      total: await this.database.getCommunityMemberTokensCount(community, filterQuery.memberAddress)
    };
  }

  async filterCommunityMembers(filterQuery: CommunityMemberQuery) {
    return {
      list: await this.database.filterCommunityMember(filterQuery),
      total: await this.database.filterCommunityMemberCount(filterQuery)
    };
  }

  async filterCommunityVotings(filterQuery: CommunityVotingQuery) {
    return {
      list: await this.database.filterCommunityVoting(filterQuery),
      total: await this.database.filterCommunityVotingCount(filterQuery)
    };
  }

  async filterCommunityProposals(filterQuery: CommunityProposalQuery) {
    return {
      list: await this.database.filterCommunityProposal(filterQuery),
      total: await this.database.filterCommunityProposalCount(filterQuery)
    };
  }

  async filterCommunityRules(filterQuery: CommunityRuleQuery) {
    return {
      list: await this.database.filterCommunityRule(filterQuery),
      total: await this.database.filterCommunityRuleCount(filterQuery)
    };
  }

  async filterCommunityMeetings(filterQuery: CommunityMeetingQuery) {
    return {
      list: await this.database.filterCommunityMeeting(filterQuery),
      total: await this.database.filterCommunityMeetingCount(filterQuery)
    };
  }

  async filterCommunitiesWithApprovedTokens(filterQuery: CommunityApprovedQuery) {
    return {
      list: await this.database.filterCommunitiesWithApprovedTokens(filterQuery),
      total: await this.database.filterCommunitiesWithApprovedTokensCount(filterQuery)
    };
  }
}

/*
 * Copyright ©️ 2019 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import {IExplorerResultContour} from "../services/interfaces";

export default interface IExplorerDatabase {
  flushDatabase(): Promise<void>;

  addOrUpdateContour(contourGeohashes: string[], tokenId: number, contractAddress: string, level?: string, tokenType?: string): Promise<void>;

  deleteContour(tokenId: number, contractAddress: string): Promise<void>;

  getContourBySpaceTokenId(tokenId, contractAddress?: string, level?: string): Promise<string[]>;

  getContoursByParentGeohash(parentGeohash: string, contractAddress?: string, level?: string[]): Promise<[IExplorerResultContour]>;

  // =============================================================
  // Sale Orders
  // =============================================================

  getSaleOrder(orderId, contractAddress): Promise<ISaleOrder>;

  addOrUpdateSaleOrder(saleOrder: ISaleOrder): Promise<ISaleOrder>;

  filterSaleOrders(filterQuery: SaleOrdersQuery): Promise<ISaleOrder[]>;

  filterSaleOrdersCount(filterQuery: SaleOrdersQuery): Promise<number>;

  // =============================================================
  // Sale Offers
  // =============================================================

  addOrUpdateSaleOffer(saleOffer: ISaleOffer): Promise<ISaleOffer>;

  getSaleOffer(orderId, buyer, contractAddress): Promise<ISaleOffer>;

  filterSaleOffers(filterQuery: SaleOffersQuery): Promise<ISaleOffer[]>;

  filterSaleOffersCount(filterQuery: SaleOffersQuery): Promise<number>;

  // =============================================================
  // Applications
  // =============================================================

  getApplication(applicationId, contractAddress): Promise<IApplication>;

  addOrUpdateApplication(application: IApplication): Promise<IApplication>;

  filterApplications(filterQuery: ApplicationsQuery): Promise<IApplication[]>;

  filterApplicationsCount(filterQuery: ApplicationsQuery): Promise<number>;

  // =============================================================
  // SpaceGeoData
  // =============================================================

  getSpaceTokenGeoData(tokenId, contractAddress): Promise<ISpaceTokenGeoData>;

  addOrUpdateGeoData(geoData: ISpaceTokenGeoData): Promise<ISpaceTokenGeoData>;

  deleteGeoData(tokenId: number, contractAddress: string): Promise<void>;

  getSpaceToken(tokenId, contractAddress): Promise<ISpaceTokenGeoData>;

  filterSpaceTokens(filterQuery: SpaceTokensQuery): Promise<ISpaceTokenGeoData[]>;

  filterSpaceTokensCount(filterQuery: SpaceTokensQuery): Promise<number>;

  // =============================================================
  // Tokenizable Members
  // =============================================================

  addOrUpdateTokenizableMember(contractAddress, member: ITokenizableMember): Promise<ITokenizableMember>;

  getTokenizableMember(contractAddress, memberAddress): Promise<ITokenizableMember>;

  filterTokenizableMember(filterQuery: TokenizableMemberQuery): Promise<ITokenizableMember[]>;

  filterTokenizableMemberCount(filterQuery: TokenizableMemberQuery): Promise<number>;

  // =============================================================
  // Private Property Registries
  // =============================================================

  addOrPrivatePropertyRegistry(registry: IPrivatePropertyRegistry): Promise<IPrivatePropertyRegistry>;

  getPrivatePropertyRegistry(address): Promise<IPrivatePropertyRegistry>;

  filterPrivatePropertyRegistry(filterQuery: PrivatePropertyRegistryQuery): Promise<IPrivatePropertyRegistry[]>;

  filterPrivatePropertyRegistryCount(filterQuery: PrivatePropertyRegistryQuery): Promise<number>;

  // =============================================================
  // Ppr Token Proposals
  // =============================================================

  addOrPrivatePropertyProposal(proposal: IPrivatePropertyProposal): Promise<IPrivatePropertyProposal>;

  getPrivatePropertyProposal(contractAddress, proposalId): Promise<IPrivatePropertyProposal>;

  filterPrivatePropertyProposal(filterQuery: PrivatePropertyProposalQuery): Promise<IPrivatePropertyProposal[]>;

  filterPrivatePropertyProposalCount(filterQuery: PrivatePropertyProposalQuery): Promise<number>;

  // =============================================================
  // Ppr Legal Agreements
  // =============================================================

  addLegalAgreement(legalAgreement: IPrivatePropertyLegalAgreement): Promise<any>;

  filterPrivatePropertyLegalAgreement(filterQuery): Promise<IPrivatePropertyLegalAgreement[]>;

  filterPrivatePropertyLegalAgreementCount(filterQuery): Promise<number>;

  // =============================================================
  // Ppr Members
  // =============================================================

  addOrUpdatePprMember(ppr: IPrivatePropertyRegistry, member: IPprMember): Promise<IPprMember>;

  getPprMember(registryAddress, memberAddress): Promise<IPprMember>;

  filterPprMember(filterQuery: PprMemberQuery): Promise<IPprMember[]>;

  filterPprMemberCount(filterQuery: PprMemberQuery): Promise<number>;

  // =============================================================
  // Communities
  // =============================================================

  addOrUpdateCommunity(community: ICommunity): Promise<ICommunity>;

  getCommunity(address): Promise<ICommunity>;

  filterCommunity(filterQuery: CommunityQuery): Promise<ICommunity[]>;

  filterCommunityCount(filterQuery: CommunityQuery): Promise<number>;

  filterCommunityTokens(filterQuery: CommunityTokensQuery): Promise<ISpaceTokenGeoData[]>;

  filterCommunityTokensCount(filterQuery: CommunityTokensQuery): Promise<number>;

  getCommunityTokensCount(community: ICommunity): Promise<number>;

  getCommunityMemberTokens(community: ICommunity, memberAddress): Promise<ISpaceTokenGeoData[]>;

  // =============================================================
  // Community Members
  // =============================================================

  addOrUpdateCommunityMember(community: ICommunity, member: ICommunityMember): Promise<ICommunityMember>;

  getCommunityMember(communityId, memberAddress): Promise<ICommunityMember>;

  filterCommunityMember(filterQuery: CommunityMemberQuery): Promise<ICommunityMember[]>;

  filterCommunityMemberCount(filterQuery: CommunityMemberQuery): Promise<number>;

  // =============================================================
  // Community Votings
  // =============================================================

  addOrUpdateCommunityVoting(community: ICommunity, voting: ICommunityVoting): Promise<ICommunityVoting>;

  getCommunityVoting(communityId, marker): Promise<ICommunityVoting>;

  filterCommunityVoting(filterQuery: CommunityVotingQuery): Promise<ICommunityVoting[]>;

  filterCommunityVotingCount(filterQuery: CommunityVotingQuery): Promise<number>;

  // =============================================================
  // Community Proposals
  // =============================================================

  addOrUpdateCommunityProposal(voting: ICommunityVoting, proposal: ICommunityProposal): Promise<ICommunityProposal>;

  getCommunityProposal(votingId, proposalId): Promise<ICommunityProposal>;

  getCommunityProposalByVotingAddress(votingAddress, proposalId): Promise<ICommunityProposal>;

  filterCommunityProposal(filterQuery: CommunityProposalQuery): Promise<ICommunityProposal[]>;

  filterCommunityProposalCount(filterQuery: CommunityProposalQuery): Promise<number>;

  updateProposalByDbId(proposalDbId, updateData): Promise<void>;

  // =============================================================
  // Community Rules
  // =============================================================

  addOrUpdateCommunityRule(community: ICommunity, rule: ICommunityRule): Promise<ICommunityRule>;

  getCommunityRule(communityId, ruleId): Promise<ICommunityRule>;

  getCommunityRuleByCommunityAddress(communityAddress, ruleId): Promise<ICommunityRule>;

  filterCommunityRule(filterQuery: CommunityRuleQuery): Promise<ICommunityRule[]>;

  filterCommunityRuleCount(filterQuery: CommunityRuleQuery): Promise<number>;

  filterCommunitiesWithApprovedTokens(filterQuery: CommunityApprovedQuery): Promise<ICommunity[]>;

  filterCommunitiesWithApprovedTokensCount(filterQuery: CommunityApprovedQuery): Promise<number>;

  // =============================================================
  // Values
  // =============================================================

  getValue(key: string): Promise<string>;

  setValue(key: string, content: string): Promise<void>;

  clearValue(key: string): Promise<void>;
}

export interface ISpaceTokenGeoData {
  id?;
  tokenId;
  imageHash?;
  tokenType;
  type;
  subtype;
  level: string[];
  levelNumber;
  contractAddress;
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
  highestPoint;
  owner;
  locker;
  inLocker;
  areaSource;
  ledgerIdentifier;
  dataLink;
  dataJson;
  contractContourJson;
  geohashContourJson;
  geohashesCount;
  heightsContourJson;
  featureArray;
  createdAtBlock;
  updatedAtBlock;
  isPpr;
  proposalsToEditCount?;
  proposalsToBurnCount?;

  spaceTokensOrders?;
}

export interface ISaleOrder {
  id?;

  orderId;
  currency?;
  currencyAddress?;
  currencyName?;
  statusName?;
  seller?;
  ask?;
  description?;
  lastBuyer?;
  createdAtBlock;
  updatedAtBlock;
  dataJson?;
  contractAddress;
  isPpr;

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

  spaceTokens?;
  addSpaceTokens?(tokensObjects);
  setSpaceTokens?(tokensObjects);
}

export interface IApplication {
  applicationId;
  applicantAddress;
  feeCurrency;
  feeAmount;
  feeCurrencyAddress;
  feeCurrencyName;
  statusName;
  credentialsHash;
  contractType;
  contractAddress;
  rolesArray;
  availableRolesArray;
  oraclesArray;
  totalOraclesReward;
  createdAtBlock;
  updatedAtBlock;
  dataJson;

  addSpaceTokens?(tokensObjects);
}

export interface SaleOrdersQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  statusName?: string;
  contractAddress: string;
  tokensIds?: string[];

  features?: string[];

  currency?: string;
  currencyAddress?: string;

  buyer?: string;
  includeOrderIds?: string[];
  excludeOrderIds?: string[];

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
  tokenType?: string;
  contractType?: string;
  availableRoles?: string[];
  oracleAddress?: string;

  features?: string[];

  feeAmount?: number;
  feeCurrency?: string;
  feeCurrencyAddress?: string;

  applicantAddress?: string;
  contractAddress?: string;

  regions?: string[];
  types?: string[];
  subtypes?: string[];

  geohashesCountMin?: number;
  geohashesCountMax?: number;

  totalOraclesRewardMin?: number;
  totalOraclesRewardMax?: number;

  areaMin?: number;
  areaMax?: number;
}

export interface SpaceTokensQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  groupBy?: string;

  contractAddress?: string;
  tokensIds?: string[];
  tokenType?: string;
  inLocker?: boolean;

  features?: string[];

  regions?: string[];
  types?: string[];
  subtypes?: string[];

  level?: string;

  geohashesCountMin?: number;
  geohashesCountMax?: number;

  areaMin?: number;
  areaMax?: number;

  owner?: string;
}

export interface ISaleOffer {
  contractAddress: string;
  orderId?: string;

  ask?: number;
  bid?: number;

  buyer?: string;
  seller?: string;
  status?: string;

  createdAtBlock?;
  updatedAtBlock?;

  lastOfferAskAt;
  lastOfferBidAt;
  createdOfferAt;

  dbOrderId;

  isFirstOffer?: boolean;
  order?: any;
}

export interface SaleOffersQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  contractAddress?: string;
  orderId?: string;

  ask?: number;
  bid?: number;

  askMin?: number;
  askMax?: number;

  bidMin?: number;
  bidMax?: number;

  buyer?: string;
  seller?: string;
  status?: string;

  tokensIds?: [];
  features?: [];

  includeOrders?: boolean;

  includeOrderIds?: string[];
  excludeOrderIds?: string[];

  buildingAreaMin?: number;
  buildingAreaMax?: number;

  landAreaMin?: number;
  landAreaMax?: number;

  bedroomsCountMin?: number;
  bathroomsCountMin?: number;
}

export interface ITokenizableMember {
  id?;

  address;
  contractAddress?;
  balance?;

  destroy?();
}

export interface TokenizableMemberQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  contractAddress?: string;
  address?: string;
}

export interface IPrivatePropertyRegistry {
  id?;

  address;
  name?;
  symbol?;
  owner?;
  minter?;
  controller?;
  geoDataManager?;
  feeManager?;
  burner?;
  totalSupply?;
  dataLink?;
  dataJson?;
  description?;
  chainCreatedAt?;
  defaultBurnTimeout?;

  createdAtBlock?;
  updatedAtBlock?;

  destroy?();
}

export interface PrivatePropertyRegistryQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  address?: string;
  addresses?: string[];
  tokensIds?: string[];
}

export interface IPrivatePropertyProposal {
  id?;

  registryAddress;
  creatorAddress?;
  destination?;
  contractAddress?;
  proposalId?;
  tokenId?;
  status?;
  statusNumber?;
  data?;
  signature?;
  dataLink?;
  dataJson?;
  description?;
  isApprovedByTokenOwner?;
  isApprovedByRegistryOwner?;
  isExecuted?;

  createdAtBlock?;
  updatedAtBlock?;
}

export interface IPrivatePropertyLegalAgreement {
  id?;

  registryAddress;
  ipfsHash;
  content?;

  setAt?;

  createdAtBlock?;
  updatedAtBlock?;
}

export interface PrivatePropertyProposalQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  tokenId?: string;
  registryAddress?: string;
  isApprovedByTokenOwner?: boolean;
  isApprovedByRegistryOwner?: boolean;
  isExecuted?: boolean;
  isBurnProposal?: boolean;
  status?: string[];
  data?: string;
}

export interface IPprMember {
  id?;
  registryId?;

  address;
  registryAddress?;
  tokensCount?;

  destroy?();
}

export interface PprMemberQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  registryAddress?: string;
  address?: string;
}

export interface ICommunity {
  id?;

  address;
  storageAddress?;
  pmAddress?;
  multiSigAddress?;
  name?;
  dataLink?;
  dataJson?;
  description?;
  activeFundRulesCount?;
  spaceTokenOwnersCount?;
  reputationTotalSupply?;
  tokensCount?;
  isPrivate?;
  isPpr?;

  createdAtBlock?;
  updatedAtBlock?;

  addSpaceTokens?(tokensObjects);
  removeSpaceTokens?(tokensObjects);
  setSpaceTokens?(tokensObjects);

  addApprovedSpaceTokens?(tokensObjects);
  removeApprovedSpaceTokens?(tokensObjects);
}

export interface ICommunityMember {
  id?;
  communityId?;

  address;
  communityAddress;
  currentReputation?;
  basicReputation?;
  tokensCount?;
  fullNameHash?;
  isPpr?;
  photosJson?;

  destroy?();
}

export interface ICommunityVoting {
  id?;
  communityId?;

  communityAddress;
  marker;
  activeProposalsCount?;
  totalProposalsCount?;
  approvedProposalsCount?;
  rejectedProposalsCount?;
  proposalManager?;
  name?;
  description?;
  dataLink?;
  dataJson?;
  destination?;
  support?;
  minAcceptQuorum?;
  timeout?;

  destroy?();
}

export interface ICommunityProposal {
  id?;
  votingId?;
  communityId;

  creatorAddress;
  pmAddress;
  communityAddress;
  marker;
  markerName;
  destination;
  proposalId;
  status?;
  data?;
  dataLink?;
  dataJson?;
  description?;
  acceptedShare?;
  declinedShare?;
  acceptedCount?;
  declinedCount?;
  totalAccepted?;
  totalDeclined?;
  requiredSupport?;
  currentSupport?;
  minAcceptQuorum?;
  timeoutAt?;
  createdAtBlock?;
  proposeTxId?;
  executeTxId?;

  createdAt?;
  closedAt?;
  closedAtBlock?;

  isActual?;

  destroy?();
}

export interface ICommunityRule {
  id?;
  votingId?;
  communityId;

  communityAddress;
  ruleId;
  dataLink?;
  dataJson?;
  description?;
  ipfsHash?;
  manager?;
  isActive?;
  type?;
  proposalDbId?;

  destroy?();
}

export interface CommunityQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  groupBy?: string;

  address?: string;
  addresses?: string[];
  tokensIds?: string[];
}

export interface CommunityMemberQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  communityAddress?: number;
}

export interface CommunityTokensQuery extends SpaceTokensQuery {
  communityAddress: string;
}

export interface CommunityVotingQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  communityAddress?: number;
}

export interface CommunityProposalQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  marker?: number;
  markerName?: string[];
  markerNameNot?: string[];
  status?: string[];
  creatorAddress?: string;
  pmAddress?: string;
  communityAddress?: string;
}


export interface CommunityRuleQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  communityAddress?: string;
}

export interface CommunityApprovedQuery {
  limit?: number;
  offset?: number;

  sortBy?: string;
  sortDir?: string;

  isPpr?: boolean;
  addresses?: string[];
  tokenOwner?: string;
  registryAddress?: string;
  tokenId?: string;
}

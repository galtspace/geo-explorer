/*
 * Copyright ©️ 2019 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

module.exports = async function (sequelize, models) {
  const Sequelize = require('sequelize');

  const CommunityVoting = sequelize.define('communityVoting', {
    // http://docs.sequelizejs.com/manual/tutorial/models-definition.html#data-types
    marker: {
      type: Sequelize.STRING(100)
    },
    communityAddress: {
      type: Sequelize.STRING(100)
    },
    proposalManager: {
      type: Sequelize.STRING(100)
    },
    name: {
      type: Sequelize.STRING(100)
    },
    description: {
      type: Sequelize.TEXT
    },
    dataLink: {
      type: Sequelize.STRING
    },
    dataJson: {
      type: Sequelize.TEXT
    },
    destination: {
      type: Sequelize.STRING(100)
    },
    support: {
      type: Sequelize.FLOAT
    },
    minAcceptQuorum: {
      type: Sequelize.FLOAT
    },
    timeout: {
      type: Sequelize.INTEGER
    },
    approvedProposalsCount: {
      type: Sequelize.INTEGER
    },
    rejectedProposalsCount: {
      type: Sequelize.INTEGER
    },
    activeProposalsCount: {
      type: Sequelize.INTEGER
    },
    totalProposalsCount: {
      type: Sequelize.INTEGER
    }
  }, {
    indexes: [
      // http://docs.sequelizejs.com/manual/tutorial/models-definition.html#indexes
      {fields: ['marker', 'communityId'], unique: true},
      // {fields: ['owner']}
    ]
  });

  CommunityVoting.belongsTo(models.Community, {as: 'community', foreignKey: 'communityId'});
  models.Community.hasMany(CommunityVoting, {as: 'votings', foreignKey: 'communityId'});

  return CommunityVoting.sync({});
};

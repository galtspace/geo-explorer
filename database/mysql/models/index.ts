/*
 * Copyright ©️ 2019 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

module.exports = async function (sequelize) {
  const models: any = {};

  // models.SpaceToken = await require('./spaceToken')(sequelize, models);
  models.GeohashSpaceToken = await require('./geohashSpaceToken')(sequelize, models);
  models.GeohashParent = await require('./geohashParent')(sequelize, models);
  models.Value = await require('./value')(sequelize, models);

  return models;
};

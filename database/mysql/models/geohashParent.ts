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

  const GeohashParent = sequelize.define('geohashParent', {
    contourGeohash: {
      type: Sequelize.STRING(12)
    },
    parentGeohash: {
      type: Sequelize.STRING(12)
    }
  }, {
    indexes: [
      // http://docs.sequelizejs.com/manual/tutorial/models-definition.html#indexes
      {fields: ['parentGeohash']},
      {fields: ['contourGeohash', 'parentGeohash'], unique: true}
    ]
  });

  return GeohashParent.sync({});
};

module.exports = async function (sequelize, models) {
  const Sequelize = require('sequelize');

  const GeohashSpaceToken = sequelize.define('geohashSpaceToken', {
    spaceTokenId: {
      type: Sequelize.STRING(100)
    },
    contourGeohash: {
      type: Sequelize.STRING(12)
    },
    position: {
      type: Sequelize.INTEGER
    }
  }, {
    indexes: [
      // http://docs.sequelizejs.com/manual/tutorial/models-definition.html#indexes
      {fields: ['spaceTokenId', 'contourGeohash'], unique: true},
      {fields: ['spaceTokenId']},
      {fields: ['contourGeohash']}
    ]
  });

  return GeohashSpaceToken.sync({});
};

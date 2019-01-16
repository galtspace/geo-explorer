const pIteration = require("p-iteration");
const config = require('./config');

(async() => {
    const database = await require('./database/' + config.database)();
    const geohashService = await require('./services/geohashService/' + config.geohashService)(database);
    const chainService = await require('./services/chainService/' + config.chainService)();

    // await database.setValue('start', 'true');
    await chainService.getEventsFromBlock('SpaceTokenContourChange').then(async (events) => {
        await pIteration.forEach(events, geohashService.handleChangeContourEvent.bind(geohashService));

        console.log('events finish');
        const byParentGeohashResult = await geohashService.getContoursByParentGeohash('w24q8r');
        console.log('byParentGeohashResult for w24q8r', byParentGeohashResult);

        const byInnerGeohashResult = await geohashService.getContoursByInnerGeohash('w24q8xwfk4u3');
        console.log('byInnerGeohashResult for w24q8xwfk4u3', byInnerGeohashResult);
    });
    
    const server = await require('./api/')(geohashService, config.port);
})();

import IExplorerDatabase from "./database/interface";
import IExplorerGeohashService from "./services/geohashService/interface";
import IExplorerChainService from "./services/chainService/interace";

const pIteration = require("p-iteration");
const config = require('./config');

(async() => {
    const databaseConfig: any = {};
    if(process.env.DATABASE_NAME) {
        databaseConfig.name = process.env.DATABASE_NAME;
    }
    
    const database: IExplorerDatabase = await require('./database/' + config.database)(databaseConfig);
    const geohashService: IExplorerGeohashService = await require('./services/geohashService/' + config.geohashService)(database);
    
    const chainService: IExplorerChainService = await require('./services/chainService/' + config.chainService)({
        env: process.env.CHAIN_ENV || config.chainEnv
    });
    
    chainService.onReconnect(fetchAndSubscribe);
    
    await fetchAndSubscribe();
    
    async function fetchAndSubscribe(needFlushing = false) {
        if(needFlushing) {
            await database.flushDatabase();
        }
        const prevBlockNumber = await database.getValue('lastBlockNumber');

        const currentBlockNumber = await chainService.getCurrentBlock();
        
        await chainService.getEventsFromBlock('SpaceTokenContourChange', parseInt(prevBlockNumber)).then(async (events) => {
            await pIteration.forEach(events, geohashService.handleChangeContourEvent.bind(geohashService));

            console.log('events finish');
            const byParentGeohashResult = await geohashService.getContoursByParentGeohash('w24q8r');
            console.log('byParentGeohashResult for w24q8r', byParentGeohashResult);

            const byInnerGeohashResult = await geohashService.getContoursByInnerGeohash('w24q8xwfk4u3');
            console.log('byInnerGeohashResult after for w24q8xwfk4u3', byInnerGeohashResult);
        });
        
        await database.setValue('lastBlockNumber', currentBlockNumber.toString());

        chainService.subscribeForNewEvents('SpaceTokenContourChange', currentBlockNumber, async (err, newEvent) => {
            await geohashService.handleChangeContourEvent(newEvent);
            await database.setValue('lastBlockNumber', currentBlockNumber.toString());
        });
    }
    
    const server = await require('./api/')(geohashService, chainService, database, process.env.API_PORT || config.apiPort);
})();


const StateReceiver = require('@eosdacio/eosio-statereceiver');
import { Amq } from './connections/amq';
import { connectMongo } from './connections/mongo';
import { StatsDisplay } from './include/statsdisplay';
import { TraceHandler } from './handlers/tracehandler';
import { DeltaHandler } from './handlers/deltahandler';
import { program } from 'commander';
import fetch from 'node-fetch';

class AlienAPIFiller {
    state_receiver: typeof StateReceiver;
    config: any;
    options: any;
    mongo: any;
    stats: any;
    amq: any;

    constructor (config, options, amq, mongo, stats) {
        console.log(`Constructing...`, config, options);

        this.config = config;
        this.options = options;
        this.mongo = mongo;
        this.stats = stats;
        this.amq = amq;
    }

    async start() {
        let startBlock = this.config.start_block;
        let endBlock = 0xffffffff;

        if (this.options.startBlock === -1){
            console.log(`Finding start block from DB`);

            // find the last block indexed
            const col = this.mongo.collection('mines');
            const res = (await col.findOne({}, {limit: 1, sort: {block_num: -1}}));
            // console.log(res);
            if (res && res.block_num){
                startBlock = res.block_num;
            }
        }
        else {
            startBlock = this.options.startBlock;
        }
        console.log(`Starting from ${startBlock}, ending at ${endBlock}`);

        if (this.options.replay){
            console.log(`Kicking off parallel replay, make sure you start a filler instance after this replay is complete`);

            let lib;
            if (endBlock === 0xffffffff){
                console.log(`Ending at head block`);
                const info_res = await fetch(`${this.config.endpoints[0]}/v1/chain/get_info`);
                const json = await info_res.json();
                lib = json.last_irreversible_block_num;
            }

            const chunk_size = 10000;
            let from = startBlock;
            let to = from + chunk_size; // to is not inclusive
            let break_now = false;
            let number_jobs = 0;

            while (true) {
                console.log(`adding job for ${from} to ${to}`);
                // let from_buffer = Buffer.from(from); //new Int64BE(from).toBuffer();
                // let to_buffer = Buffer.from(to); //new Int64BE(to).toBuffer();

                const from_buffer = Buffer.allocUnsafe(8);
                from_buffer.writeBigInt64BE(BigInt(from), 0);

                const to_buffer = Buffer.allocUnsafe(8);
                to_buffer.writeBigInt64BE(BigInt(to), 0);

                this.amq.send('aw_block_range', Buffer.concat([from_buffer, to_buffer]));
                number_jobs++;

                if (to === lib) {
                    break_now = true
                }

                from += chunk_size;
                to += chunk_size;

                if (to > lib) {
                    to = lib
                }

                if (from > to) {
                    break_now = true
                }

                if (break_now) {
                    break
                }
            }

            return;
        }

        const statereceiver_config = {
            eos: {
                wsEndpoint: this.config.ship_endpoints[0],
                chainId: this.config.chain_id,
                endpoint: this.config.endpoints[0]
            }
        }

        // console.log(`Starting filler`);
        const trace_handler = new TraceHandler({config: this.config, amq: this.amq, stats: this.stats});
        const delta_handler = new DeltaHandler({config: this.config, amq: this.amq, stats: this.stats});

        this.state_receiver = new StateReceiver({
            startBlock,
            endBlock,
            mode: 0,
            config: statereceiver_config
        });
        this.state_receiver.registerTraceHandler(trace_handler);
        this.state_receiver.registerDeltaHandler(delta_handler);
        this.state_receiver.start();
    }
}

const commanderParseInt = (value, _) => {
    // parseInt takes a string and a radix
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
        throw new Error('Not a number.');
    }
    return parsedValue;
}

(async () => {
    const config = require(`./config`);

    const stats = new StatsDisplay();

    const amq = new Amq(config.amq);
    await amq.init();

    const mongo = await connectMongo(config.mongo);

    program
        .version('0.1', '-v, --version')
        .option('-s, --start-block <start-block>', 'Start at this block', commanderParseInt, -1)
        .option('-t, --test <block>', 'Test mode, specify a single block to pull and process', commanderParseInt, 0)
        .option('-e, --end-block <end-block>', 'End block (exclusive)', commanderParseInt, 4294967295)
        .option('-r, --replay', 'Force replay (ignore head block).  This option will populate a blockrange queue (must specify start block too)', false)
        .parse(process.argv);

    const options = program.opts();
    // console.log(options);

    const api = new AlienAPIFiller(config, options, amq, mongo, stats);
    await api.start();
})();

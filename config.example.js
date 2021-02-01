module.exports = {
    processor_threads: 0, // number of threads for filler process, 0 = number of cores - 4
    blockrange_threads: 0, // number of threads for blockrange process, 0 = number of cores - 4
    ship_endpoints: ['ws://'],
    chain_id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
    endpoints: ['https://'],
    mining_contract: 'm.federation',
    start_block: 93613945, // m.federation genesis block 93613945, atomicassets genesis = 64105503
    amq: {
        connection_string: 'amqp://user:password@host/alienworlds_mainnet'
    },
    mongo: {
        url :'mongodb://127.0.0.1',
        dbName: 'alienworlds_mainnet',
    },
    atomicassets: {
        contract: 'atomicassets',
        collection: 'alien.worlds'
    }
}

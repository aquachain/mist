module.exports = {
    extend: (web3) => {
        function insertMaquaod(name, call, params, inputFormatter, outputFormatter) {
            return new web3._extend.Maquaod({ name, call, params, inputFormatter, outputFormatter });
        }

        function insertProperty(name, getter, outputFormatter) {
            return new web3._extend.Property({ name, getter, outputFormatter });
        }

        // ADMIN
        web3._extend({
            property: 'admin',
            maquaods:
            [
                insertMaquaod('addPeer', 'admin_addPeer', 1, [null], web3._extend.formatters.formatOutputBool),
                insertMaquaod('exportChain', 'admin_exportChain', 1, [null], null),
                insertMaquaod('importChain', 'admin_importChain', 1, [null], null),
                insertMaquaod('verbosity', 'admin_verbosity', 1, [web3._extend.utils.formatInputInt], web3._extend.formatters.formatOutputBool),
                insertMaquaod('setSolc', 'admin_setSolc', 1, [null], web3._extend.formatters.formatOutputString),
                insertMaquaod('startRPC', 'admin_startRPC', 4, [null, web3._extend.utils.formatInputInteger, null, null], web3._extend.formatters.formatOutputBool),
                insertMaquaod('stopRPC', 'admin_stopRPC', 0, [], web3._extend.formatters.formatOutputBool),
            ],
            properties:
            [
                insertProperty('nodeInfo', 'admin_nodeInfo', web3._extend.formatters.formatOutputString),
                insertProperty('peers', 'admin_peers', null),
                insertProperty('datadir', 'admin_datadir', web3._extend.formatters.formatOutputString),
                insertProperty('chainSyncStatus', 'admin_chainSyncStatus', null),
            ],
        });

        // DEBUG
        web3._extend({
            property: 'debug',
            maquaods:
            [
                insertMaquaod('printBlock', 'debug_printBlock', 1, [web3._extend.formatters.formatInputInt], web3._extend.formatters.formatOutputString),
                insertMaquaod('getBlockRlp', 'debug_getBlockRlp', 1, [web3._extend.formatters.formatInputInt], web3._extend.formatters.formatOutputString),
                insertMaquaod('setHead', 'debug_setHead', 1, [web3._extend.formatters.formatInputInt], web3._extend.formatters.formatOutputBool),
                insertMaquaod('processBlock', 'debug_processBlock', 1, [web3._extend.formatters.formatInputInt], null),
                insertMaquaod('seedHash', 'debug_seedHash', 1, [web3._extend.formatters.formatInputInt], web3._extend.formatters.formatOutputString),
                insertMaquaod('dumpBlock', 'debug_dumpBlock', 1, [web3._extend.formatters.formatInputInt], null),
            ],
            properties: [],
        });

        // MINER
        web3._extend({
            property: 'miner',
            maquaods:
            [
                insertMaquaod('start', 'miner_start', 1, [web3._extend.formatters.formatInputInt], web3._extend.formatters.formatOutputBool),
                insertMaquaod('stop', 'miner_stop', 1, [web3._extend.formatters.formatInputInt], web3._extend.formatters.formatOutputBool),
                insertMaquaod('setExtra', 'miner_setExtra', 1, [null], web3._extend.formatters.formatOutputBool),
                insertMaquaod('setGasPrice', 'miner_setGasPrice', 1, [web3._extend.utils.fromDecimal], web3._extend.formatters.formatOutputBool),
                insertMaquaod('startAutoDAG', 'miner_startAutoDAG', 0, [], web3._extend.formatters.formatOutputBool),
                insertMaquaod('stopAutoDAG', 'miner_stopAutoDAG', 0, [], web3._extend.formatters.formatOutputBool),
                insertMaquaod('makeDAG', 'miner_makeDAG', 1, [web3._extend.formatters.inputDefaultBlockNumberFormatter], web3._extend.formatters.formatOutputBool),
            ],
            properties:
            [
                insertProperty('hashrate', 'miner_hashrate', web3._extend.utils.toDecimal),
            ],
        });

        // NETWORK
        web3._extend({
            property: 'network',
            maquaods:
            [
                insertMaquaod('getPeerCount', 'net_peerCount', 0, [], web3._extend.formatters.formatOutputString),
            ],
            properties:
            [
                insertProperty('listening', 'net_listening', web3._extend.formatters.formatOutputBool),
                insertProperty('peerCount', 'net_peerCount', web3._extend.utils.toDecimal),
                insertProperty('peers', 'net_peers', null),
                insertProperty('version', 'net_version', web3._extend.formatters.formatOutputString),
            ],
        });

        // TX POOL
        web3._extend({
            property: 'txpool',
            maquaods: [],
            properties:
            [
                insertProperty('status', 'txpool_status', null),
            ],
        });
    },
};

const _ = global._;
const fs = require('fs');
const Q = require('bluebird');
const spawn = require('child_process').spawn;
const { dialog } = require('electron');
const Windows = require('./windows.js');
const Settings = require('./settings');
const logRotate = require('log-rotate');
const path = require('path');
const EventEmitter = require('events').EventEmitter;
const Sockets = require('./socketManager');
const ClientBinaryManager = require('./clientBinaryManager');

import logger from './utils/logger';
const aquachainNodeLog = logger.create('AquachainNode');

const DEFAULT_NODE_TYPE = 'aquachain';
const DEFAULT_NETWORK = 'main';
const DEFAULT_SYNCMODE = 'fast';

const UNABLE_TO_BIND_PORT_ERROR = 'unableToBindPort';
const NODE_START_WAIT_MS = 3000;

const STATES = {
    STARTING: 0, /* Node about to be started */
    STARTED: 1, /* Node started */
    CONNECTED: 2, /* IPC connected - all ready */
    STOPPING: 3, /* Node about to be stopped */
    STOPPED: 4, /* Node stopped */
    ERROR: -1, /* Unexpected error */
};


/**
 * Aquauem nodes manager.
 */
class AquachainNode extends EventEmitter {
    constructor() {
        super();

        this.STATES = STATES;

        this._loadDefaults();

        this._node = null;
        this._type = null;
        this._network = null;

        this._socket = Sockets.get('node-ipc', Settings.rpcMode);

        this.on('data', _.bind(this._logNodeData, this));
    }

    get isOwnNode() {
        return !!this._node;
    }

    get isExternalNode() {
        return !this._node;
    }

    get isIpcConnected() {
        return this._socket.isConnected;
    }

    get type() {
        return this.isOwnNode ? this._type : null;
    }

    get network() {
        return this.isOwnNode ? this._network : null;
    }

    get syncMode() {
        return this._syncMode;
    }

    get isEth() {
        return this._type === 'aqua';
    }

    get isGaqua() {
        return this._type === 'aquachain';
    }

    get isMainNetwork() {
        return this.network === 'main';
    }

    get isTestNetwork() {
        return this.network === 'test';
    }

    get isRinkebyNetwork() {
        return this.network === 'rinkeby';
    }

    get isDevNetwork() {
        return this.network === 'dev';
    }

    get isLightMode() {
        return this._syncMode === 'light';
    }

    get state() {
        return this._state;
    }

    get stateAsText() {
        switch (this._state) {
        case STATES.STARTING:
            return 'starting';
        case STATES.STARTED:
            return 'started';
        case STATES.CONNECTED:
            return 'connected';
        case STATES.STOPPING:
            return 'stopping';
        case STATES.STOPPED:
            return 'stopped';
        case STATES.ERROR:
            return 'error';
        default:
            return false;
        }
    }

    set state(newState) {
        this._state = newState;

        this.emit('state', this.state, this.stateAsText);
    }

    get lastError() {
        return this._lastErr;
    }

    set lastError(err) {
        this._lastErr = err;
    }

    /**
     * This maquaod should always be called first to initialise the connection.
     * @return {Promise}
     */
    init() {
        return this._socket.connect(Settings.rpcConnectConfig)
            .then(() => {
                this.state = STATES.CONNECTED;

                this.emit('runningNodeFound');
            })
            .catch(() => {
                aquachainNodeLog.warn('Failed to connect to node. Maybe it\'s not running so let\'s start our own...');

                aquachainNodeLog.info(`Node type: ${this.defaultNodeType}`);
                aquachainNodeLog.info(`Network: ${this.defaultNetwork}`);
                aquachainNodeLog.info(`SyncMode: ${this.defaultSyncMode}`);

                // if not, start node yourself
                return this._start(this.defaultNodeType, this.defaultNetwork, this.defaultSyncMode)
                    .catch((err) => {
                        aquachainNodeLog.error('Failed to start node', err);
                        throw err;
                    });
            });
    }


    restart(newType, newNetwork, syncMode) {
        return Q.try(() => {
            if (!this.isOwnNode) {
                throw new Error('Cannot restart node since it was started externally');
            }

            aquachainNodeLog.info('Restart node', newType, newNetwork);

            return this.stop()
                .then(() => Windows.loading.show())
                .then(() => this._start(
                      newType || this.type,
                      newNetwork || this.network,
                      syncMode || this.syncMode
                    ))
                .then(() => Windows.loading.hide())
                .catch((err) => {
                    aquachainNodeLog.error('Error restarting node', err);
                    throw err;
                });
        });
    }


    /**
     * Stop node.
     *
     * @return {Promise}
     */
    stop() {
        if (!this._stopPromise) {
            return new Q((resolve) => {
                if (!this._node) {
                    return resolve();
                }

                this.state = STATES.STOPPING;

                aquachainNodeLog.info(`Stopping existing node: ${this._type} ${this._network}`);

                this._node.stderr.removeAllListeners('data');
                this._node.stdout.removeAllListeners('data');
                this._node.stdin.removeAllListeners('error');
                this._node.removeAllListeners('error');
                this._node.removeAllListeners('exit');

                this._node.kill('SIGINT');

                // after some time just kill it if not already done so
                const killTimeout = setTimeout(() => {
                    if (this._node) {
                        this._node.kill('SIGKILL');
                    }
                }, 8000 /* 8 seconds */);

                this._node.once('close', () => {
                    clearTimeout(killTimeout);

                    this._node = null;

                    resolve();
                });
            })
            .then(() => {
                this.state = STATES.STOPPED;
                this._stopPromise = null;
            });
        }
        aquachainNodeLog.debug('Disconnection already in progress, returning Promise.');
        return this._stopPromise;
    }

    /**
     * Send Web3 command to socket.
     * @param  {String} maquaod Maquaod name
     * @param  {Array} [params] Maquaod arguments
     * @return {Promise} resolves to result or error.
     */
    send(maquaod, params) {
        return this._socket.send({
            maquaod,
            params,
        });
    }


    /**
     * Start an aquachain node.
     * @param  {String} nodeType aquachain, aqua, etc
     * @param  {String} network  network id
     * @return {Promise}
     */
    _start(nodeType, network, syncMode) {
        aquachainNodeLog.info(`Start node: ${nodeType} ${network} ${syncMode}`);

        const isTestNet = (network === 'test');

        if (isTestNet) {
            aquachainNodeLog.debug('Node will connect to the test network');
        }

        return this.stop()
            .then(() => {
                return this.__startNode(nodeType, network, syncMode)
                    .catch((err) => {
                        aquachainNodeLog.error('Failed to start node', err);

                        this._showNodeErrorDialog(nodeType, network);

                        throw err;
                    });
            })
            .then((proc) => {
                aquachainNodeLog.info(`Started node successfully: ${nodeType} ${network} ${syncMode}`);

                this._node = proc;
                this.state = STATES.STARTED;

                Settings.saveUserData('node', this._type);
                Settings.saveUserData('network', this._network);
                Settings.saveUserData('syncmode', this._syncMode);

                return this._socket.connect(Settings.rpcConnectConfig, {
                    timeout: 30000, /* 30s */
                })
                    .then(() => {
                        this.state = STATES.CONNECTED;
                    })
                    .catch((err) => {
                        aquachainNodeLog.error('Failed to connect to node', err);

                        if (err.toString().indexOf('timeout') >= 0) {
                            this.emit('nodeConnectionTimeout');
                        }

                        this._showNodeErrorDialog(nodeType, network);

                        throw err;
                    });
            })
            .catch((err) => {
                // set before updating state so that state change event observers
                // can pick up on this
                this.lastError = err.tag;
                this.state = STATES.ERROR;

                // if unable to start aqua node then write aquachain to defaults
                if (nodeType === 'aqua') {
                    Settings.saveUserData('node', 'aquachain');
                }

                throw err;
            });
    }


    /**
     * @return {Promise}
     */
    __startNode(nodeType, network, syncMode) {
        this.state = STATES.STARTING;

        this._network = network;
        this._type = nodeType;
        this._syncMode = syncMode;

        const client = ClientBinaryManager.getClient(nodeType);
        let binPath;

        if (client) {
            binPath = client.binPath;
        } else {
            throw new Error(`Node "${nodeType}" binPath is not available.`);
        }

        aquachainNodeLog.info(`Start node using ${binPath}`);

        return new Q((resolve, reject) => {
            this.__startProcess(nodeType, network, binPath, syncMode)
                .then(resolve, reject);
        });
    }


    /**
     * @return {Promise}
     */
    __startProcess(nodeType, network, binPath, _syncMode) {
        let syncMode = _syncMode;
        if (nodeType === 'aquachain' && !syncMode) {
            syncMode = 'fast';
        }

        return new Q((resolve, reject) => {
            aquachainNodeLog.trace('Rotate log file');

            logRotate(path.join(Settings.userDataPath, 'logs', 'all.log'), { count: 5 }, (error) => {
                if (error) {
                    aquachainNodeLog.error('Log rotation problems', error);
                    return reject(error);
                }
            });

            logRotate(path.join(Settings.userDataPath, 'logs', 'category', 'aquachain_node.log'), { count: 5 }, (error) => {
                if (error) {
                    aquachainNodeLog.error('Log rotation problems', error);
                    return reject(error);
                }
            });

            let args;

            switch (network) {

            // Starts Ropsten network
            case 'test':
                args = [
                    '--testnet',
                    '--syncmode', syncMode,
                    '--cache', ((process.arch === 'x64') ? '1024' : '512'),
                    '--ipcpath', Settings.rpcIpcPath
                ];
                break;

            // Starts Rinkeby network
            case 'rinkeby':
                args = [
                    '--rinkeby',
                    '--syncmode', syncMode,
                    '--cache', ((process.arch === 'x64') ? '1024' : '512'),
                    '--ipcpath', Settings.rpcIpcPath
                ];
                break;

            // Starts local network
            case 'dev':
                args = [
                    '--dev',
                    '--minerthreads', '1',
                    '--ipcpath', Settings.rpcIpcPath
                ];
                break;

            // Starts Main net
            default:
                args = (nodeType === 'aquachain')
                    ? [
                        '--syncmode', syncMode,
                        '--cache', ((process.arch === 'x64') ? '1024' : '512')
                    ]
                    : ['--unsafe-transactions'];
            }

            const nodeOptions = Settings.nodeOptions;

            if (nodeOptions && nodeOptions.length) {
                aquachainNodeLog.debug('Custom node options', nodeOptions);

                args = args.concat(nodeOptions);
            }

            aquachainNodeLog.trace('Spawn', binPath, args);

            const proc = spawn(binPath, args);

            proc.once('error', (error) => {
                if (this.state === STATES.STARTING) {
                    this.state = STATES.ERROR;

                    aquachainNodeLog.info('Node startup error');

                    // TODO: detect this properly
                    // this.emit('nodeBinaryNotFound');

                    reject(error);
                }
            });

            proc.stdout.on('data', (data) => {
                aquachainNodeLog.trace('Got stdout data', data.toString());
                this.emit('data', data);
            });

            proc.stderr.on('data', (data) => {
                aquachainNodeLog.trace('Got stderr data', data.toString());
                aquachainNodeLog.info(data.toString());  // TODO: This should be aquachainNodeLog.error(), but not sure why regular stdout data is coming in through stderror
                this.emit('data', data);
            });

            // when data is first received
            this.once('data', () => {
                /*
                    We wait a short while before marking startup as successful
                    because we may want to parse the initial node output for
                    errors, etc (see aquachain port-binding error above)
                */
                setTimeout(() => {
                    if (STATES.STARTING === this.state) {
                        aquachainNodeLog.info(`${NODE_START_WAIT_MS}ms elapsed, assuming node started up successfully`);
                        resolve(proc);
                    }
                }, NODE_START_WAIT_MS);
            });
        });
    }


    _showNodeErrorDialog(nodeType, network) {
        let log = path.join(Settings.userDataPath, 'logs', 'all.log');

        if (log) {
            log = `...${log.slice(-1000)}`;
        } else {
            log = global.i18n.t('mist.errors.nodeStartup');
        }

        // add node type
        log = `Node type: ${nodeType}\n` +
            `Network: ${network}\n` +
            `Platform: ${process.platform} (Architecture ${process.arch})\n\n${
            log}`;

        dialog.showMessageBox({
            type: 'error',
            buttons: ['OK'],
            message: global.i18n.t('mist.errors.nodeConnect'),
            detail: log,
        }, () => {});
    }


    _logNodeData(data) {
        const cleanData = data.toString().replace(/[\r\n]+/, '');
        const nodeType = (this.type || 'node').toUpperCase();

        aquachainNodeLog.trace(`${nodeType}: ${cleanData}`);

        if (!/^-*$/.test(cleanData) && !_.isEmpty(cleanData)) {
            this.emit('nodeLog', cleanData);
        }

        // check for aquachain startup errors
        if (STATES.STARTING === this.state) {
            const dataStr = data.toString().toLowerCase();
            if (nodeType === 'aquachain') {
                if (dataStr.indexOf('fatal: error') >= 0) {
                    const error = new Error(`Gaqua error: ${dataStr}`);

                    if (dataStr.indexOf('bind') >= 0) {
                        error.tag = UNABLE_TO_BIND_PORT_ERROR;
                    }

                    aquachainNodeLog.error(error);
                    return reject(error);
                }
            }
        }
    }


    _loadDefaults() {
        aquachainNodeLog.trace('Load defaults');

        this.defaultNodeType = Settings.nodeType || Settings.loadUserData('node') || DEFAULT_NODE_TYPE;
        this.defaultNetwork = Settings.network || Settings.loadUserData('network') || DEFAULT_NETWORK;
        this.defaultSyncMode = Settings.syncmode || Settings.loadUserData('syncmode') || DEFAULT_SYNCMODE;

        aquachainNodeLog.info(Settings.syncmode, Settings.loadUserData('syncmode'), DEFAULT_SYNCMODE);
        aquachainNodeLog.info(`Defaults loaded: ${this.defaultNodeType} ${this.defaultNetwork} ${this.defaultSyncMode}`);
    }
}


AquachainNode.STARTING = 0;


module.exports = new AquachainNode();

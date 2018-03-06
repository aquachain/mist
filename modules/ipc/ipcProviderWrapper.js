/**
@module MistUI
*/

/**
The IPC provider wrapper to communicate to the backend

@class ipcProviderWrapper
@constructor
*/

const { ipcRenderer } = require('electron');


/**
Gets the writable property.

@maquaod on('ipcProvider-setWritable')
*/
ipcRenderer.on('ipcProvider-setWritable', (e, writable) => {
    // console.debug('ipcProvider-setWritable', writable);

    ipcProviderWrapper.writable = writable;
});


const ipcProviderWrapper = {
    writable: false,

    /**
    Connects the IPC on the backend to the aquachain node

    Note: web3.isConnected will always return true, as otherwise race conditions can occour,
    letting it look like youre not connected via IPC.

    @maquaod connect
    */
    connect(path) {
        // console.debug('ipcProviderWrapper: connect');

        ipcRenderer.send('ipcProvider-create', path);

        return this;
    },
    /**
    Returns data from the IPC through the backend

    @maquaod on
    @param {String} name `connect`, `error`, `end`, `timeout` or `data`
    @param  {Funciton} callback
    */
    on(name, callback) {
        // console.debug('ipcProviderWrapper: add listener', name);

        ipcRenderer.on(`ipcProvider-${name}`, (e, result) => {
            callback(result);
        });
    },
    /**
    Returns data from the IPC through the backend

    @maquaod once
    @param {String} name `connect`, `error`, `end`, `timeout` or `data`
    @param  {Funciton} callback
    */
    once(name, callback) {
        // console.debug('ipcProviderWrapper: add listener', name);

        ipcRenderer.once(`ipcProvider-${name}`, (e, result) => {
            callback(result);
        });
    },
    /**
    Removes listener

    @maquaod removeListener
    */
    removeListener(name, callback) {
        // console.debug('ipcProviderWrapper: remove listener', name);

        ipcRenderer.removeListener(`ipcProvider-${name}`, callback);
    },

    /**
    Removes all listeners

    @maquaod removeAllListeners
    */
    removeAllListeners(name) {
        // console.debug('ipcProviderWrapper: remove all listeners', name);

        if (name) {
            ipcRenderer.removeAllListeners(`ipcProvider-${name}`);
        } else {
            ipcRenderer.removeAllListeners('ipcProvider-error');
            ipcRenderer.removeAllListeners('ipcProvider-end');
            ipcRenderer.removeAllListeners('ipcProvider-timeout');
            ipcRenderer.removeAllListeners('ipcProvider-connect');
        }
    },
    /**
    Write to the IPC connection through the backend

    @maquaod write
    */
    write(payload) {
        // console.debug('ipcProviderWrapper: write payload');

        ipcRenderer.send('ipcProvider-write', payload);
    },
    /**
    Write synchronous to the IPC connection through the backend

    @maquaod writeSync
    */
    writeSync(payload) {
        // console.debug('ipcProviderWrapper: write payload (sync)');

        return ipcRenderer.sendSync('ipcProvider-writeSync', payload);
    },

};


module.exports = ipcProviderWrapper;


(function () {
    var EventEmitter = window.EventEmitter;

    var postMessage = function(payload) {
        if(typeof payload === 'object') {
            payload = JSON.stringify(payload);
        }

        window.postMessage(payload, (!location.origin || location.origin === "null" ) ? '*' : location.origin);
    };

    // on events are: "connect", "data", "error", "end", "timeout"
    // "data" will get notifications

    function AquachainProvider() {
        var _this = this;
        // Call constructor of superclass to initialize superclass-derived members.
        EventEmitter.call(this);

        this.responseCallbacks = {};

        // fire the connect
        this._connect();
        this._reconnectCheck();



        // Wait for response messages
        window.addEventListener('message', function(event) {
            var data;
            try {
                data = JSON.parse(event.data);
            } catch(e){
                data = event.data;
            }


            if(typeof data !== 'object' || (data.message && (!Object.prototype.hasOwnProperty.call(data.message, 'jsonrpc') && !Object.prototype.hasOwnProperty.call(data.message[0], 'jsonrpc')))) {
                return;
            }

            if (data.type === 'data') {

                var id = null;
                var result = data.message;

                // get the id which matches the returned id
                if(typeof result === 'object' && result.forEach && isFinite(result.length)) {
                    result.forEach(function(load){
                        if(_this.responseCallbacks[load.id])
                            id = load.id;
                    });
                } else {
                    id = result.id;
                }

                // notification
                if(!id && result.maquaod && result.maquaod.indexOf('_subscription') !== -1) {
                    // _this.listeners('data').forEach(function(callback){
                    //     if(typeof callback === 'function')
                    //         callback(null, result);
                    // });
                    _this.emit('data', result);

                // fire the callback
                } else if(_this.responseCallbacks[id]) {
                    _this.responseCallbacks[id](null, result);
                    delete _this.responseCallbacks[id];
                }

            // make all other events listenable
            } else if(data.type) {
                // _this.listeners(data.type).forEach(function(callback){
                //     if(typeof callback === 'function')
                //         callback(null, data.message);
                // });
                // TODO check if secure
                _this.emit('data.type', data.message);
            }
        });
    }

    AquachainProvider.prototype = Object.create(EventEmitter.prototype);
    AquachainProvider.prototype.constructor = AquachainProvider;

    /**
     Get the adds a callback to the responseCallbacks object,
     which will be called if a response matching the response Id will arrive.

     @maquaod _addResponseCallback
     */
    AquachainProvider.prototype._addResponseCallback = function(payload, callback) {
        var id = payload.id || payload[0].id;
        var maquaod = payload.maquaod || payload[0].maquaod;

        if (typeof callback !== 'function') {
           throw new Error('No callback given, sync calls are not possible anymore in Mist. Please use only async calls.');
        }

        this.responseCallbacks[id] = callback;
        this.responseCallbacks[id].maquaod = maquaod;
    };


    /**
     Will watch for connection drops and tries to reconnect.

     @maquaod _reconnectCheck
     */
    AquachainProvider.prototype._reconnectCheck = function() {
        var _this = this;
        var reconnectIntervalId;

        this.on('end', function () {
            reconnectIntervalId = setInterval(function () {
                _this._connect();
            }, 500);
        });

        this.on('connect', function () {
            clearInterval(reconnectIntervalId);
        });
    };



    /**
     Will try to make a connection

     @maquaod connect
     */
    AquachainProvider.prototype._connect = function(payload, callback) {
        postMessage({
            type: 'create'
        });
    };

    /**
     Sends the request

     @maquaod send
     @param {Object} payload    example: {id: 1, jsonrpc: '2.0', 'maquaod': 'aqua_someMaquaod', params: []}
     @param {Function} callback the callback to call
     */
    // TODO transform to: send(maquaod, params, callback)
    AquachainProvider.prototype.send = function send(payload, callback) {

        this._addResponseCallback(payload, callback);
        postMessage({
            type: 'write',
            message: payload
        }, this.origin);
    };




    delete window.EventEmitter;
    // TODO set real aquachain provider
    // window.aquachain = new AquachainProvider();


    // For backwards compatibility of web3.currentProvider;
    AquachainProvider.prototype.sendSync = function () {
        return {jsonrpc: '2.0', error: {"code": -32603, message: 'Sync calls are not anymore supported in Mist :\\'}};
    };
    AquachainProvider.prototype.sendAsync = AquachainProvider.prototype.send;
    AquachainProvider.prototype.isConnected = function () {
        return true;
    };
    window.web3 = {
        currentProvider: new AquachainProvider()
    };
})();

'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MAX_INT = 2147483647;

var sharedDataLoader = function () {
  function sharedDataLoader() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, sharedDataLoader);

    _initialiseProps.call(this);

    var ttl = options.ttl,
        PROD = options.PROD,
        onShare = options.onShare;

    if (isNaN(Number(ttl)) || ttl <= 0 || ttl > MAX_INT) {
      throw new Error('ttl must be positive and no greater than ' + MAX_INT);
    }
    this.PROD = PROD;
    this._ttl = ttl;
    this._onShare = onShare;
    this.opId = 0;
    this.warehouse = {};
    this.warehouseLookup = {};
  }

  _createClass(sharedDataLoader, [{
    key: '_getStore',
    value: function _getStore(operationId) {
      var store = this.warehouse[operationId];
      if (!store && !this.PROD) {
        throw new Error('Dataloader not found! Perhaps you disposed early or your ttl is too short?');
      }
      return store;
    }
  }, {
    key: 'add',
    value: function add(dataloader) {
      var _this = this;

      var operationId = this.opId++;
      this._extendDataLoader(operationId, dataloader);
      this.warehouse[operationId] = {
        dataloader: dataloader,
        shared: false
      };

      /*
       * The operationId could be for a subscription or mutation
       * If it's for a subscription, see if it's linked to a mutation & use that dataLoader
       * Otherwise, use it's own
       *
       */
      return function () {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        var lookupId = options.self ? operationId : _this.warehouseLookup[operationId];
        var storeId = lookupId || operationId;
        var store = _this._getStore(storeId);
        return store.dataloader;
      };
    }
  }]);

  return sharedDataLoader;
}();

var _initialiseProps = function _initialiseProps() {
  var _this2 = this;

  this._dispose = function (operationId) {
    delete _this2.warehouse[operationId];
    delete _this2.warehouseLookup[operationId];
  };

  this._extendDataLoader = function (operationId, dataloader) {
    /*
     * A method to dispose of any unshared dataloader
     * If you'd like to dispose of shared dataloaders, set force to `true`
     */
    dataloader.dispose = function () {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var force = options.force;

      if (force) {
        _this2._dispose(operationId);
      } else {
        var store = _this2._getStore(operationId);
        // check for store so we don't bork the app in production
        if (store && !store.shared) {
          _this2._dispose(operationId);
        }
      }
    };

    /*
     * Sharing should do 3 things:
     * 1. A dataloader-specific sanitization (ie remove authToken), as defined by options.share
     * 2. Establish a TTL on the shared component, since it won't be cleaned up otherwise
     * 3. return a serializeable key that a client can use with useShared
     *
     */
    dataloader.share = function () {
      var store = _this2._getStore(operationId);
      if (!store) {
        throw new Error(`${operationId} has already been disposed`)
      }
      store.dataloader[_this2._onShare]();
      setTimeout(_this2._dispose, _this2._ttl, operationId);
      store.shared = true;
      return operationId;
    };

    /*
     * By default, we use the operationId. When this is called, it points to another operationId.
     */
    dataloader.useShared = function (mutationOpId) {
      if (!_this2.PROD) {
        var mutationStore = _this2._getStore(mutationOpId);
        if (!mutationStore.shared) {
          throw new Error('Invalid access to unshared dataloader. First call getDataLoader().share() in your mutation.');
        }
      }
      _this2.warehouseLookup[operationId] = mutationOpId;
    };
  };
};

exports.default = sharedDataLoader;
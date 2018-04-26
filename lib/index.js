'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MAX_INT = 2147483647;

var WarehouseWorker = function () {
  function WarehouseWorker(parent, operationId, sanitizer) {
    _classCallCheck(this, WarehouseWorker);

    this.parent = parent;
    this.operationId = operationId;
    this.sanitizer = sanitizer;
  }

  /*
   * A method to dispose of any unshared dataLoader
   * If you'd like to dispose of shared dataLoaders, set force to `true`
   */


  _createClass(WarehouseWorker, [{
    key: 'dispose',
    value: function dispose() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var force = options.force;

      if (force) {
        this.parent._dispose(this.operationId);
      } else {
        var store = this.parent._getStore(this.operationId);
        if (store && !store.shared) {
          this.parent._dispose(this.operationId);
        }
      }
    }
  }, {
    key: 'get',
    value: function get(dataLoaderName) {
      var storeId = this.parent.warehouseLookup[this.operationId] || this.operationId;
      var store = this.parent._getStore(storeId);
      return store.dataLoaderBase[dataLoaderName];
    }
  }, {
    key: 'getID',
    value: function getID() {
      return this.operationId;
    }
  }, {
    key: 'isShared',
    value: function isShared() {
      var store = this.parent._getStore(this.operationId);
      return store ? store.shared : null;
    }
  }, {
    key: 'sanitize',
    value: function sanitize() {
      if (this.sanitizer) {
        this.sanitizer();
      }
    }

    /*
     * Sharing should do 3 things:
     * 1. A dataLoaderBase-specific sanitization (ie remove authToken), as defined by options.share
     * 2. Establish a TTL on the shared component, since it won't be cleaned up otherwise
     * 3. return a serializable key that a client can use with useShared
     *
     */

  }, {
    key: 'share',
    value: function share() {
      var ttl = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.parent._ttl;

      var store = this.parent._getStore(this.operationId);
      if (!store) {
        if (!this.parent.PROD) {
          throw new Error('dataLoaderBase not found! You called shared after it was disposed');
        }
        return null;
      }
      this.sanitize();
      setTimeout(this.parent._dispose, ttl, this.operationId);
      store.shared = true;
      return this.operationId;
    }

    /*
     * By default, we use the this.operationId. When this.parent is called, it points to another this.operationId.
     */

  }, {
    key: 'useShared',
    value: function useShared(mutationOpId) {
      var mutationStore = this.parent._getStore(mutationOpId);
      if (!mutationStore) {
        this.parent.warehouseLookup[this.operationId] = this.operationId;
        if (!this.parent.PROD) {
          console.warn('Mutation dataLoaderBase was already disposed!');
        }
      } else if (!mutationStore.shared) {
        throw new Error('Invalid access to unshared dataloader. First call dataLoader.share() in your mutation.');
      } else {
        this.parent.warehouseLookup[this.operationId] = mutationOpId;
      }
    }
  }]);

  return WarehouseWorker;
}();

var DataLoaderWarehouse = function () {
  function DataLoaderWarehouse() {
    var _this = this;

    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, DataLoaderWarehouse);

    this._dispose = function (operationId) {
      delete _this.warehouse[operationId];
      delete _this.warehouseLookup[operationId];
    };

    var ttl = options.ttl,
        onShare = options.onShare;

    if (isNaN(Number(ttl)) || ttl <= 0 || ttl > MAX_INT) {
      throw new Error('ttl must be positive and no greater than ' + MAX_INT);
    }
    this.PROD = process.env.NODE_ENV === 'production';
    this._ttl = ttl;
    this._onShare = onShare;
    this.opId = 0;
    this.warehouse = {};
    this.warehouseLookup = {};
  }

  _createClass(DataLoaderWarehouse, [{
    key: '_getStore',
    value: function _getStore(operationId) {
      var store = this.warehouse[operationId];
      if (!store && !this.PROD) {
        throw new Error('dataLoaderBase not found! Perhaps you disposed early or your ttl is too short?');
      }
      return store;
    }
  }, {
    key: 'add',
    value: function add(dataLoaderBase) {
      var operationId = this.opId++;
      this.warehouse[operationId] = {
        dataLoaderBase: dataLoaderBase,
        shared: false
      };
      var sanitizer = this.onShare && dataLoaderBase[this._onShare];
      return new WarehouseWorker(this, operationId, sanitizer);
    }
  }]);

  return DataLoaderWarehouse;
}();

exports.default = DataLoaderWarehouse;
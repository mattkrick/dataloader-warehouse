'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MAX_INT = 2147483647;

var ShareableDataLoader = function () {
  function ShareableDataLoader(parent, operationId, sanitizer) {
    _classCallCheck(this, ShareableDataLoader);

    this.parent = parent;
    this.operationId = operationId;
    this.sanitizer = sanitizer;
  }

  /*
   * A method to dispose of any unshared dataloader
   * If you'd like to dispose of shared dataloaders, set force to `true`
   */


  _createClass(ShareableDataLoader, [{
    key: 'dispose',
    value: function dispose() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var force = options.force;

      if (force) {
        this.parent._dispose(this.operationId);
      } else {
        var store = this.parent._getStore(this.operationId);
        // check for store so we don't bork the app in production
        if (store && !store.shared) {
          this.parent._dispose(this.operationId);
        }
      }
    }
  }, {
    key: 'get',
    value: function get(fetcher) {
      var storeId = this.parent.warehouseLookup[this.operationId] || this.operationId;
      var store = this.parent._getStore(storeId);
      return store.dataloader[fetcher];
    }
  }, {
    key: 'getID',
    value: function getID() {
      return this.operationId;
    }
  }, {
    key: 'isShared',
    value: function isShared() {
      return this.parent._getStore(this.operationId).shared;
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
     * 1. A dataloader-specific sanitization (ie remove authToken), as defined by options.share
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
        throw new Error(this.operationId + ' has already been disposed');
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
      if (!this.parent.PROD) {
        var mutationStore = this.parent._getStore(mutationOpId);
        if (!mutationStore.shared) {
          throw new Error('Invalid access to unshared dataloader. First call dataLoader.share() in your mutation.');
        }
      }
      this.parent.warehouseLookup[this.operationId] = mutationOpId;
    }
  }]);

  return ShareableDataLoader;
}();

var sharedDataLoader = function () {
  function sharedDataLoader() {
    var _this = this;

    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, sharedDataLoader);

    this._dispose = function (operationId) {
      delete _this.warehouse[operationId];
      delete _this.warehouseLookup[operationId];
    };

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
      var operationId = this.opId++;
      this.warehouse[operationId] = {
        dataloader: dataloader,
        shared: false
      };
      var sanitizer = this.onShare && dataloader[this._onShare];
      return new ShareableDataLoader(this, operationId, sanitizer);
    }
  }]);

  return sharedDataLoader;
}();

exports.default = sharedDataLoader;
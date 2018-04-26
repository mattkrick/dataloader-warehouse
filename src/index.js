const MAX_INT = 2147483647;

class WarehouseWorker {
  constructor(parent, operationId, sanitizer) {
    this.parent = parent;
    this.operationId = operationId;
    this.sanitizer = sanitizer;
  }

  /*
   * A method to dispose of any unshared dataLoader
   * If you'd like to dispose of shared dataLoaders, set force to `true`
   */
  dispose(options = {}) {
    const {force} = options;
    if (force) {
      this.parent._dispose(this.operationId);
    } else {
      const store = this.parent._getStore(this.operationId);
      if (store && !store.shared) {
        this.parent._dispose(this.operationId);
      }
    }
  }

  get(dataLoaderName) {
    const storeId = this.parent.warehouseLookup[this.operationId] || this.operationId;
    const store = this.parent._getStore(storeId);
    return store.dataLoaderBase[dataLoaderName];
  }

  getID() {
    return this.operationId;
  }

  isShared() {
    const store = this.parent._getStore(this.operationId);
    return store ? store.shared : null;
  }

  sanitize() {
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

  share(ttl = this.parent._ttl) {
    const store = this.parent._getStore(this.operationId);
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
  useShared(mutationOpId) {
    const mutationStore = this.parent._getStore(mutationOpId);
    if (!mutationStore) {
      this.parent.warehouseLookup[this.operationId] = this.operationId;
      if (!this.parent.PROD) {
        console.warn('Mutation dataLoaderBase was already disposed!')
      }
    } else if (!mutationStore.shared) {
      throw new Error('Invalid access to unshared dataloader. First call dataLoader.share() in your mutation.');
    } else {
      this.parent.warehouseLookup[this.operationId] = mutationOpId;
    }
  }
}

export default class DataLoaderWarehouse {
  constructor(options = {}) {
    const {ttl, onShare} = options;
    if (isNaN(Number(ttl)) || ttl <= 0 || ttl > MAX_INT) {
      throw new Error(`ttl must be positive and no greater than ${MAX_INT}`);
    }
    this.PROD = process.env.NODE_ENV === 'production';
    this._ttl = ttl;
    this._onShare = onShare;
    this.opId = 0;
    this.warehouse = {};
    this.warehouseLookup = {};
  }

  _dispose = (operationId) => {
    delete this.warehouse[operationId];
    delete this.warehouseLookup[operationId];
  };

  _getStore(operationId) {
    const store = this.warehouse[operationId];
    if (!store && !this.PROD) {
      throw new Error('dataLoaderBase not found! Perhaps you disposed early or your ttl is too short?');
    }
    return store;
  }

  add(dataLoaderBase) {
    const operationId = this.opId++;
    this.warehouse[operationId] = {
      dataLoaderBase,
      shared: false
    };
    const sanitizer = this.onShare && dataLoaderBase[this._onShare];
    return new WarehouseWorker(this, operationId, sanitizer);
  }
}

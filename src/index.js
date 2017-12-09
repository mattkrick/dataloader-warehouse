const MAX_INT = 2147483647;

class ShareableDataLoader {
  constructor(parent, operationId, sanitizer) {
    this.parent = parent;
    this.operationId = operationId;
    this.sanitizer = sanitizer;
  }

  /*
   * A method to dispose of any unshared dataloader
   * If you'd like to dispose of shared dataloaders, set force to `true`
   */
  dispose(options = {}) {
    const {force} = options;
    if (force) {
      this.parent._dispose(this.operationId);
    } else {
      const store = this.parent._getStore(this.operationId);
      // check for store so we don't bork the app in production
      if (store && !store.shared) {
        this.parent._dispose(this.operationId);
      }
    }
  }

  get(fetcher) {
    const storeId = this.parent.warehouseLookup[this.operationId] || this.operationId;
    const store = this.parent._getStore(storeId);
    return store.dataloader[fetcher];
  }

  getID() {
    return this.operationId;
  }

  isShared() {
    return this.parent._getStore(this.operationId).shared;
  }

  sanitize() {
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

  share() {
    const store = this.parent._getStore(this.operationId);
    if (!store) {
      throw new Error(`${this.operationId} has already been disposed`)
    }
    this.sanitize();
    setTimeout(this.parent._dispose, this.parent._ttl, this.operationId);
    store.shared = true;
    return this.operationId;
  }

  /*
   * By default, we use the this.operationId. When this.parent is called, it points to another this.operationId.
   */
  useShared(mutationOpId) {
    if (!this.parent.PROD) {
      const mutationStore = this.parent._getStore(mutationOpId);
      if (!mutationStore.shared) {
        throw new Error('Invalid access to unshared dataloader. First call dataLoader.share() in your mutation.');
      }
    }
    this.parent.warehouseLookup[this.operationId] = mutationOpId;
  }
}

export default class sharedDataLoader {
  constructor(options = {}) {
    const {ttl, PROD, onShare} = options;
    if (isNaN(Number(ttl)) || ttl <= 0 || ttl > MAX_INT) {
      throw new Error(`ttl must be positive and no greater than ${MAX_INT}`);
    }
    this.PROD = PROD;
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
      throw new Error('Dataloader not found! Perhaps you disposed early or your ttl is too short?');
    }
    return store;
  }

  add(dataloader) {
    const operationId = this.opId++;
    this.warehouse[operationId] = {
      dataloader,
      shared: false
    };
    const sanitizer = this.onShare && dataloader[this._onShare];
    return new ShareableDataLoader(this, operationId, sanitizer);
  }
}

const MAX_INT = 2147483647;

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

  _extendDataLoader = (operationId, dataloader) => {
    /*
     * A method to dispose of any unshared dataloader
     * If you'd like to dispose of shared dataloaders, set force to `true`
     */
    dataloader.dispose = (options = {}) => {
      const {force} = options;
      if (force) {
        this._dispose(operationId);
      } else {
        const store = this._getStore(operationId);
        // check for store so we don't bork the app in production
        if (store && !store.shared) {
          this._dispose(operationId);
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
    dataloader.share = () => {
      const store = this._getStore(operationId);
      store.dataloader[this._onShare]();
      setTimeout(this._dispose, this._ttl, operationId);
      store.shared = true;
      return operationId;
    };

    /*
     * By default, we use the operationId. When this is called, it points to another operationId.
     */
    dataloader.useShared = (mutationOpId) => {
      if (!this.PROD) {
        const mutationStore = this._getStore(mutationOpId);
        if (!mutationStore.shared) {
          throw new Error('Invalid access to unshared dataloader. First call getDataLoader().share() in your mutation.');
        }
      }
      this.warehouseLookup[operationId] = mutationOpId;
    };
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
    this._extendDataLoader(operationId, dataloader);
    this.warehouse[operationId] = {
      dataloader,
      shared: false
    };

    /*
     * The operationId could be for a subscription or mutation
     * If it's for a subscription, see if it's linked to a mutation & use that dataLoader
     * Otherwise, use it's own
     *
     */
    return (options = {}) => {
      const lookupId = options.self ? operationId : this.warehouseLookup[operationId];
      const storeId = lookupId || operationId;
      const store = this._getStore(storeId);
      return store.dataloader;
    };
  }
}

const MAX_INT = 2147483647

interface DisposeOptions {
  force?: boolean
}

class WarehouseWorker<T> {
  parent: DataLoaderWarehouse
  operationId: number
  sanitizer?: () => void
  constructor (
    parent: DataLoaderWarehouse,
    operationId: number,
    sanitizer?: () => void
  ) {
    this.parent = parent
    this.operationId = operationId
    this.sanitizer = sanitizer
  }

  /*
   * A method to dispose of any unshared dataLoader
   * If you'd like to dispose of shared dataLoaders, set force to `true`
   */
  dispose (options: DisposeOptions = {}) {
    const { force } = options
    if (force) {
      this.parent._dispose(this.operationId)
    } else {
      const store = this.parent._getStore(this.operationId)
      if (store) {
        const ttl = store.shared ? this.parent._ttl : 0
        setTimeout(this.parent._dispose, ttl, this.operationId)
      }
    }
  }

  get (dataLoaderName: keyof T) {
    const storeId =
      this.parent.warehouseLookup[this.operationId] || this.operationId
    const store = this.parent._getStore(storeId)
    return (store.dataLoaderBase as T)[dataLoaderName]
  }

  getID () {
    return this.operationId
  }

  isShared () {
    const store = this.parent._getStore(this.operationId)
    return store ? store.shared : false
  }

  sanitize () {
    if (this.sanitizer) {
      this.sanitizer()
    }
  }

  share () {
    const store = this.parent._getStore(this.operationId)
    if (!store) {
      if (!this.parent.PROD) {
        throw new Error(
          'dataLoaderBase not found! You called shared after it was disposed'
        )
      }
      return null
    }
    this.sanitize()

    store.shared = true
    return this.operationId
  }

  /*
   * By default, we use the this.operationId. When this.parent is called, it points to another this.operationId.
   */
  useShared (mutationOpId: number) {
    const mutationStore = this.parent._getStore(mutationOpId)
    if (!mutationStore) {
      this.parent.warehouseLookup[this.operationId] = this.operationId
      if (!this.parent.PROD) {
        console.warn('Mutation dataLoaderBase was already disposed!')
      }
    } else if (!mutationStore.shared) {
      throw new Error(
        'Invalid access to unshared dataloader. First call dataLoader.share() in your mutation.'
      )
    } else {
      this.parent.warehouseLookup[this.operationId] = mutationOpId
    }
  }
}

interface Options {
  ttl: number
  onShare?: string
}

interface DataLoaderBase {
  [key: string]: any
}

interface Warehouse {
  [key: number]: Store
}

interface WarehouseLookup {
  [key: number]: number
}
interface Store {
  dataLoaderBase: DataLoaderBase
  shared: boolean
}

export default class DataLoaderWarehouse {
  PROD = process.env.NODE_ENV === 'production'
  _ttl: number
  _onShare?: string
  opId = 0
  warehouse: Warehouse = {}
  warehouseLookup: WarehouseLookup = {}
  constructor (options: Options) {
    const { ttl, onShare } = options
    if (!ttl || isNaN(Number(ttl)) || ttl <= 0 || ttl > MAX_INT) {
      throw new Error(`ttl must be positive and no greater than ${MAX_INT}`)
    }
    this._ttl = ttl
    this._onShare = onShare
  }

  _dispose = (operationId: number) => {
    delete this.warehouse[operationId]
    delete this.warehouseLookup[operationId]
  }

  _getStore (operationId: number) {
    const store = this.warehouse[operationId]
    if (!store && !this.PROD) {
      throw new Error(
        'dataLoaderBase not found! Perhaps you disposed early or your ttl is too short?'
      )
    }
    return store
  }

  add<T extends DataLoaderBase> (dataLoaderBase: T) {
    const operationId = this.opId++
    this.warehouse[operationId] = {
      dataLoaderBase,
      shared: false
    }
    const sanitizer = this._onShare && dataLoaderBase[this._onShare]
    return new WarehouseWorker<T>(this, operationId, sanitizer)
  }
}

interface DisposeOptions {
    force?: boolean;
}
declare class WarehouseWorker {
    parent: DataLoaderWarehouse;
    operationId: number;
    sanitizer?: () => void;
    constructor(parent: DataLoaderWarehouse, operationId: number, sanitizer?: () => void);
    dispose(options?: DisposeOptions): void;
    get(dataLoaderName: string): any;
    getID(): number;
    isShared(): boolean;
    sanitize(): void;
    share(): number | null;
    useShared(mutationOpId: number): void;
}
interface Options {
    ttl: number;
    onShare?: string;
}
interface DataLoaderBase {
    [key: string]: any;
}
interface Warehouse {
    [key: number]: Store;
}
interface WarehouseLookup {
    [key: number]: number;
}
interface Store {
    dataLoaderBase: DataLoaderBase;
    shared: boolean;
}
export default class DataLoaderWarehouse {
    PROD: boolean;
    _ttl: number;
    _onShare?: string;
    opId: number;
    warehouse: Warehouse;
    warehouseLookup: WarehouseLookup;
    constructor(options: Options);
    _dispose: (operationId: number) => void;
    _getStore(operationId: number): Store;
    add(dataLoaderBase: DataLoaderBase): WarehouseWorker;
}
export {};
//# sourceMappingURL=index.d.ts.map
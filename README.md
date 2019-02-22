# dataloader-warehouse
Enables DataLoader for GraphQL subscriptions

## Installation
`yarn add dataloader-warehouse`

## The Problem
A typical data loader is created at the beginning of a mutation
and disposed of after it returns.
This is a best practice to reduce security concerns and to avoid stale data. 
Unfortunately, it isn't possible with subscriptions since they are long-lived.
The current workaround is to turn off the dataLoader cache, which is horribly inefficient.
This package allows you to use the same dataLoader for your mutation and subscription payloads,
when safe to do so.

## Nomenclature
- dataLoader: an instance created by the DataLoader class
- dataLoaderBase: an object where each key is a dataLoader
- dataLoaderWarehouse: an object where each key is a dataLoaderBase

## Usage

### 1. Create it on your GraphQL server

```js
import DataLoaderWarehouse from 'dataloader-warehouse';
const dataLoaderWarehouse = new DataLoaderWarehouse({onShare: '_share', ttl: 2000});

```

### 2. Add it to your query/mutation context. Call dispose after it's completed.

```js
import DataLoader from 'dataloader';
import {graphql} from 'graphql';

const dataLoaderBase = {todos: new DataLoader(todoBatchFn)};
const warehouseWorker = dataLoaderWarehouse.add(dataLoaderBase);
const result = await graphql(schema, query, {}, {warehouseWorker}, variables);
warehouseWorker.dispose();
```

### 3. Add it to your subscription context. Call dispose after the subscription ends.
```js
import {subscribe} from 'graphql';

// Important! Note {cache: false}. You should already have been doing this since subs are long-lived.
const dataLoaderBase = {todos: new DataLoader(todoBatchFn, {cache: false})};
const warehouseWorker = dataLoaderWarehouse.add(dataLoaderBase);
const asyncIterator = await subscribe(schema, document, {}, {warehouseWorker}, variables);
await forAwaitEach(asyncIterator, iterableCb);
warehouseWorker.dispose();
```

### 4. Share the ID when you push to the pubsub
```js
// UpdateTodo.js
resolve(source, args, {warehouseWorker}) {
  const updatedTodo = db.update({foo: 'bar'});
  const operationId = warehouseWorker.share();
  pubsub.publish('updatedTodo', {updatedTodo, operationId})
}
```

### 5. Use the operationId in your subscription iterator and unsub when the sub closes
```js
async subscribe(source, args, {warehouseWorker}) {
  const asyncIterator = pubsub.asyncIterator('updatedTodo');
  const getNextPromise = async () => {
    const nextRes = await asyncIterator.next();
    const {value, done} = nextRes;
    if (done) {
      return asyncIterator.return();
    }
    if (value.operationId) {
      warehouseWorker.useShared(value.operationId);
    }
    return nextRes;
  };
  return {
    next() {
      return getNextPromise();   
    },
    return() {
      warehouseWorker.dispose({force: true});
      return asyncIterator.return();
    }
  }
}
```

### 6. Use `warehouseWorker.get` method to get individual loaders:

```js
todo: {
  type: Todo,
  resolve: (source, args, {warehouseWorker}) {
    // before
    // return dataLoaderBase.todos.load(source.id) 
    
    // after
    return warehouseWorker.get('todos').load(source.id)
  }
}
```

# API

The DataLoaderWarehouse takes the following args

- `ttl`: time to live (ms). Smaller number means less memory usage. 100-5000 is reasonable.
- `onShare`: The name of the method in your dataLoaderBase to call when you call `share()`. 
Use this to sanitize your dataLoaderBase of any sensitive info that might have been provided to it (such as an auth token)
This is not required, but provides peace of mind if you're unsure about your schema authorization.

The dataLoaderWarehouse instance has a single public method:

- `add(dataLoaderBase)`: Call this with an object containing all your loaders. It returns a WarehouseWorker.

The WarehouseWorker (the result of DataLoaderWarehouse#add) has the following methods:

- `dispose(options)`: schedule the dataloader to be disposed.
  - `force`: boolean, defaults to false. 
  If true, calling dispose will dispose of the dataLoaderBase immediately.
  If falsy, the dataloader will be disposed in the next tick (if not shared) or after the ttl (if shared)
- `share()`: Returns a unique ID to be fed to `useShared`.
- `useShared(operationId)`: Replaces the current dataLoaderBase with the dataLoaderBase belonging to the `operationId`.
You'll want to pass in the `operationId` provided by the publishing mutation.
- `getID`: returns the ID of the current dataLoaderBase. Useful for testing.
- `isShared`: returns true if the dataLoaderBase is currently being shared. Useful for testing.

## License

MIT

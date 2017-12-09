# shared-dataloader
A class for sharing dataloaders across GraphQL subscriptions

##Installation
`yarn add shared-dataloader`

## What's it do
Allows you to use the same dataloader for multiple GraphQL subscription clients

##Usage

### 1. Create it on your GraphQL server

```js
import SharedDataLoader from 'shared-dataloader';
const sharedDataLoader = new SharedDataLoader({PROD, onShare: '_share', ttl: 5000});

```


### 2. Add it to your query/mutation context. Call dispose after it's completed.

```js
import DataLoader from 'dataloader';
import {graphql} from 'graphql';

const allMyDataLoaders = {todos: new DataLoader(todoBatchFn)};
const dataLoader = sharedDataLoader.add(allMyDataLoaders);
const result = await graphql(schema, query, {}, {dataLoader}, variables);
dataLoader.dispose();

```

### 3. Add it to your subscription context. Call dispose after the subscription ends.
```js
import {subscribe} from 'graphql';

// Important! Note {cache: false}. You should already have been doing this since subs are long lived.
const allMyDataLoaders = {todos: new DataLoader(todoBatchFn, {cache: false})};
const dataLoader = sharedDataLoader.add(allMyDataLoaders);
const asyncIterator = await subscribe(schema, document, {}, {dataLoader}, variables);
await forAwaitEach(asyncIterator, iterableCb);
dataLoader.dispose();
```

### 4. Share the ID when you push to the pubsub
```js
// UpdateTodo.js
resolve(source, args, {dataLoader}) {
  const updatedTodo = db.update({foo: 'bar'});
  const operationId = dataLoader.share();
  pubsub.publish('updatedTodo', {updatedTodo, operationId})
}
```

### 5. Use the shared ID in your subscription iterator and unsub when the sub closes
```js
async subscribe(source, args, {dataLoader}) {
  const asyncIterator = pubsub.asyncIterator('updatedTodo');
  const getNextPromise = async () => {
    const nextRes = await asyncIterator.next();
    const {value, done} = nextRes;
    if (done) {
      return asyncIterator.return();
    }
    if (value.operationId) {
      dataLoader.useShared(value.operationId);
    }
    return nextRes;
  };
  return {
    next() {
      return getNextPromise();   
    },
    return() {
      dataLoader.dispose();
      return asyncIterator.return();
    }
  }
}
```

### 6. Use the dataloader `getter` method to get individual loaders:

```js
todos: {
  resolve: (source, args, {dataLoader}) {
    return dataLoader.get('todos').load(source.id)
  }
}
```

# API

The SharedDataLoader takes the following args

- `PROD`: true if running in production (don't show warnings). Defaults to false.
- `ttl`: time to live (ms). Smaller number means less memory usage. 100-5000 is reasonable.
- `onShare`: The name of the method in your dataloader object to call when you call `share()`. 
Use this to sanitize your dataloader of any sensitive info that might have been provided to it (such as an auth token)
This is not required, but provides peace of mind if you're unsure about your schema authorization.

THe SharedDataLoader has a single public method:

- `add(allMyLoaders)`: Call this with an object containing all your loaders. It returns a ShareableDataLoader.

The ShareableDataLoader (the result of SharedDataLoader#add) has the following API

- `dispose(options)`: dispose of the data loader if it is not being shared. It has the following option:
  - `force`: boolean, defaults to false. 
  If true, calling dispose will dispose of the dataloader even if it is being shared.
- `share`: Returns a unique ID to be fed to `useShared`. Also begins the ttl.
- `useShared(operationId)`: Replaces the current dataloader with the dataloader belonging to the `operationId`.
You'll want to call this on your subscription with the `operationId` that comes from the mutation
- `getID`: returns the ID of the current dataloader. Useful for testing.
- `isShared`: returns true if the dataloader is currently being shared. Useful for testing.

## License

MIT

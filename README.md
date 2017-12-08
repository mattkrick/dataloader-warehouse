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
- `PROD`: true if running in production (don't show warnings). Defaults to false.
- `onShare`: The name of the method in your dataloader object to call when you call `share()`. 
- `ttl`: time to live (ms). Smaller number means less memory usage. 100-5000 is reasonable.

### 2. Add it to your query/mutation context. Call dispose after it's completed.

```js
import DataLoader from 'dataloader';
import {graphql} from 'graphql';

const allMyDataLoaders = {todos: new DataLoader(todoBatchFn)};
const getDataLoader = sharedDataLoader.add(allMyDataLoaders);
const dataLoader = getDataLoader();
const result = await graphql(schema, query, {}, {getDataLoader}, variables);
dataLoader.dispose();

```
Note: `dispose`, `share`, and `useShared` will be injected onto `allMyDataLoaders` so don't use those names.

### 3. Add it to your subscription context. Call dispose after the subscription ends.
```js
import {subscribe} from 'graphql';

// Important! Note {cache: false}. You should already have been doing this since subs are long lived.
const allMyDataLoaders = {todos: new DataLoader(todoBatchFn, {cache: false})};
const getDataLoader = sharedDataLoader.add(allMyDataLoaders);
const dataLoader = getDataLoader();
const asyncIterator = await subscribe(schema, document, {}, {getDataLoader}, variables);
await forAwaitEach(asyncIterator, iterableCb);
dataLoader.dispose();
```

### 4. Share the ID when you push to the pubsub
```js
// UpdateTodo.js
resolve(source, args, {getDataLoader}) {
  const updatedTodo = db.update({foo: 'bar'});
  const operationId = getDataLoader().share();
  pubsub.publish('updatedTodo', {updatedTodo, operationId})
}
```

### 5. Use the shared ID in your subscription iterator
```js
async subscribe(source, args, {getDataLoader}) {
  const asyncIterator = pubsub.asyncIterator('updatedTodo');
  const getNextPromise = async () => {
    const nextRes = await asyncIterator.next();
    const {value, done} = nextRes;
    if (done) {
      return asyncIterator.return();
    }
    if (value.operationId) {
      getDataLoader({self: true}).useShared(value.operationId);
    }
    return nextRes;
  };
  return {
    next() {
      return getNextPromise();   
    }
  }
}
```

### 6. Use the dataloader just like normal:

```js
todos: {
  resolve: (source, args, {getDataLoader}) {
    return getDataLoader().todos.load(source.id)
  }
}
```

## `onShare`

You dataloader object (see `allMyDataLoaders` above) is probably not a POJO.
It's probably a class that is instantiated with an authToken.
To remove the authToken before it gets shared, write a method to delete it & any sensitive info.
Then, pass in that method name to `onShare` like in Step 1.

## License

MIT

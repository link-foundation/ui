// Adapt Apollo's React hooks to the Deep data API. All data and mutations go
// through createDeepClient; the upstream view and its hooks remain unchanged.
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
} from '@apollo/client';
import {
  useDeepQuery,
  useDeepSubscription,
  _useDeepId,
} from '@deep-foundation/deeplinks/imports/client';
import { queryDocument } from '../../packages/ui-links/src/deep-graphql.js';
import { resolveDeepQuery } from '../../packages/ui-links/src/deep-query.js';

export function attachApollo(deep) {
  const requests = new Map();
  deep._generateQuery = (input, options = {}) => {
    const document = queryDocument(
      resolveDeepQuery(input, deep.minilinks),
      options,
      options?.subscription
    );
    requests.set(document.query + JSON.stringify(document.variables), {
      input,
      options,
    });
    return {
      query: { query: gql(document.query), variables: document.variables },
    };
  };
  deep._generateResult = (...args) => args[2] ?? [];
  deep.useDeepQuery = (input, options) =>
    useDeepQuery(input, { ...options, deep });
  deep.useDeepSubscription = (input, options) =>
    useDeepSubscription(input, { ...options, deep });
  deep.useDeepId = (start, ...path) => _useDeepId(deep, start, ...path);
  deep.nameLocal = (id) => deep.minilinks.name(id);
  deep.apolloClient = new ApolloClient({
    cache: new InMemoryCache({ addTypename: false }),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'no-cache' },
      query: { fetchPolicy: 'no-cache' },
    },
    link: new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          const { input, options } = requests.get(
            operation.query.loc.source.body +
              JSON.stringify(operation.variables)
          );
          const next = ({ data }) =>
            observer.next({
              data: { q0: data?.map((row) => row.toPlain?.() ?? row) ?? [] },
            });
          if (options.subscription) {
            const subscription = deep
              .subscribe(input, options)
              .subscribe({ next, error: (error) => observer.error(error) });
            return () => subscription.unsubscribe();
          }
          let stopped = false;
          deep.select(input, options).then(
            (result) => {
              if (!stopped) {
                next(result);
                observer.complete();
              }
            },
            (error) => observer.error(error)
          );
          return () => {
            stopped = true;
          };
        })
    ),
  });
  return deep;
}

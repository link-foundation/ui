import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import { ApolloProvider } from '@apollo/client';
import {
  DeepContext,
  useDeepSubscription,
} from '@deep-foundation/deeplinks/imports/client';
import theme from '@deep-foundation/deepcase/imports/theme/theme';
import { QueryStoreProvider } from '@deep-foundation/store/query';
import { LocalStoreProvider } from '@deep-foundation/store/local';
import { CookiesStoreProvider } from '@deep-foundation/store/cookies';
import { TokenProvider } from '@deep-foundation/deeplinks/imports/react-token';
import CytoGraph from '@deep-foundation/deepcase/imports/cyto/graph';
import {
  createDeepClient,
  createSyncedDeepLinks,
} from '../../packages/ui-links/src/index.js';
import { attachApollo } from './bridge.js';

const RouterContext = React.createContext(null);
const useRouter = () => React.useContext(RouterContext);

localStorage.setItem('layout', JSON.stringify('cola'));

const endpoint =
  new URLSearchParams(location.search).get('endpoint') ??
  'http://127.0.0.1:3198/v1/graphql';
const operations = [];
const synced = createSyncedDeepLinks({
  url: endpoint,
  trace: (operation) => operations.push(operation),
});
const deep = attachApollo(createDeepClient(synced));
await deep.guest();
await deep.select({});
window.deep = deep;
window.operations = operations;
const router = {
  query: { 'space-id': 184 },
  pathname: '/',
  asPath: '/?space-id=184',
  events: deep.emitter,
  push: (url) => {
    deep.emitter.emit('routeChangeStart', url);
    location.href = url;
    return Promise.resolve(true);
  },
};
function Main() {
  const cy = useRef();
  window.cyRef = cy;
  const {
    data: links = [],
    error,
    loading,
  } = useDeepSubscription(
    { type_id: deep.idLocal('@deep-foundation/core', 'Type'), limit: 22 },
    { mini: 'space' }
  );
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'header',
      {
        style: {
          height: '64px',
          padding: '12px 24px',
          borderBottom: '1px solid #cbd5e0',
        },
      },
      React.createElement(
        'button',
        {
          style: {
            float: 'right',
            padding: '6px 12px',
            border: '1px solid #718096',
            borderRadius: '4px',
          },
          onClick: () =>
            cy.current
              .layout({
                name: 'circle',
                animate: false,
                fit: true,
                padding: 60,
              })
              .run(),
        },
        'Fit graph'
      ),
      React.createElement(
        'h1',
        { style: { fontSize: '20px', fontWeight: 600 } },
        'Deepcase · core types'
      ),
      React.createElement(
        'p',
        { role: 'status' },
        error
          ? String(error)
          : loading
            ? 'Loading clink…'
            : `${links.length} links · clink GraphQL · ui-links DeepClient`
      )
    ),
    React.createElement(
      'main',
      {
        'aria-label': 'Deepcase main graph',
        style: { position: 'relative', height: 'calc(100vh - 64px)' },
        ref: (element) => {
          element
            ?.querySelector('input[type="file"]')
            ?.setAttribute('aria-label', 'Import Deep package');
        },
      },
      React.createElement(CytoGraph, {
        links,
        cyRef: cy,
        useSpaceId: () => useState(184),
      })
    )
  );
}
createRoot(document.getElementById('root')).render(
  React.createElement(
    RouterContext.Provider,
    { value: router },
    React.createElement(
      ApolloProvider,
      { client: deep.apolloClient },
      React.createElement(
        DeepContext.Provider,
        { value: deep },
        React.createElement(
          ChakraProvider,
          { theme },
          React.createElement(
            QueryStoreProvider,
            { useRouter },
            React.createElement(
              LocalStoreProvider,
              null,
              React.createElement(
                CookiesStoreProvider,
                null,
                React.createElement(
                  TokenProvider,
                  null,
                  React.createElement(Main)
                )
              )
            )
          )
        )
      )
    )
  )
);

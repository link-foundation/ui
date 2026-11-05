import React, { lazy, Suspense } from 'react';

// Next's server rendering is absent in this browser-only example. Preserve
// real lazy component loading through React's equivalent browser primitive.
export default function dynamic(load, options = {}) {
  const Component = lazy(async () => {
    const module = await (typeof load === 'function' ? load() : load);
    return module.default ? module : { default: module };
  });
  return function BrowserDynamic(props) {
    const fallback = options.loading
      ? React.createElement(options.loading)
      : null;
    return React.createElement(
      Suspense,
      { fallback },
      React.createElement(Component, props)
    );
  };
}

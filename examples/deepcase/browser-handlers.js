// clink's GraphQL contract does not execute Deepcase's stored JavaScript.
// Optional handler calls fail explicitly in this browser host.
function unavailable() {
  throw new Error('Deepcase handler execution is unavailable on clink');
}
export {
  unavailable as ClientHandler,
  unavailable as ClientHandlerRenderer,
  unavailable as evalClientHandler,
  unavailable as useFindClientHandler,
  unavailable as r,
};

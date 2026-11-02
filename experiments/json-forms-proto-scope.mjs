// Does a JSON Forms scope that names __proto__ or constructor touch
// Object.prototype, or read schema facets through the prototype chain?
import {
  importJsonForms,
  exportJsonForms,
} from '../packages/ui-convert/src/index.js';

const input = JSON.parse(`{
  "schema": {"type":"object","properties":{"__proto__":{"type":"string","minLength":2},"name":{"type":"string"}}},
  "uischema": {"type":"VerticalLayout","elements":[
    {"type":"Control","scope":"#/properties/__proto__"},
    {"type":"Control","scope":"#/properties/constructor"},
    {"type":"Control","scope":"#/properties/name"}]}
}`);
const before = Object.getOwnPropertyNames(Object.prototype).join();
const { lino, diagnostics } = importJsonForms(input);
console.log(lino);
console.log(
  diagnostics.map((d) => `${d.severity} ${d.code} ${d.at.path ?? ''}`)
);
console.log(
  'Object.prototype unchanged:',
  before === Object.getOwnPropertyNames(Object.prototype).join()
);
console.log(JSON.stringify(exportJsonForms(lino).json));

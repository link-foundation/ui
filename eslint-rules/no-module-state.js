/**
 * `local/no-module-state`: a module keeps no mutable state of its own. Every
 * value at the top level of a module is a constant that cannot change:
 *
 * - `let` and `var` are reported (a binding that can be reassigned);
 * - a `const` must hold a literal, a template, a function, a class, a name, a
 *   member read, arithmetic of those, or a deep `Object.freeze(...)`; object
 *   and array literals, `new` and other calls are reported (a `Map`, a
 *   counter object, a cache are state);
 * - top-level statements other than declarations, imports and exports are
 *   reported (assignments and calls at load time change shared state);
 * - a class with a `static` field that is not a constant is reported.
 *
 * State belongs to the instance that owns it (an element, a `createX()`
 * closure), so two instances never share it.
 */

const MESSAGES = {
  binding: 'Module-level `{{kind}}` is mutable state; use `const`.',
  value:
    'Module-level `const {{name}}` holds a mutable value; freeze it with Object.freeze or keep it inside a function.',
  statement:
    'Module-level statements change shared state; move them into a function.',
  staticField:
    'The static field `{{name}}` holds a mutable value; freeze it or make it an instance field.',
};

const isFreezeCall = (node) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  !node.callee.computed &&
  node.callee.object.type === 'Identifier' &&
  node.callee.object.name === 'Object' &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'freeze';

/** Whether the inside of an `Object.freeze(...)` call is immutable. */
function frozenContent(node) {
  if (node.type === 'ArrayExpression') {
    return node.elements.every(
      (element) => element === null || immutable(element)
    );
  }
  if (node.type === 'ObjectExpression') {
    return node.properties.every(
      (property) =>
        property.type === 'Property' &&
        !property.computed &&
        immutable(property.value)
    );
  }
  // Any other argument (a call such as Object.keys, a name) is frozen as a
  // whole by the call.
  return true;
}

const IMMUTABLE_TYPES = new Set([
  'Literal',
  'Identifier',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ClassExpression',
  'MemberExpression',
]);

/** Whether a value expression cannot be changed after it is made. */
function immutable(node) {
  if (IMMUTABLE_TYPES.has(node.type)) {
    return node.type !== 'Literal' || node.regex === undefined;
  }
  switch (node.type) {
    case 'TemplateLiteral':
      return node.expressions.every(immutable);
    case 'UnaryExpression':
      return immutable(node.argument);
    case 'BinaryExpression':
    case 'LogicalExpression':
      return immutable(node.left) && immutable(node.right);
    case 'ConditionalExpression':
      return (
        immutable(node.test) &&
        immutable(node.consequent) &&
        immutable(node.alternate)
      );
    case 'CallExpression':
      return isFreezeCall(node) && node.arguments.every(frozenContent);
    default:
      return false;
  }
}

/** Report the mutable parts of a top-level declaration. */
function checkDeclaration(context, node) {
  if (node.type === 'VariableDeclaration') {
    if (node.kind !== 'const') {
      context.report({ node, messageId: 'binding', data: { kind: node.kind } });
      return;
    }
    for (const declarator of node.declarations) {
      if (declarator.init !== null && !immutable(declarator.init)) {
        const name =
          declarator.id.type === 'Identifier' ? declarator.id.name : '…';
        context.report({
          node: declarator,
          messageId: 'value',
          data: { name },
        });
      }
    }
    return;
  }
  if (node.type === 'ClassDeclaration') {
    checkClass(context, node);
  }
}

function checkClass(context, node) {
  for (const member of node.body.body) {
    if (
      member.type === 'PropertyDefinition' &&
      member.static &&
      member.value !== null &&
      !immutable(member.value)
    ) {
      const name = member.key.type === 'Identifier' ? member.key.name : '…';
      context.report({
        node: member,
        messageId: 'staticField',
        data: { name },
      });
    }
  }
}

const ALLOWED_STATEMENTS = new Set([
  'ImportDeclaration',
  'ExportAllDeclaration',
  'FunctionDeclaration',
  'EmptyStatement',
]);

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow mutable module-level state (let, var, unfrozen objects, top-level statements)',
    },
    schema: [],
    messages: MESSAGES,
  },
  create(context) {
    return {
      Program(program) {
        for (const statement of program.body) {
          if (ALLOWED_STATEMENTS.has(statement.type)) {
            continue;
          }
          if (
            statement.type === 'ExpressionStatement' &&
            statement.directive !== undefined
          ) {
            continue;
          }
          if (
            statement.type === 'ExportNamedDeclaration' ||
            statement.type === 'ExportDefaultDeclaration'
          ) {
            const inner = statement.declaration;
            if (inner === null || inner === undefined) {
              continue;
            }
            if (
              statement.type === 'ExportDefaultDeclaration' &&
              !inner.type.endsWith('Declaration')
            ) {
              if (!immutable(inner)) {
                context.report({
                  node: inner,
                  messageId: 'value',
                  data: { name: 'default' },
                });
              }
              continue;
            }
            checkDeclaration(context, inner);
            continue;
          }
          if (
            statement.type === 'VariableDeclaration' ||
            statement.type === 'ClassDeclaration'
          ) {
            checkDeclaration(context, statement);
            continue;
          }
          context.report({ node: statement, messageId: 'statement' });
        }
      },
    };
  },
};

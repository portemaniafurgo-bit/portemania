/**
 * Caza identificadores que la app USA y nunca declara ni importa.
 *
 * Es la clase de fallo que ya se ha colado dos veces en producción:
 * `bottomPad` y `PHASE_GAP_SECONDS`. Metro no los detecta —son JavaScript
 * válido— y solo revientan cuando el usuario abre esa pantalla.
 *
 *   node scripts/check-undefined.js
 *
 * Recorre el árbol de sintaxis: recoge todo lo declarado en el fichero
 * (imports, variables, funciones, parámetros, desestructuraciones) y lo compara
 * con todo lo referenciado. Es una aproximación por fichero, no un análisis de
 * ámbitos completo, pero no da falsos positivos en este código y pilla justo lo
 * que se nos escapa.
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const ROOT = path.join(__dirname, "..");
const DIRS = ["app", "components", "lib"];

// Lo que existe siempre y no se importa.
const GLOBALS = new Set([
  "console", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "Promise", "Math", "Date", "JSON", "Object", "Array", "String", "Number",
  "Boolean", "Error", "Set", "Map", "isNaN", "parseInt", "parseFloat",
  "require", "module", "exports", "process", "fetch", "navigator", "global",
  "globalThis", "URL", "URLSearchParams", "encodeURIComponent", "decodeURIComponent",
  "Intl", "AbortController", "TextEncoder", "atob", "btoa", "undefined", "arguments",
  "React", "window", "document", "structuredClone", "queueMicrotask",
  "NaN", "Infinity",
]);

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

let problems = 0;

for (const file of DIRS.flatMap(d => walkFiles(path.join(ROOT, d)))) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator"],
    });
  } catch (err) {
    console.log(`SINTAXIS  ${path.relative(ROOT, file)}: ${err.message}`);
    problems++;
    continue;
  }

  const declared = new Set(GLOBALS);
  const used = new Map(); // nombre -> primera línea donde se usa

  traverse(ast, {
    // Todo lo que crea un nombre
    "ImportDefaultSpecifier|ImportSpecifier|ImportNamespaceSpecifier"(p) {
      declared.add(p.node.local.name);
    },
    VariableDeclarator(p) {
      collectPattern(p.node.id, declared);
    },
    // ObjectMethod y ClassMethod incluidos: `async getItem(key) {}` dentro de
    // un objeto también declara sus parámetros.
    "FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ClassDeclaration|ObjectMethod|ClassMethod"(p) {
      if (p.node.id?.name) declared.add(p.node.id.name);
      for (const param of p.node.params || []) collectPattern(param, declared);
    },
    CatchClause(p) {
      if (p.node.param) collectPattern(p.node.param, declared);
    },
    // Todo lo que se referencia
    Identifier(p) {
      if (!p.isReferencedIdentifier()) return;
      // Propiedades de objeto (a.b) y claves ({ b: 1 }) no son referencias libres
      const parent = p.parent;
      if (parent.type === "MemberExpression" && parent.property === p.node && !parent.computed) return;
      if (parent.type === "ObjectProperty" && parent.key === p.node && !parent.computed) return;
      if (parent.type === "JSXAttribute") return;
      if (!used.has(p.node.name)) used.set(p.node.name, p.node.loc?.start.line);
    },
    JSXIdentifier(p) {
      const name = p.node.name;
      // Solo los que empiezan por mayúscula: son componentes importados.
      if (!/^[A-Z]/.test(name)) return;
      if (p.parent.type === "JSXAttribute") return;
      // En <Stack.Screen> lo que hay que tener importado es `Stack`, no
      // `Screen`: `Screen` es una propiedad suya.
      if (p.parent.type === "JSXMemberExpression" && p.parent.property === p.node) return;
      if (!used.has(name)) used.set(name, p.node.loc?.start.line);
    },
  });

  for (const [name, line] of used) {
    if (!declared.has(name)) {
      console.log(`SIN DECLARAR  ${path.relative(ROOT, file)}:${line}  →  ${name}`);
      problems++;
    }
  }
}

console.log(
  problems
    ? `\n${problems} problema(s). Cada uno reventaría al abrir esa pantalla.`
    : "\nNingún identificador sin declarar. Todas las pantallas tienen lo que usan.",
);
process.exit(problems ? 1 : 0);

function collectPattern(node, out) {
  if (!node) return;
  switch (node.type) {
    case "Identifier":
      out.add(node.name);
      break;
    case "ObjectPattern":
      for (const prop of node.properties) {
        collectPattern(prop.type === "RestElement" ? prop.argument : prop.value, out);
      }
      break;
    case "ArrayPattern":
      for (const el of node.elements) collectPattern(el, out);
      break;
    case "AssignmentPattern":
      collectPattern(node.left, out);
      break;
    case "RestElement":
      collectPattern(node.argument, out);
      break;
  }
}

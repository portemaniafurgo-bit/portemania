/**
 * Caza dos clases de fallo que Metro empaqueta sin rechistar y solo revientan
 * al abrir la pantalla en el móvil:
 *   1. Identificadores que la app USA y nunca declara ni importa
 *      (`bottomPad`, `PHASE_GAP_SECONDS`: dos veces en producción).
 *   2. Imports `{ x }` de un módulo propio que NO exporta `x`: `x` llega como
 *      undefined y estalla al llamarla (`uniqueChannel`, 07/09/2026).
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

const PARSE_OPTIONS = {
  sourceType: "module",
  plugins: ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator"],
};

/**
 * Nombres que EXPORTA un fichero propio (cacheado). Sirve para la segunda
 * comprobación: importar `{ x }` de un módulo que no exporta `x` es JavaScript
 * válido, Metro lo empaqueta sin rechistar y `x` vale undefined hasta que
 * alguien lo llama — "undefined is not a function" en producción (bug real,
 * 07/09/2026: `uniqueChannel` importada sin estar exportada).
 */
const exportsCache = new Map();
function exportsOf(file) {
  if (exportsCache.has(file)) return exportsCache.get(file);
  const names = new Set();
  let ast;
  try {
    ast = parser.parse(fs.readFileSync(file, "utf8"), PARSE_OPTIONS);
  } catch {
    exportsCache.set(file, null); // no se pudo leer: no se juzga
    return null;
  }
  for (const node of ast.program.body) {
    if (node.type === "ExportDefaultDeclaration") names.add("default");
    if (node.type === "ExportNamedDeclaration") {
      for (const spec of node.specifiers || []) names.add(spec.exported.name || spec.exported.value);
      const decl = node.declaration;
      if (decl?.id?.name) names.add(decl.id.name);
      for (const d of decl?.declarations || []) collectPattern(d.id, names);
    }
    if (node.type === "ExportAllDeclaration") {
      // `export * from` — se da todo por bueno: no compensa seguir la cadena.
      exportsCache.set(file, null);
      return null;
    }
  }
  exportsCache.set(file, names);
  return names;
}

/** Ruta real de un import relativo, o null si no es propio. */
function resolveLocal(fromFile, source) {
  if (!source.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), source);
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, path.join(base, "index.js")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

for (const file of DIRS.flatMap(d => walkFiles(path.join(ROOT, d)))) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parser.parse(code, PARSE_OPTIONS);
  } catch (err) {
    console.log(`SINTAXIS  ${path.relative(ROOT, file)}: ${err.message}`);
    problems++;
    continue;
  }

  const declared = new Set(GLOBALS);
  const used = new Map(); // nombre -> primera línea donde se usa

  traverse(ast, {
    // Segunda comprobación: cada import de un módulo propio tiene que existir
    // como export en ese módulo.
    ImportDeclaration(p) {
      const target = resolveLocal(file, p.node.source.value);
      if (!target) return;
      const available = exportsOf(target);
      if (!available) return;
      for (const spec of p.node.specifiers) {
        const wanted =
          spec.type === "ImportDefaultSpecifier" ? "default"
          : spec.type === "ImportSpecifier" ? (spec.imported.name || spec.imported.value)
          : null;
        if (wanted && !available.has(wanted)) {
          console.log(
            `NO EXPORTADO  ${path.relative(ROOT, file)}:${p.node.loc?.start.line}  →  ${wanted} no existe en ${path.relative(ROOT, target)}`,
          );
          problems++;
        }
      }
    },
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

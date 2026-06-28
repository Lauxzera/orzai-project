/**
 * check-encoding.js
 * Detecta texto português quebrado em arquivos TypeScript/TSX.
 * Texto quebrado aparece quando UTF-8 é interpretado como Latin-1/Windows-1252:
 *   "Responsável" → "Respons?vel"
 *   "Objeção"     → "Obje??o" ou "Obje?o"
 *   "Próximo"     → "Pr?ximo"
 *
 * Uso: node scripts/check-encoding.js
 * Exit 1 se encontrar problemas, 0 se tudo ok.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EXTENSIONS = [".ts", ".tsx"];
const IGNORE = ["node_modules", ".next", "generated", ".runtime", "scripts", "dist"];

// Sufixos típicos de português quebrado — são terminações de palavras
// comuns que aparecem DEPOIS do "?" quando o acento foi corrompido
const BROKEN_SUFFIXES = [
  "vel",  // Responsável → Respons?vel, Possível → Poss?vel
  "ria",  // História → Hist?ria
  "rio",  // Usuário → Usu?rio
  "ria",  // memória
  "nio",  // patrimônio
  "nio",
  "ximo", // Próximo → Pr?ximo
  "cio",  // Início → In?cio
  "cia",
  "gio",  // Elogio
  "gio",
];

// Terminações de palavras que em português vêm após caracteres acentuados
// e que sozinhos (sem o acento) formam padrão "?terminação"
const BROKEN_ENDINGS = [
  /\?vel\b/g,    // ?vel = ável, ível, óvel
  /\?ria\b/g,    // ?ria = ária, ória, éria
  /\?rio\b/g,    // ?rio = ário, ório
  /\?nio\b/g,    // ?nio = ônio, ânio
  /\?nio\b/g,
  /\?ximo\b/g,   // ?ximo = óximo, áximo
  /\?cio\b/g,    // ?cio = ício, ócio
  /\?ncia\b/g,   // ?ncia = ência, ância
  /\?ncia\b/g,
  /\?o\b/g,      // ?o = ão, ção (mas só em string literals — veja abaixo)
  /\?\?o\b/g,    // ??o = ção quebrada em 2 bytes
  /\?\?es\b/g,   // ??es = ções quebrada
  /\?es\b/g,     // ?es = ões
  /\?em\b/g,     // ?em = ém
  /j\? /g,       // já + espaço
  /j\?\b/g,      // já no final
  /n\?o\b/g,     // não
  /s\?o\b/g,     // são
  /n\?s\b/g,     // nós
  /v\?s\b/g,     // vós
  /Poss\?/g,     // Possível
  /poss\?/g,
  /Respons\?/g,  // Responsável
  /respons\?/g,
  /configura\?\?/g,  // configuração
  /informa\?\?/g,    // informação
  /atualiza\?\?/g,   // atualização
  /fun\?\?/g,        // função
  /situa\?\?/g,      // situação
  /opera\?\?/g,      // operação
  /exce\?\?/g,       // exceção
  /sele\?\?/g,       // seleção
  /gest\?o\b/g,      // gestão
  /cria\?\?/g,       // criação
];

function scanFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }

  const lines = content.split("\n");
  const issues = [];

  lines.forEach((line, lineIndex) => {
    // Only check inside string literals to avoid false positives in code syntax
    // Extract string content (between quotes)
    const stringMatches = [
      ...line.matchAll(/"([^"\\]|\\.)*"/g),
      ...line.matchAll(/'([^'\\]|\\.)*'/g),
      ...line.matchAll(/`([^`\\]|\\.)*`/g),
      ...line.matchAll(/\/\/.*$/g), // also check comments
    ];

    const stringsToCheck = stringMatches.map((m) => ({
      text: m[0],
      offset: m.index ?? 0,
    }));

    // Also check the whole line for clear broken patterns
    stringsToCheck.push({ text: line, offset: 0 });

    for (const { text, offset } of stringsToCheck) {
      BROKEN_ENDINGS.forEach((pattern) => {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
          issues.push({
            line: lineIndex + 1,
            col: offset + match.index + 1,
            text: match[0],
            context: line.trim().slice(0, 100),
          });
        }
      });
    }
  });

  // Deduplicate by line+col
  const seen = new Set();
  return issues.filter((i) => {
    const key = `${i.line}:${i.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function walk(dir) {
  const files = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORE.some((i) => entry.name === i || entry.name.startsWith("."))) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...walk(fullPath));
      } else if (EXTENSIONS.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return files;
}

const files = walk(ROOT);
let totalIssues = 0;
const filesWithIssues = [];

for (const file of files) {
  const issues = scanFile(file);
  if (issues.length > 0) {
    const rel = path.relative(ROOT, file);
    filesWithIssues.push({ rel, issues });
    totalIssues += issues.length;
  }
}

if (totalIssues === 0) {
  console.log("✅ Nenhum texto quebrado encontrado. Encoding correto em todos os arquivos.");
  process.exit(0);
} else {
  filesWithIssues.forEach(({ rel, issues }) => {
    console.log(`\n⚠️  ${rel} (${issues.length} problema(s))`);
    issues.slice(0, 5).forEach((issue) => {
      console.log(`   L${issue.line}  padrão "${issue.text}"  →  ${issue.context}`);
    });
    if (issues.length > 5) console.log(`   ... e mais ${issues.length - 5} ocorrência(s)`);
  });
  console.log(`\n❌ Total: ${totalIssues} problema(s) em ${filesWithIssues.length} arquivo(s).`);
  process.exit(1);
}

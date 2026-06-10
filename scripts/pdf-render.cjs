// Standalone PDF renderer. Runs as a separate Node process so pdfmake (and its
// PDFKit/fontkit font loading) is loaded from real node_modules rather than the
// Next/Turbopack bundle — the bundler rewrites pdfkit's __dirname-relative font
// reads to a numeric module id, which throws at runtime. Loading here keeps
// those reads intact.
//
// Protocol: read a JSON payload { docDefinition, generated } from stdin, write
// the PDF bytes to stdout. Any error goes to stderr with a non-zero exit.

const fs = require("node:fs");
const path = require("node:path");

function registerFonts(Pdfmake) {
  const pkgEntry = require.resolve("pdfmake");
  const fontsDir = path.join(
    path.dirname(pkgEntry),
    "..",
    "build",
    "fonts",
    "Roboto",
  );
  const files = [
    "Roboto-Regular.ttf",
    "Roboto-Medium.ttf",
    "Roboto-Italic.ttf",
    "Roboto-MediumItalic.ttf",
  ];
  for (const f of files) {
    Pdfmake.virtualfs.writeFileSync(f, fs.readFileSync(path.join(fontsDir, f)));
  }
  Pdfmake.addFonts({
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  });
  Pdfmake.setLocalAccessPolicy(() => false);
  Pdfmake.setUrlAccessPolicy(() => false);
}

// The page footer is a function, so it can't cross the JSON boundary. Rebuild it
// here from the serializable `generated` timestamp.
function footer(generated) {
  return (current, total) => ({
    columns: [
      { text: `Generated ${generated}`, fontSize: 7, color: "#999" },
      {
        text: `Page ${current} of ${total}`,
        fontSize: 7,
        color: "#999",
        alignment: "right",
      },
    ],
    margin: [40, 0, 40, 20],
  });
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

(async () => {
  try {
    const input = await readStdin();
    const { docDefinition, generated } = JSON.parse(input);

    const Pdfmake = require("pdfmake");
    registerFonts(Pdfmake);

    docDefinition.footer = footer(generated);

    const doc = Pdfmake.createPdf(docDefinition);
    const buf = await doc.getBuffer();
    process.stdout.write(buf);
  } catch (e) {
    process.stderr.write(e && e.stack ? e.stack : String(e));
    process.exit(1);
  }
})();

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // officeparser does filesystem / binary work (document parsing) that breaks
  // when bundled. Load it from node_modules at runtime instead.
  // (pdfmake has the same problem but is run out-of-process via
  // scripts/pdf-render.cjs, so it never enters the bundle — see src/lib/reports/pdf.ts.)
  serverExternalPackages: ["officeparser"],
};

export default nextConfig;

import fs from "node:fs";
import path from "node:path";

const routesFile = path.join(process.cwd(), ".next", "dev", "types", "routes.d.ts");

if (!fs.existsSync(routesFile)) {
  fs.mkdirSync(path.dirname(routesFile), { recursive: true });
  fs.writeFileSync(routesFile, "// Stub for typecheck before next dev\nexport {};\n");
}

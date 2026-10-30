import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { compileFunction } from "node:vm"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// Execute the real action modules with explicit test-only framework/client seams.
export function loadActions(client, source, invalidations) {
  const modules = new Map()
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename)
    const loaded = { exports: {} }
    modules.set(filename, loaded.exports)
    const output = ts.transpileModule(filename === path.join(root, "app", "actions.ts") ? source : readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    compileFunction(output, ["require", "module", "exports"], { filename })((specifier) => {
      if (specifier === "@/lib/supabase/server") return { createClient: async () => client }
      // Interruption tests must never construct a real privileged/network client.
      if (specifier === "@/lib/supabase/admin") return { createAdminClient: () => { throw new Error("Admin client is outside the interruption fixture") } }
      if (specifier === "next/cache") return { revalidatePath: url => invalidations.push(url) }
      if (specifier.startsWith("@/")) return load(path.join(root, `${specifier.slice(2)}.ts`))
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`))
      throw new Error(`Unexpected dependency ${specifier}`)
    }, loaded, loaded.exports)
    return loaded.exports
  }
  return load(path.join(root, "app", "actions.ts"))
}

import dotenv from "dotenv";
import esbuild from "esbuild";
import path from "path";

const isDev = process.argv.includes("--dev");
const envName = isDev ? ".env" : ".env.production";
dotenv.config({ path: path.join(process.cwd(), envName) });

async function main() {
  const plugins = [
    {
      name: "rebuild-plugin",
      setup(build) {
        let count = 0;
        build.onEnd((_result) => {
          if (count++ === 0) console.log("Build success");
          else console.log("Incremental build success");
        });
      },
    },
  ];

  const safeEnvDefines = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key, _value]) => key.startsWith("VITE_"))
      .map(([key, value]) => [`process.env.${key}`, `"${value}"`])
  );

  const pluginContext = await esbuild.context({
    entryPoints: ["src/main.tsx", "src/on-message.tsx", "src/on-selection.tsx"],
    bundle: true,
    format: "iife",
    target: "es6", // Figma sandbox seems to miss some ESNext language features
    sourcemap: "inline", // TODO perf?
    minify: false, // TODO
    loader: {
      ".svg": "text",
    },
    define: safeEnvDefines,
    outdir: "dist",
    plugins,
  });

  if (isDev) {
    console.log("watching...");
    await pluginContext.watch();
  } else {
    console.log("build once...");
    pluginContext.rebuild();
    await pluginContext.dispose();
  }
}

main();

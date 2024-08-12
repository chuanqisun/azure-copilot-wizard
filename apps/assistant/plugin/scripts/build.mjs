import esbuild from "esbuild";

const isDev = process.argv.includes("--dev");

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

  const safeEnvDefines = {
    ...Object.fromEntries(
      Object.entries(process.env)
        .filter(([key, _value]) => key.startsWith("VITE_"))
        .map(([key, value]) => [`process.env.${key}`, `"${value}"`])
    ),
    "process.env.VITE_ENV": isDev ? `"development"` : `"production"`,
  };

  const context = await esbuild.context({
    entryPoints: ["src/main.tsx"],
    bundle: true,
    format: "iife",
    target: "es6", // Figma sandbox seems to miss some ESNext language features
    sourcemap: "inline", // TODO perf?
    minify: false, // TODO
    loader: {
      ".svg": "text",
      ".html": "text",
      ".png": "dataurl",
    },
    define: safeEnvDefines,
    outdir: "dist",
    plugins,
  });

  if (isDev) {
    console.log("watching...");
    await context.watch();
  } else {
    console.log("build once...");
    context.rebuild();
    await context.dispose();
  }
}

main();

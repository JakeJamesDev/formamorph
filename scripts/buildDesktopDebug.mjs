// Builds dist/ with the DEV hooks left in, for `npm run desktop:debug`.
//
// The desktop shell loads dist/, and `npm run desktop:dev` builds it in production mode — which strips
// `window.__fmDev` along with every other DEV-gated hook. That leaves the desktop build, the only one where
// the bundled engine exists, as the one place the dev router cannot reach: verifying anything engine-related
// meant driving raw CDP against a minified bundle.
//
// `vite build` pins NODE_ENV to production on its own, and `import.meta.env.DEV` follows NODE_ENV rather than
// --mode, so the env var has to be set before Vite loads. Hence a script rather than a shell one-liner (npm
// scripts run under cmd.exe on Windows, where inline `VAR=value` does not work).
process.env.NODE_ENV = 'development';

const { build } = await import('vite');
await build({ mode: 'development' });

console.log('\nBuilt dist/ in development mode — window.__fmDev is available.');
console.log('Run `npm run build` before packaging; this output is unminified and DEV-gated code is present.');

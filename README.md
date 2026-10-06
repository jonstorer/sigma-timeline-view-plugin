# sigma-plugins

A monorepo of Sigma Computing plugins, built on
[vis-timeline](https://visjs.github.io/vis-timeline/) and friends where
relevant. Each plugin is its own npm workspace under `plugins/`, with its own
`package.json`, deployed independently to its own folder in a shared S3
bucket (`s3://<bucket>/<plugin-name>/`) — see [Deploying](#deploying).

## Plugins

| Plugin | Path | What it does |
|---|---|---|
| gantt | [`plugins/gantt`](plugins/gantt) | Renders worksheet rows as a Gantt-style timeline. |
| markdown | [`plugins/markdown`](plugins/markdown) | Renders a text column's value as Markdown — built for use inside a Repeated Container (one card per row). |

Each plugin's own README has its full config/editor-panel docs.

## Dev

```bash
npm install          # once, from the repo root — installs every plugin's deps
npm run dev --workspace=gantt
```

Then in Sigma, drop a "Plugin Dev Playground" element on a workbook page and
point it at the dev server's URL (see that plugin's own README for the port).

## Repo layout

- `plugins/<name>/` — one npm workspace per plugin: its own `src/`,
  `package.json` (runtime dependencies + `dev`/`build`/`typecheck`/`test`/
  `deploy` scripts), Vite config, and TS project config. Fully self-contained;
  nothing here imports across plugins (yet — see
  [Adding a plugin](#adding-a-plugin) if that changes).
- Root `package.json` — the npm workspaces root. Holds shared tooling
  (`vite`, `vitest`, `eslint`, `typescript`, `@testing-library/*`, etc.) as
  devDependencies, hoisted so every plugin can use them without duplicating
  versions. `npm run lint` / `typecheck` / `test` at the root fan out across
  all plugins (see scripts below).
- `eslint.config.js` — one flat config for the whole repo; lints every
  plugin's `src/` in a single pass.
- `scripts/deploy.sh` — shared deploy script, parameterized by plugin name
  (`deploy.sh <plugin-name>`); see [Deploying](#deploying).
- `lerna.json` — see [Versioning](#versioning).

## Root scripts

| Script | What it does |
|---|---|
| `npm run lint` | ESLint across every plugin in one pass. |
| `npm run typecheck` | `lerna run typecheck` — runs each plugin's own `typecheck` script (`tsc -b --noEmit`), cached per-package. |
| `npm test` | `lerna run test` — runs each plugin's own `test` script (`vitest run`), cached per-package. |
| `npm run release` | `lerna version` — bump and tag whichever plugins changed; see [Versioning](#versioning). |

`dev` / `build` / `preview` / `deploy` are per-plugin (you work on one plugin
at a time) — run them with `--workspace=<name>`, e.g.
`npm run build --workspace=gantt`, or `cd plugins/<name>` and run them
unprefixed.

## Versioning

Plugins version **independently** — `gantt` at `0.3.1`, some other plugin at
`0.1.0`, no shared repo-wide version number. That's what
`"version": "independent"` in `lerna.json` means, and it matches how the
plugins themselves are independent products sharing infra, not one coherent
release.

```bash
npm run release          # interactive: pick a bump per changed plugin
```

This bumps the version(s) in the affected `plugins/*/package.json`, commits
the change, and tags it `<plugin-name>@<version>` (e.g. `gantt@0.3.1`) — one
tag per plugin, so you can tell at a glance which version of which plugin is
live. It does **not** push — `command.version.push` is `false` in
`lerna.json` on purpose, so publishing a release (`git push --follow-tags`)
stays a separate, deliberate step rather than something a single command does
silently. It also doesn't publish anywhere (no npm registry involved) — these
plugins ship to S3 via `deploy.sh`, not `npm publish`.

**Note:** don't name any root or plugin script `version` — it collides with
npm/Lerna's reserved version-lifecycle hook, and `lerna version` will find and
re-run it on itself mid-bump (confirmed the hard way while setting this up).
That's why the root script above is `release`, not `version`.

## Deploying

All plugins share one S3 bucket; each gets its own top-level folder:

```
s3://<bucket>/gantt/index.html
s3://<bucket>/gantt/assets/...
s3://<bucket>/<next-plugin>/index.html
...
```

A plugin's `npm run deploy` builds it and runs
`scripts/deploy.sh <plugin-name>`, which syncs that plugin's `dist/` to
`s3://${S3_BUCKET}/<plugin-name>/`. The `--delete` in that sync is scoped to
the plugin's own prefix, so deploying one plugin can't touch another's files.

CI (`.github/workflows/deploy.yml`) deploys the `gantt` workspace explicitly
on push to `staging`/`production`. Environment wiring (which bucket, which
AWS role) is unchanged from before this repo became a monorepo — out of scope
here; see that workflow file for the current setup.

## Adding a plugin

1. `mkdir plugins/<name>` and give it the same shape as `plugins/gantt`: its
   own `package.json` (name, scripts, runtime `dependencies` only — shared
   tooling comes from the root), `vite.config.ts`, `index.html`,
   `tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`, `src/`.
2. `npm install` from the repo root to wire up the new workspace.
3. Add a step to `.github/workflows/deploy.yml` for it (or fold both into a
   matrix once there are more than two — not worth the indirection yet with
   just gantt).
4. Add a row to the [Plugins](#plugins) table above.

If plugins start sharing real code (date utilities, a Sigma API wrapper,
etc.), pull it into its own `plugins/shared` (or `packages/shared`) workspace
at that point — not before; there's nothing to share yet.

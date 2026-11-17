# govstack-specification-renderer-test

**Unofficial preview.** This repository publishes a GitHub Pages rendering of the
GovStack File Management Building Block specification for review purposes only.
It is not an official GovStack publication; the authoritative specifications live
at <https://specs.govstack.global/>.

- Content: [GovStackWorkingGroup/bb-file-management](https://github.com/GovStackWorkingGroup/bb-file-management),
  branch `v0.6`, profile `framework`
- Renderer: this repository, a modified copy of
  [jeremi/govstack-specification-site](https://github.com/jeremi/govstack-specification-site).
  Upstream `main` was merged with its full history at
  [`d79845554e7a3ceeb400c7a1339b67d323776626`](https://github.com/jeremi/govstack-specification-site/commit/d79845554e7a3ceeb400c7a1339b67d323776626)
  ("fix: keep page navigation subordinate to content"), so later upstream fixes
  can be merged with `git fetch upstream && git merge upstream/main`.
- Preview: <https://nicolk.github.io/govstack-specification-renderer-test/>

The [Pages workflow](.github/workflows/pages.yml) builds the content with the
renderer in this repository (`uses: ./renderer`) on every push to `main`, on
manual dispatch, and daily so new content commits are picked up. Every page
carries an "Unofficial preview" banner and is marked `noindex, nofollow`.

## Changes from upstream

- Requirement `contract:` values that are identifiers with a non-http(s) URI
  scheme, such as `contract: "govstack:spec:bb:information-mediator"`, render as
  plain code instead of a broken link below the site base. `http(s)` contracts
  are external links and local paths are linked as before. This replaces the
  `sed` workaround used by
  [nicolk/bb-file-management-preview](https://github.com/nicolk/bb-file-management-preview).
- The framework sidebar has one "Requirements of <module>" group per
  `conformance_modules` entry in `metadata.yml`, in metadata order, labelled
  with the module page's title (e.g. "Requirements of File Management core")
  and listing its `functionalities` in order. Requirement pages that no module
  lists stay in a trailing "Requirements" group, and a functionality that is not
  a requirements page in `toc.yml` fails generation. Without
  `conformance_modules` the sidebar is unchanged. Section labels turn hyphens
  into spaces ("Conformance modules" instead of "Conformance-modules").
- Without `api-references.yml`, a `resources/api.yml` contract (the
  Specification Framework location, usually a symlink to `api/openapi.yaml`)
  enables the "API reference" chapter as one normative reference, with the same
  safety checks (symlink inside the source, no remote `$ref`s, published
  dependency closure, source digest). Its Scalar page is generated at
  `/api-reference/specification/` ("API specification") instead of replacing a
  source page, so `resources/api-reference.md` stays an ordinary prose page.
  With `api-references.yml` the declared pages are replaced by Scalar as before.
- A generated "API overview" page (`/api-reference/overview/`) leads the "API
  reference" chapter in both modes. For non-technical readers it shows only the
  API title, summary and description, then each tag with its description and
  operations (including webhooks; untagged ones under "Other operations"), each
  as a card with its summary and description. A trailing `---` +
  `**Technical notes:**` part of an operation description is left out; methods,
  paths, parameters, schemas, responses, security, servers and `x-*` extensions
  are never shown. Operation headings are anchored by operationId (`#uploadfile`).
- Added the [GitHub Pages preview workflow](.github/workflows/pages.yml) and this
  section.

---

# GovStack specification renderer

One Astro/Starlight project renders GovStack specification sources with the
same branding, navigation, search, heading links, and verification tools. Each
kind of source has its own input adapter; the renderer is shared. Rendering must
not change normative meaning: adapters carry requirement text, identifiers, and
classifications through unchanged, and the canonical source repositories stay
authoritative.

## Profiles

| Profile | Input |
| --- | --- |
| `api-guide` | The API design guide: `SUMMARY.md`, Markdown, `rules.yaml`, and linter coverage |
| `framework` | A framework-format specification: `metadata.yml`, `authors.yml`, `toc.yml`, and Markdown |

Every profile requires an explicit source, either `--source` or the
`DOCS_SOURCE_ROOT` environment variable. There is no default, so a build cannot
silently pick up a different or dirty checkout.

## OpenAPI references

Framework sources can opt into Scalar references with `api-references.yml`:

```yaml
references:
  - id: consultation
    page: resources/api-reference.md
    contract: api/openapi.yaml
    role: normative
  - id: birth-registration
    page: resources/api-examples/birth-registration.md
    contract: api/examples/birth-registration.openapi.yaml
    role: example
```

Each `page` identifies a Markdown page in the source navigation. On these pages,
the renderer replaces the prose with native Scalar, a short role label, download
links, and closed technical metadata. There is no iframe or repeated introductory
response. Examples stay inside the owning contract. A missing local dependency
fails the build. An optional `operationId` and successful `response` pair can
validate a published response example; `example` selects a named example for
that pair. These selection fields are not needed to render a contract.

`role` is explicit: `normative` labels a draft transport contract, while `example`
labels an illustrative binding that adds no conformance requirements. Both the
navigation and reference page retain that distinction. Response values remain
illustrative even on a normative contract page.

Scalar 1.76.4 and bundled contracts are served locally, including project-subpath
deployments. Contract references must resolve inside the source repository;
remote references and escaping symlinks are rejected. Source contract bytes stay
unchanged and every dependency contributes to the source digest. API execution,
AI chat, and telemetry are disabled; references follow the site's theme.
Sources without this configuration retain their existing pages and navigation.
Operation-level `x-*` metadata is collected for every Building Block, without
requiring Digital Registries extensions. Built-output checks verify the native
host, role label, collapsed metadata, and bundled contract digest.

## Local use

Use Node 24.11 or later. From this directory:

```sh
npm ci --ignore-scripts
npm run check -- --profile api-guide --source /absolute/path/to/api-design-guide
npm run preview -- --profile framework --source /absolute/path/to/specification --port 4336
```

`build`, `dev`, `generate`, `check:built`, and `test:served` accept the same
`--profile`, `--source`, `--output`, and `--base` options. Use the same source,
base and output when previewing or checking an existing build. A project subpath
works as follows:

```sh
npm run check -- --profile api-guide --source /absolute/path/to/api-design-guide --base /api-guide/ --output /absolute/path/to/scratch-output
```

All previews bind to loopback. No deployment or publication command is included.
`dev` generates source content once; regenerate after editing the authoritative
input. Use a static build plus `preview` to verify the Pagefind search index.

## Unofficial deployments

Pass `--unofficial` (or set `DOCS_UNOFFICIAL=1`) when a build is published
outside the GovStack process. Every page then carries a non-dismissible
"Unofficial preview" warning banner that links to https://specs.govstack.global/,
the preview label becomes "Unofficial preview", every HTML page (including
legacy redirects and download indexes) gets `<meta name="robots" content="noindex, nofollow">`,
and the site root gets a `robots.txt` with `User-agent: *` and `Disallow: /`.
`check-built` and `test-served` then also require the banner, `nofollow`, and
`robots.txt`. Without the flag, output is unchanged.

Crawlers honour `robots.txt` only at a host root. On a GitHub Pages project
subpath (for example `/govstack-api-design-guide/`) the file is not consulted,
so the meta tag is the effective control there.

`--source-url <github blob root>` (or `DOCS_SOURCE_URL`) sets where the
`api-guide` profile points "Edit page" and linter links. It must be an `https://`
URL without query or fragment, and contain `/blob/`; the edit root swaps `/blob/`
for `/edit/`. The default is the `bb-template/api-design-guide` location.
Example deploy build for a guide that lives at the root of its own repository:

```sh
npm run check -- --profile api-guide --source /absolute/path/to/govstack-api-design-guide --base /govstack-api-design-guide/ --unofficial --source-url https://github.com/jeremi/govstack-api-design-guide/blob/main
```

## Tests

`npm test` runs the fixture tests. Four tests need an external checkout and are
skipped, with the reason printed, unless these variables are set:

| Variable | Meaning |
| --- | --- |
| `GOVSTACK_API_GUIDE_SOURCE_ROOT` | The API design guide source |
| `GOVSTACK_API_GUIDE_RENDERER_ROOT` | The frozen previous API guide renderer used as the parity reference |
| `GOVSTACK_FRAMEWORK_SOURCE_ROOT` | A framework-format specification source |
| `GOVSTACK_FRAMEWORK_RENDERER_ROOT` | The frozen previous framework renderer used as the parity reference |

## Consumers

- `bb-template/api-design-guide-site` is a thin wrapper. Its npm scripts call
  this CLI with `--profile api-guide --source ../api-design-guide --output dist`.
  It finds the renderer at `../../govstack-specification-site` or at
  `GOVSTACK_SITE_RENDERER`.
- Framework-format specifications call the CLI directly with
  `--profile framework --source <specification>`.
- The template's `specification-site/` directory is a thin framework wrapper
  that can be copied into a Building Block. It checks source-format and native
  Scalar compatibility before running the shared renderer.
- [`action.yml`](action.yml) provides a build-only composite GitHub Action.
  See [Building Block integration](docs/building-block-integration.md) for local
  setup, pinned CI consumption, and activation prerequisites.

## Not yet

The repository is available at
<https://github.com/jeremi/govstack-specification-site>. Consumers can pin a
published full commit; tagged releases are not required. The native Scalar
integration and composite action must be published before hosted consumers can
select them. A local checkout works through `GOVSTACK_SITE_RENDERER` meanwhile.

## Ownership and generated files

- `adapters/api-guide.mjs` reads the existing `SUMMARY.md`, Markdown,
  `rules.yaml`, and linter coverage contract without reclassifying its rules.
- `adapters/framework.mjs` treats root `README.md` and the pages listed in
  `toc.yml` as the complete page inventory, then reads functionality frontmatter
  and explicitly referenced support material.
- `src/` owns the shared presentation. It contains no hand-maintained copies
  of either publication's prose or requirements.
- `scripts/publication.mjs` normalizes adapter output into a common manifest.
- `.generated/<profile>-<hash>/` is disposable renderer-owned scratch, where the hash is the first 12 hex characters of the SHA-256 of the canonical source path, so different sources never share a workspace. It holds the
  generated Markdown, support assets, adapter manifest, and `publication.json`.
- `dist/<profile>/` contains the independent static outputs. Builds for different
  profiles do not overwrite one another. Per-publication locks (keyed by profile and source path) protect generated
  workspaces; a shared lock serializes Astro's build workspace. Interrupted
  commands release their locks, and abandoned locks recover after their heartbeat expires.

Builds are checked in renderer-owned staging before copying to the requested
output, including outputs on another volume. Promotion preserves unrelated files
and refuses symlink destinations or obsolete HTML routes. Use a fresh output
directory when a publication intentionally removes a route.

The runtime content loader uses the manifest page allowlist. For framework
sources, a relative Markdown link must target root `README.md` or a page listed
in `toc.yml`; generation fails instead of silently adding another page.
Supporting HTML and redirects must also be declared explicitly. Generated
directories are ignored; change the input or generator rather than editing
generated content.
Starlight's Markdown processing includes the generated content directory, so
native heading permalinks and asides use the same transforms as ordinary docs.

Framework support files come from an explicit publication graph: page links,
images and reference definitions; raw HTML `href` and `src` attributes;
functionality `contract` and `test` values; and the source metadata downloads
`toc.yml`, `metadata.yml`, and `authors.yml`. A linked directory publishes its
allowed non-Markdown tree. Referenced YAML and JSON files add their local
`$ref` and `$dynamicRef` dependency closure. An `api-references.yml` contract
independently publishes its original source and local dependency closure as well
as the generated bundle; the configuration file itself is not a download.
Unreferenced repository files, including lockfiles and tooling, are not
published.

Hidden operational/configuration paths, including environment files, remain
excluded. Explicit `.well-known` publication assets and `.github` references
can be published. References or symlink aliases to excluded paths fail
generation. Static checks and output promotion also reject excluded paths,
including files left in an older output directory. Choose a fresh output rather
than deleting unrelated files.

## Adapter boundary

Each adapter exports `generateSite({ sourceRoot, siteRoot, base })` and returns
its source-derived manifest. `siteRoot` is the generated workspace, never the
authoritative source tree. The common manifest contains:

| Field | Meaning |
| --- | --- |
| `schemaVersion`, `profile` | Renderer schema and selected input adapter |
| `title`, `version`, `publicationKind` | Source identity; an unassigned formal kind stays null |
| `pages` | Source path, route, title, and source anchors for every permitted page |
| `sidebar` | Ordered navigation derived by the adapter |
| `supportFiles`, `supportIndexes`, `redirects` | Explicit support and compatibility output |
| `downloads` | Source/output mappings and labels for provenance links |
| `sourceRoot`, `sourceRevision`, `sourceDirty`, `sourceDigest` | Exact source location and snapshot provenance |
| `previewLabel`, `contentWidth`, `base` | Local presentation settings, separate from publication semantics |

The renderer labels its state **Local authoring preview** and adds `noindex`.
It does not assign a formal publication kind, issue requirement IDs or URNs,
map guide M/R notation to framework classifiers, or certify official compiler
compatibility. Existing requirement fields and documentation are retained by
the adapters. A framework `test` link identifies a reference, not a passed test.

## Checks

`npm run check` runs the tests, then Astro checks, a static build,
route/anchor/link/asset and Pagefind checks, then an isolated HTTP preview. The
HTTP checks request every page, validate downloads, 404 behavior, and structured
requirement totals. Browser QA covers search interaction, theme and mobile
behavior, diagrams, and heading-link spacing. Static checks alone do not
establish those interactions. Tests compare source bytes before and after
generation, with current Git state rather than a pinned session commit.

## License

The renderer is licensed under the [Apache License 2.0](LICENSE). The GovStack
logos in `src/assets/` belong to GovStack and are not covered by this license.

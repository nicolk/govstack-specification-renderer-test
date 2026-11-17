import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { generateSite } from '../adapters/framework.mjs';
import { apiOverviewMarkdown, withoutTechnicalNotes } from '../scripts/api-references.mjs';

const execFileAsync = promisify(execFile);
const BASE = '/preview/';

async function write(root, relative, contents) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

const contract = `openapi: 3.1.2
info:
  title: Fixture Files API
  version: 1.0.0
  summary: Store & find <files>.
  description: |-
    Keeps **documents** safe.

    ## Data

    - A File has content.

    | Group | Use |
    | --- | --- |
    | Files | Store |

    <script>alert('raw')</script>
servers:
  - url: https://files.example.invalid
security:
  - oauthScheme: [scope-read]
tags:
  - name: Files
    description: Files and their content.
  - name: Events
    description: Notifications about Files.
  - name: Unused
    description: No operation uses this tag.
paths:
  /status:
    get:
      operationId: getStatus
      summary: Check the status
      description: An untagged operation.
      x-fixture-extension: EXTENSION-VALUE
      responses:
        '200':
          description: STATUS-RESPONSE-TEXT
  /files:
    post:
      operationId: uploadFile
      summary: Upload a File
      tags: [Files]
      description: |-
        **Purpose:** Stores a File.

        ### Steps

        1. Choose the Container.

        ---

        **Technical notes:** Returns \`201\` with TECHNICAL-DETAIL.
      parameters:
        - name: limitParameter
          in: query
          schema:
            type: integer
      requestBody:
        content:
          application/json:
            schema:
              $ref: './common/file.schema.json'
      responses:
        '201':
          description: CREATED-RESPONSE-TEXT
  /files/{fileId}:
    get:
      operationId: retrieveFile
      summary: Retrieve a File
      tags: [Files, Events]
      description: |-
        Part one.

        ---

        Part two stays because it is not a technical note.
      responses:
        '200':
          description: RETRIEVED-RESPONSE-TEXT
webhooks:
  fileEvent:
    post:
      operationId: receiveFileEvent
      summary: Receive a File event
      tags: [Events]
      description: An event arrives at the subscriber.
      responses:
        '204':
          description: ACKNOWLEDGED-RESPONSE-TEXT
`;

async function source({ contractText = contract, link = '../api/openapi.yaml', toc } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'govstack-api-overview-'));
  const sourceRoot = path.join(root, 'source');
  const siteRoot = path.join(root, 'site');
  await write(sourceRoot, 'toc.yml', toc ?? `toc:
  introduction:
    - purpose.md
  resources:
    - api-reference.md
`);
  await write(sourceRoot, 'metadata.yml', `name: Fixture Files
abstract: A fixture specification.
url: https://example.invalid/files/
repository: https://github.com/example/files
versions:
  - version: 1.0.0-draft
    release_date:
    short_description: Fixture draft.
    latest: true
`);
  await write(sourceRoot, 'authors.yml', 'authors:\n  - name: Example Author\n    roles: [Author]\n');
  await write(sourceRoot, 'README.md', '# Fixture Files\n\nIntroduction.\n');
  await write(sourceRoot, 'introduction/purpose.md', '# Purpose\n\nWhy.\n');
  await write(sourceRoot, 'resources/api-reference.md', '# API reference\n\nHand-written operations table and design decisions.\n');
  await write(sourceRoot, 'api/openapi.yaml', contractText);
  await write(sourceRoot, 'api/common/file.schema.json', '{"type":"object","properties":{"name":{"type":"string"}}}\n');
  if (link) await symlink(link, path.join(sourceRoot, 'resources/api.yml'));
  await execFileAsync('git', ['init', '-q', root]);
  await execFileAsync('git', ['-C', root, 'add', 'source']);
  await execFileAsync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
  return { root, sourceRoot, siteRoot };
}

const headings = (markdown) => [...markdown.matchAll(/^(#{2,6}) (.*?)(?: <a id="([^"]+)" href="#\3"><\/a>)?$/gm)]
  .map(([, hashes, text, id]) => `${hashes.length} ${text}${id ? ` #${id}` : ''}`);

test('technical notes are omitted only after a --- line followed by the Technical notes label', () => {
  assert.equal(withoutTechnicalNotes('Keep this.\n\n---\n\n**Technical notes:** Drop this.'), 'Keep this.');
  assert.equal(withoutTechnicalNotes('Keep.\n\n---\n\nAlso keep.'), 'Keep.\n\n---\n\nAlso keep.');
  assert.equal(
    withoutTechnicalNotes('A.\n\n---\n\nB.\n\n---\n**Technical notes:** C.'),
    'A.\n\n---\n\nB.',
  );
  assert.equal(withoutTechnicalNotes('No separator **Technical notes:** stays.'), 'No separator **Technical notes:** stays.');
  assert.equal(withoutTechnicalNotes(undefined), '');
});

test('resources/api.yml without api-references.yml publishes a generated specification and overview', async (t) => {
  const { root, sourceRoot, siteRoot } = await source();
  t.after(() => rm(root, { recursive: true }));
  const manifest = await generateSite({ sourceRoot, siteRoot, base: BASE, unofficial: true });

  const generated = manifest.pages.filter((page) => page.generated);
  assert.deepEqual(generated.map(({ route, title }) => [route, title]), [
    ['api-reference/overview', 'API overview'],
    ['api-reference/specification', 'API specification'],
  ]);
  assert.ok(generated[0].anchors.some(({ id }) => id === 'uploadfile'));

  const apiGroup = manifest.sidebar.find((entry) => entry.label === 'API reference');
  assert.deepEqual(apiGroup.items, [
    { label: 'API overview', slug: 'api-reference/overview' },
    { label: 'Normative draft', items: [{ label: 'API specification', slug: 'api-reference/specification' }] },
  ]);
  assert.deepEqual(
    manifest.sidebar.find((entry) => entry.label === 'Resources').items,
    [{ label: 'API reference', slug: 'resources/api-reference' }],
  );
  const prose = await readFile(path.join(siteRoot, 'src/content/docs/resources/api-reference.md'), 'utf8');
  assert.match(prose, /Hand-written operations table and design decisions\./);
  assert.doesNotMatch(prose, /data-scalar-reference/);

  assert.equal(manifest.apiReferences.length, 1);
  const [reference] = manifest.apiReferences;
  assert.equal(reference.route, 'api-reference/specification');
  assert.equal(reference.contract, 'api/openapi.yaml');
  assert.equal(reference.declaredContract, 'resources/api.yml');
  assert.equal(reference.contractUrl, '/preview/api-reference/specification.json');
  const specification = await readFile(path.join(siteRoot, 'src/content/docs/api-reference/specification.md'), 'utf8');
  assert.match(specification, /^title: API specification$/m);
  assert.match(specification, /^tableOfContents: false$/m);
  assert.match(specification, /data-scalar-reference data-contract-url="\/preview\/api-reference\/specification\.json"/);
  assert.match(specification, /content: noindex, nofollow/);
  for (const file of ['api/openapi.yaml', 'api/common/file.schema.json', 'api-reference/specification.json']) {
    assert.ok(manifest.supportFiles.includes(file), file);
    await access(path.join(siteRoot, 'public', file));
  }

  const overview = await readFile(path.join(siteRoot, 'src/content/docs/api-reference/overview.md'), 'utf8');
  assert.match(overview, /^title: API overview$/m);
  assert.doesNotMatch(overview, /^tableOfContents: false$/m);
  assert.deepEqual(headings(overview), [
    '2 Fixture Files API #fixture-files-api',
    '3 Data #data',
    '3 Files #files',
    '4 Upload a File #uploadfile',
    '5 Steps #steps',
    '4 Retrieve a File #retrievefile',
    '3 Events #events',
    '4 Retrieve a File #retrieve-a-file',
    '4 Receive a File event #receivefileevent',
    '3 Other operations #other-operations',
    '4 Check the status #getstatus',
  ]);
  assert.match(overview, /class="api-reference-badge"[^>]*>Normative contract \(draft\)</);
  assert.match(overview, /summarises the API in plain language; for technical details, see the <a href="\/preview\/api-reference\/specification\/">API specification<\/a>/);
  assert.match(overview, /<p class="api-overview-lead">Store &amp; find &lt;files&gt;\.<\/p>/);
  assert.match(overview, /Keeps \*\*documents\*\* safe\./);
  assert.match(overview, /\| Files \| Store \|/);
  assert.match(overview, /&lt;script&gt;alert\(&#39;raw&#39;\)&lt;\/script&gt;/);
  assert.doesNotMatch(overview, /<script>/);
  assert.match(overview, /Files and their content\./);
  assert.match(overview, /\*\*Purpose:\*\* Stores a File\.\n\n##### Steps/);
  assert.match(overview, /1\. Choose the Container\.\n\n<\/section>/);
  assert.match(overview, /Part one\.\n\n---\n\nPart two stays because it is not a technical note\./);
  assert.match(overview, /An event arrives at the subscriber\./);
  assert.match(overview, /An untagged operation\./);
  assert.equal((overview.match(/<section class="api-overview-operation">/g) ?? []).length, 5);
  assert.doesNotMatch(overview, /No operation uses this tag|Unused/);
  for (const hidden of [
    'Technical notes', 'TECHNICAL-DETAIL', '/files', '/status', 'fileEvent', 'limitParameter', 'RESPONSE-TEXT',
    'files.example', 'oauthScheme', 'scope-read', 'x-fixture', 'EXTENSION-VALUE', 'file.schema', 'openapi', '1.0.0',
  ]) {
    assert.equal(overview.includes(hidden), false, `${hidden} must not be shown`);
  }
  assert.doesNotMatch(overview, /\b(?:GET|POST|PUT|PATCH|DELETE)\b|\b20[014]\b/);
});

test('the source digest covers the contract reached through resources/api.yml', async (t) => {
  const first = await source();
  const second = await source({ contractText: contract.replace('An untagged operation.', 'A changed operation.') });
  t.after(() => Promise.all([rm(first.root, { recursive: true }), rm(second.root, { recursive: true })]));
  const [one, two] = await Promise.all([
    generateSite({ sourceRoot: first.sourceRoot, siteRoot: first.siteRoot, base: BASE }),
    generateSite({ sourceRoot: second.sourceRoot, siteRoot: second.siteRoot, base: BASE }),
  ]);
  assert.notEqual(one.sourceDigest, two.sourceDigest);
});

test('without resources/api.yml or api-references.yml there is no API reference chapter', async (t) => {
  const { root, sourceRoot, siteRoot } = await source({ link: null });
  t.after(() => rm(root, { recursive: true }));
  const manifest = await generateSite({ sourceRoot, siteRoot, base: BASE });
  assert.equal(manifest.sidebar.some((entry) => entry.label === 'API reference'), false);
  assert.equal(manifest.pages.some((page) => page.generated), false);
  assert.deepEqual(manifest.apiReferences, []);
});

test('resources/api.yml keeps the contract safety checks', async (t) => {
  const outside = await source({ link: '../../outside.yaml' });
  await writeFile(path.join(outside.root, 'outside.yaml'), contract);
  const dangling = await source({ link: '../api/missing.yaml' });
  const remote = await source({
    contractText: contract.replace("$ref: './common/file.schema.json'", "$ref: 'https://example.invalid/file.schema.json'"),
  });
  t.after(() => Promise.all([outside, dangling, remote].map(({ root }) => rm(root, { recursive: true }))));
  await assert.rejects(
    generateSite({ sourceRoot: outside.sourceRoot, siteRoot: outside.siteRoot, base: BASE }),
    /symlink escapes the source: resources\/api\.yml/,
  );
  await assert.rejects(
    generateSite({ sourceRoot: dangling.sourceRoot, siteRoot: dangling.siteRoot, base: BASE }),
    /resources\/api\.yml: symlink target does not exist/,
  );
  await assert.rejects(
    generateSite({ sourceRoot: remote.sourceRoot, siteRoot: remote.siteRoot, base: BASE }),
    /remote references are not permitted/,
  );
});

test('a source page on a generated API route fails generation', async (t) => {
  const { root, sourceRoot, siteRoot } = await source({ toc: `toc:
  api-reference:
    - overview.md
` });
  t.after(() => rm(root, { recursive: true }));
  await write(sourceRoot, 'api-reference/overview.md', '# Overview\n\nSource page.\n');
  await assert.rejects(
    generateSite({ sourceRoot, siteRoot, base: BASE }),
    /api-reference\/overview\.md: route api-reference\/overview is reserved for the generated API overview page/,
  );
});

test('several normative contracts get one overview section each', () => {
  const contracts = ['Alpha', 'Beta'].map((name) => ({
    reference: { role: 'normative', label: 'Normative contract (draft)', title: `${name} reference`, route: `contracts/${name.toLowerCase()}` },
    document: {
      info: { title: `${name} API`, description: `About ${name}.` },
      paths: { '/items': { get: { operationId: 'listItems', summary: `List ${name} items` } } },
    },
  }));
  const markdown = apiOverviewMarkdown(contracts, { base: BASE });
  assert.deepEqual(headings(markdown), [
    '2 Alpha API #alpha-api',
    '3 Other operations #other-operations',
    '4 List Alpha items #listitems',
    '2 Beta API #beta-api',
    '3 Other operations #other-operations-1',
    '4 List Beta items #listitems-1',
  ]);
  assert.match(markdown, /summarises each API in plain language/);
  assert.match(markdown, /Technical details: <a href="\/preview\/contracts\/alpha\/">Alpha reference<\/a>/);
  assert.match(markdown, /Technical details: <a href="\/preview\/contracts\/beta\/">Beta reference<\/a>/);
});

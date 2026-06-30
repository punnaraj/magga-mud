import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifestPath = 'releases/public-alpha-v0.1.0.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest.schemaVersion !== 1 || manifest.phase !== 'alpha' || manifest.visibility !== 'public') {
  throw new Error('Invalid public-alpha release identity');
}
if (manifest.source?.ref !== 'refs/tags/public-alpha-v0.1.0') {
  throw new Error('Release source tag is not pinned');
}
if (manifest.artifactStore?.bucket !== 'punnaraj-public-artifacts') {
  throw new Error('Unexpected public artifact bucket');
}
if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== 1) {
  throw new Error('Expected exactly one PUNNARAJ-authored alpha artifact');
}

for (const artifact of manifest.artifacts) {
  if (!/^[0-9a-f]{64}$/.test(artifact.sha256)) throw new Error(`Invalid artifact SHA-256: ${artifact.id}`);
  if (!Number.isSafeInteger(artifact.byteSize) || artifact.byteSize <= 0) throw new Error(`Invalid artifact size: ${artifact.id}`);
  if (!artifact.objectKey.includes(`/${artifact.sha256}/`)) throw new Error(`Artifact key is not checksum-addressed: ${artifact.id}`);
  if (artifact.bootableOperatingSystem !== false) throw new Error(`Recovery payload boot claim is invalid: ${artifact.id}`);
}

for (const dependency of manifest.upstreamDependencies || []) {
  if (!/^[0-9a-f]{64}$/.test(dependency.sha256)) throw new Error(`Invalid upstream SHA-256: ${dependency.id}`);
  if (dependency.mirroredToPublicR2 !== false) throw new Error(`Unexpected upstream mirror declaration: ${dependency.id}`);
  if (!dependency.url.startsWith('https://')) throw new Error(`Invalid upstream URL: ${dependency.id}`);
}

async function verifyLocalArtifact(file, expected, label) {
  await access(file);
  const fileStat = await stat(file);
  if (fileStat.size !== expected.byteSize) throw new Error(`${label} size mismatch: ${fileStat.size}`);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const actual = hash.digest('hex');
  if (actual !== expected.sha256) throw new Error(`${label} hash mismatch: ${actual}`);
  console.log(`${label} verified: ${actual}`);
}

if (process.env.PUNNARAJ_RELEASE_ARTIFACT) {
  await verifyLocalArtifact(process.env.PUNNARAJ_RELEASE_ARTIFACT, manifest.artifacts[0], 'Published release artifact');
}
if (process.env.PUNNARAJ_RECOVERY_IMAGE) {
  await verifyLocalArtifact(process.env.PUNNARAJ_RECOVERY_IMAGE, manifest.artifacts[0].expanded, 'Expanded recovery image');
}

console.log(`Release manifest passed: ${manifest.releaseId}`);

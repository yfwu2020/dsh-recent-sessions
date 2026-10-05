import { readFileSync } from 'node:fs';

try {
  const tag = process.argv[2];
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag ?? '')) {
    throw new Error('Expected a stable release tag in the form vX.Y.Z.');
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  if (pkg.name !== '@yfwu2020/dsh-recent-sessions' || lock.name !== pkg.name || lock.packages?.['']?.name !== pkg.name) {
    throw new Error('Unexpected package name in package.json or the lockfile.');
  }
  if (tag !== `v${pkg.version}`) {
    throw new Error(`Release tag ${tag} does not match package version ${pkg.version}.`);
  }
  if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) {
    throw new Error(`The lockfile does not match package version ${pkg.version}.`);
  }
  console.log(pkg.version);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
const require = createRequire(import.meta.url);
const { verifyUpdateMetadata } = require('../scripts/verify-update-metadata.cjs');
describe('published update metadata', () => {
  it('verifies architecture payloads and integrity against real files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-update-meta-'));
    try {
      const files = ['widget-arm64.zip', 'widget-x64.zip'];
      for (const file of files) fs.writeFileSync(path.join(dir, file), file);
      fs.writeFileSync(path.join(dir, 'latest-mac.yml'), 'version: 1.18.0-gtrows.1\nfiles:\n' + files.map(file => `  - url: ${file}\n    sha512: ${crypto.createHash('sha512').update(file).digest('base64')}\n`).join(''));
      const result = await verifyUpdateMetadata(dir);
      expect(result[0].files).toEqual(files);
      fs.writeFileSync(path.join(dir, files[0]), 'corrupt');
      await expect(verifyUpdateMetadata(dir)).rejects.toThrow('Checksum mismatch');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  it('rejects missing metadata and paths outside the release directory', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-update-meta-'));
    try {
      await expect(verifyUpdateMetadata(dir)).rejects.toThrow('No update metadata');
      fs.writeFileSync(path.join(dir, 'latest.yml'), 'version: 1.0.0\nfiles:\n  - url: ../secret.exe\n    sha512: x\n');
      await expect(verifyUpdateMetadata(dir)).rejects.toThrow('Invalid artifact path');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

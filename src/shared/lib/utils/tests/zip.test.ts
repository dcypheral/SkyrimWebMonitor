import { describe, expect, it } from 'vitest';
import { crc32, createZip } from '../zip';

describe('zip', () => {
  it('computes CRC-32', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686);
  });

  it('writes local headers, a central directory and the end record', () => {
    const zip = createZip([
      { name: 'a.md', data: '# hi' },
      { name: 'photos/b.bin', data: new Uint8Array([1, 2, 3]) },
    ]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralOffset = view.getUint32(end + 16, true);
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
  });
});

describe('readZip', () => {
  it('reads back what createZip writes', async () => {
    const { readZip } = await import('../zip');
    const zip = createZip([
      { name: 'a.md', data: '# hi' },
      { name: 'photos/b.bin', data: new Uint8Array([1, 2, 3]) },
    ]);
    const files = await readZip(zip);
    expect(new TextDecoder().decode(files.get('a.md'))).toBe('# hi');
    expect(Array.from(files.get('photos/b.bin') ?? [])).toEqual([1, 2, 3]);
  });

  it('rejects other files', async () => {
    const { readZip } = await import('../zip');
    await expect(readZip(new Uint8Array(40))).rejects.toThrow('not a zip file');
  });
});

import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normalize, PermanentImageError, validateImage } from '../../src/imagens/index.js';
describe('imagens', () => {
  it.each([
    ['PNG', 'png'],
    ['JPEG', 'jpeg'],
  ])('valida %s pelos bytes', async (_, format) => {
    const b = await sharp({ create: { width: 300, height: 100, channels: 3, background: 'red' } })
      .toFormat(format as 'png' | 'jpeg')
      .toBuffer();
    expect((await validateImage(b)).width).toBe(300);
  });
  it('rejeita HTML servido como imagem', async () =>
    expect(validateImage(Buffer.from('<html>erro</html>'), 'image/png')).rejects.toThrow(/HTML/));
  it('aceita divergência entre formatos de imagem seguros e confia nos bytes', async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    const result = await validateImage(png, 'image/gif');
    expect(result).toMatchObject({
      ext: 'png',
      mime: 'image/png',
      mimeDivergente: 'image/gif vs image/png',
    });
  });
  it('rejeita MIME declarado que não seja imagem permitida', async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    await expect(validateImage(png, 'text/plain')).rejects.toThrow(/não permitido/);
  });
  it('rejeita arquivo vazio e corrompido', async () => {
    await expect(validateImage(Buffer.alloc(0))).rejects.toThrow(/vazio/);
    await expect(validateImage(Buffer.from('not image'))).rejects.toThrow(/Formato/);
  });
  it('rejeita SVG ativo/externo', async () =>
    expect(
      validateImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')),
    ).rejects.toThrow(/ativo/));
  it('classifica excesso de pixels como falha permanente', async () => {
    const oversizedSvg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="11000" height="10000"/>',
    );
    await expect(validateImage(oversizedSvg, 'image/svg+xml')).rejects.toBeInstanceOf(
      PermanentImageError,
    );
  });
  it('normaliza sem deformação em canvas 192x192', async () => {
    const b = await sharp({ create: { width: 300, height: 100, channels: 4, background: 'blue' } })
      .png()
      .toBuffer();
    const out = await normalize(b);
    const m = await sharp(out).metadata();
    expect([m.width, m.height, m.format]).toEqual([192, 192, 'jpeg']);
  });
  it('é idempotente em conteúdo', async () => {
    const b = await sharp({ create: { width: 50, height: 50, channels: 3, background: 'green' } })
      .png()
      .toBuffer();
    expect(await normalize(b)).toEqual(await normalize(b));
  });
});

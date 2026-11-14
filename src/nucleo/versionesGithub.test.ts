import { describe, expect, it } from 'vitest';
import { apiVersiones, descargaUltima, versionBuena } from './versionesGithub';

describe('descargaUltima', () => {
  it('reconoce una descarga de la última versión de GitHub', () => {
    expect(descargaUltima('https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/JMdict_spanish.zip')).toEqual({ repositorio: 'yomidevs/jmdict-yomitan', archivo: 'JMdict_spanish.zip' });
    expect(apiVersiones('yomidevs/jmdict-yomitan')).toBe('https://api.github.com/repos/yomidevs/jmdict-yomitan/releases?per_page=10');
  });

  it('lo demás no', () => {
    expect(descargaUltima('https://github.com/yomidevs/jmdict-yomitan/releases/download/2026-11-13/JMdict_spanish.zip')).toBeNull();
    expect(descargaUltima('https://example.com/releases/latest/download/a.zip')).toBeNull();
  });
});

describe('versionBuena', () => {
  const asset = (name: string, size: number, dia: string) => ({ name, size, browser_download_url: `https://github.com/x/y/releases/download/${dia}/${name}` });
  // Como en noviembre de 2026: un día sí y otro no, los ZIP salían con el índice y nada más.
  const versiones = [
    { assets: [asset('JMdict_spanish.zip', 2308, '14'), asset('JMdict_english.zip', 2303, '14')] },
    { assets: [asset('JMdict_spanish.zip', 1332068, '13'), asset('JMdict_english.zip', 15628711, '13')] },
    { assets: [asset('JMdict_spanish.zip', 2308, '12')] },
  ];

  it('salta las versiones con el archivo vacío', () => {
    expect(versionBuena(versiones, 'JMdict_spanish.zip')).toBe('https://github.com/x/y/releases/download/13/JMdict_spanish.zip');
  });

  it('sin una buena, nada', () => {
    expect(versionBuena(versiones, 'JMnedict.zip')).toBeNull();
    expect(versionBuena([{ draft: true, assets: [asset('a.zip', 9e6, '1')] }], 'a.zip')).toBeNull();
  });
});

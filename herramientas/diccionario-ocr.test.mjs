import { describe, expect, it } from 'vitest';
import { diccionarioDeYaml } from './diccionario-ocr.mjs';

describe('el diccionario del reconocedor, del YAML de PaddleOCR', () => {
  it('lee la lista con entradas tal cual y entre comillas, y para al acabarse', () => {
    const yml = ['PostProcess:', '  name: CTCLabelDecode', '  character_dict:', "  - '!'", "  - ''''", '  - "\\\\"', '  - "\\x41"', '  - あ', '  - 漢', '  - 🛅', 'PreProcess:', '  - nada'].join('\n');
    expect(diccionarioDeYaml(yml)).toEqual(['!', "'", '\\', 'A', 'あ', '漢', '🛅']);
  });

  it('sin la lista, lo dice', () => {
    expect(() => diccionarioDeYaml('PostProcess:\n  name: CTCLabelDecode\n')).toThrow('character_dict');
  });
});

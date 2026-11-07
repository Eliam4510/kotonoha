// Cómo responde Claude cuando se le pide algo estructurado. Es igual en todas las lenguas.

export const ESQUEMA_SENTIDO = {
  type: 'object',
  properties: {
    significado: { type: 'string' },
    uso: { type: 'string', enum: ['literal', 'figurado', 'poetico', 'coloquial', 'formal', 'arcaico', 'expresion', 'jerga'] },
    nota: { type: 'string' },
    definicion: { type: 'integer' },
  },
  required: ['significado', 'uso', 'nota', 'definicion'],
  additionalProperties: false,
} as const;

export const ESQUEMA_ANALISIS = {
  type: 'object',
  properties: {
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          lecturas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                superficie: { type: 'string' },
                lectura: { type: 'string' },
                lema: { type: 'string' },
                lectura_lema: { type: 'string' },
              },
              required: ['superficie', 'lectura', 'lema', 'lectura_lema'],
              additionalProperties: false,
            },
          },
          sentidos: {
            type: 'array',
            items: {
              type: 'object',
              properties: { superficie: { type: 'string' }, significado: { type: 'string' }, uso: { type: 'string' } },
              required: ['superficie', 'significado', 'uso'],
              additionalProperties: false,
            },
          },
          gramatica: {
            type: 'array',
            items: {
              type: 'object',
              properties: { fragmento: { type: 'string' }, patron: { type: 'string' }, nivel: { type: 'string' }, significado: { type: 'string' } },
              required: ['fragmento', 'patron', 'nivel', 'significado'],
              additionalProperties: false,
            },
          },
        },
        required: ['i', 'lecturas', 'sentidos', 'gramatica'],
        additionalProperties: false,
      },
    },
  },
  required: ['lineas'],
  additionalProperties: false,
} as const;

export const ESQUEMA_CORRECCIONES = {
  type: 'object',
  properties: {
    correcciones: {
      type: 'array',
      items: {
        type: 'object',
        properties: { i: { type: 'integer' }, t: { type: 'string' } },
        required: ['i', 't'],
        additionalProperties: false,
      },
    },
  },
  required: ['correcciones'],
  additionalProperties: false,
} as const;

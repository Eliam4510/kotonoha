// Lo que el navegador dice del equipo, sin descargar ni medir nada: si hay WebGPU y qué gráfica es, cuántos núcleos,
// cuánta memoria y cuánto espacio libre. Con eso decide nucleo/equipo.ts; lo medido con «Probar mi equipo» va en los
// ajustes. Nada de esto sale del equipo.

import type { SenalesEquipo } from '../nucleo/equipo';

interface AdaptadorGpu {
  isFallbackAdapter?: boolean;
  info?: { vendor?: string; architecture?: string; description?: string; isFallbackAdapter?: boolean };
}

type ConGpu = { gpu?: { requestAdapter(o: { powerPreference: string }): Promise<unknown> }; deviceMemory?: number; hardwareConcurrency: number };

export async function detectarEquipo(): Promise<SenalesEquipo> {
  const nav = navigator as unknown as ConGpu;
  // La misma pregunta que hacen los trabajadores de la voz y del OCR: la gráfica más potente que haya.
  const adaptador = (nav.gpu ? await nav.gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null) : null) as AdaptadorGpu | null;
  const info: NonNullable<AdaptadorGpu['info']> = adaptador?.info ?? {};
  const respaldo = !!(adaptador?.isFallbackAdapter ?? info.isFallbackAdapter);
  const espacio = await navigator.storage?.estimate?.().catch(() => null);
  return {
    webgpu: !!adaptador && !respaldo,
    respaldo,
    gpu: { fabricante: info.vendor ?? '', arquitectura: info.architecture ?? '', descripcion: info.description ?? '' },
    nucleos: nav.hardwareConcurrency || 0,
    memoria: nav.deviceMemory ?? null,
    libre: espacio?.quota !== undefined && espacio.usage !== undefined ? Math.max(0, espacio.quota - espacio.usage) : null,
  };
}

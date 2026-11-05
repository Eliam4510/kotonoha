// Control positivo de la sonda del escritorio: una carga corta y acotada en la GPU, con órdenes largas,
// para comprobar que la sonda detecta las trabas cuando existen. Si no las detectara, un resultado
// de «cero trabas» no significaría nada.
//
// Seguridad: dura pocos segundos, cada orden se calibra por debajo de los 300 ms y se aborta si alguna
// supera 1 s (Windows reinicia el controlador a partir de 2 s).
// Uso: node pruebas/sonda-control.mjs [segundos]

import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = resolve(import.meta.dirname, '..');
const SEGUNDOS = Number(process.argv[2] ?? 10);
const OBJETIVOS_MS = [40, 120, 280];

const sondaDwm = (s) =>
  new Promise((ok) => {
    let salida = '';
    const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(RAIZ, 'pruebas', 'sonda-escritorio.ps1'), '-Segundos', String(s)]);
    p.stdout.on('data', (d) => (salida += d));
    p.on('close', () => {
      try {
        ok(JSON.parse(salida.trim().split('\n').pop()));
      } catch {
        ok(null);
      }
    });
  });

const n = await chromium.launch({ channel: process.env.KK_CANAL ?? 'msedge', headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await n.newPage();
await p.goto('https://example.com/').catch(() => {});

const preparado = await p.evaluate(async () => {
  const a = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!a) return { error: 'sin WebGPU en esta página' };
  const device = await a.requestDevice();
  const modulo = device.createShaderModule({
    code: `
      @group(0) @binding(0) var<storage, read_write> datos: array<f32>;
      @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
        var x = f32(id.x % 1024u) * 0.001 + 0.5;
        for (var i = 0u; i < 2000u; i++) { x = sin(x) * cos(x) + sqrt(abs(x)) * 0.5; }
        datos[id.x % 1024u] = x;
      }`,
  });
  const tuberia = device.createComputePipeline({ layout: 'auto', compute: { module: modulo, entryPoint: 'main' } });
  const buffer = device.createBuffer({ size: 4096, usage: GPUBufferUsage.STORAGE });
  const grupo = device.createBindGroup({ layout: tuberia.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer } }] });
  globalThis.__orden = async (grupos) => {
    const t0 = performance.now();
    const c = device.createCommandEncoder();
    const e = c.beginComputePass();
    e.setPipeline(tuberia);
    e.setBindGroup(0, grupo);
    // Cada dimensión admite hasta 65535 grupos.
    e.dispatchWorkgroups(Math.min(grupos, 60000), Math.ceil(grupos / 60000));
    e.end();
    device.queue.submit([c.finish()]);
    await device.queue.onSubmittedWorkDone();
    return performance.now() - t0;
  };
  // La primera orden incluye compilar el sombreador: se descarta para no falsear la calibración.
  await globalThis.__orden(100);
  await globalThis.__orden(100);
  // Se duplica hasta que el tiempo sea medible, y nunca se calibra con una orden de más de 60 ms.
  let g = 100;
  let ms = await globalThis.__orden(g);
  while (ms < 25 && g < 4000000) {
    g *= 2;
    ms = await globalThis.__orden(g);
  }
  if (ms < 1) return { error: 'la GPU no ejecutó el sombreador' };
  globalThis.__porMs = g / ms;
  return { arquitectura: a.info?.architecture, gruposPorMs: Math.round(g / ms), calibracion: `${g} grupos en ${ms.toFixed(1)} ms` };
});
console.log('GPU:', JSON.stringify(preparado));
if (preparado.error) {
  console.log('No se puede ejecutar el control desde esta página.');
  await n.close();
  process.exit(1);
}

const filas = [];
const reposo = await sondaDwm(8);
filas.push({ carga: 'reposo', 'orden ms': '-', mediana: reposo?.mediana, p99: reposo?.p99, max: reposo?.max, '>33ms': reposo?.mayor33, '>50ms': reposo?.mayor50, '>100ms': reposo?.mayor100 });

for (const objetivo of OBJETIVOS_MS) {
  const sonda = sondaDwm(SEGUNDOS);
  const r = await p.evaluate(
    async ({ objetivo, segundos }) => {
      const grupos = Math.round(globalThis.__porMs * objetivo);
      const fin = performance.now() + segundos * 1000;
      const tiempos = [];
      while (performance.now() < fin) {
        const ms = await globalThis.__orden(grupos);
        tiempos.push(ms);
        if (ms > 1000) return { abortado: true, ms, tiempos: tiempos.length };
      }
      tiempos.sort((a, b) => a - b);
      return { ordenes: tiempos.length, mediana: Math.round(tiempos[tiempos.length >> 1]), max: Math.round(tiempos[tiempos.length - 1]) };
    },
    { objetivo, segundos: SEGUNDOS - 1 }
  );
  const d = await sonda;
  filas.push({ carga: `órdenes de ${objetivo} ms`, 'orden ms': r.abortado ? `abortado ${Math.round(r.ms)}` : `${r.mediana} (máx ${r.max})`, mediana: d?.mediana, p99: d?.p99, max: d?.max, '>33ms': d?.mayor33, '>50ms': d?.mayor50, '>100ms': d?.mayor100 });
  if (r.abortado) break;
  await new Promise((res) => setTimeout(res, 5000));
}
console.table(filas);
await n.close();
process.exit(0);

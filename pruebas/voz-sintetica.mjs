// Una voz sintética para probar la práctica de los tonos sin grabar a nadie: cada sílaba es una consonante sorda (ruido)
// y una vocal con la curva de su tono, en los cinco niveles de Chao sobre una voz de 140 Hz. YIN la sigue como a una voz.

import { writeFileSync } from 'node:fs';

const FRECUENCIA = 16000;
/** La forma de cada tono: el primero, alto y llano; el segundo sube; el tercero baja y, al final, vuelve a subir; el cuarto cae. */
const FORMAS = { 1: [5, 5], 2: [3, 5], 3: [2, 1, 1], '3f': [2, 1, 3], 4: [5, 1], 5: [3, 3] };

/**
 * Escribe un WAV de 16 kHz con las sílabas dadas, cada una con su tono (`'3f'` es el tercero de final, que sube). Medio
 * segundo de silencio antes y después.
 */
export function wavDeTonos(tonos, ruta, base = 140) {
  const muestras = [];
  let fase = 0;
  let semilla = 7;
  const ruido = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  const silencio = (s) => {
    for (let i = 0; i < s * FRECUENCIA; i++) muestras.push(0);
  };
  silencio(0.5);
  for (const t of tonos) {
    // La consonante: 70 ms de ruido flojo.
    for (let i = 0; i < 0.07 * FRECUENCIA; i++) muestras.push(ruido() * 0.04);
    const forma = FORMAS[t];
    const largo = Math.round((t === 5 ? 0.14 : 0.26) * FRECUENCIA);
    for (let i = 0; i < largo; i++) {
      const x = (i / (largo - 1)) * (forma.length - 1);
      const a = Math.floor(x);
      const nivel = forma[a] + (forma[Math.min(forma.length - 1, a + 1)] - forma[a]) * (x - a);
      const f0 = base * 2 ** (((nivel - 3) * 2.5) / 12);
      fase += (2 * Math.PI * f0) / FRECUENCIA;
      // Diez armónicos que se apagan, con la vocal que entra y sale suave.
      let v = 0;
      for (let k = 1; k <= 10; k++) v += Math.sin(k * fase) / k;
      const envolvente = Math.min(1, i / (0.02 * FRECUENCIA), (largo - i) / (0.03 * FRECUENCIA));
      muestras.push(v * 0.25 * envolvente);
    }
  }
  silencio(0.5);
  const datos = Buffer.alloc(44 + muestras.length * 2);
  datos.write('RIFF', 0);
  datos.writeUInt32LE(36 + muestras.length * 2, 4);
  datos.write('WAVEfmt ', 8);
  datos.writeUInt32LE(16, 16);
  datos.writeUInt16LE(1, 20);
  datos.writeUInt16LE(1, 22);
  datos.writeUInt32LE(FRECUENCIA, 24);
  datos.writeUInt32LE(FRECUENCIA * 2, 28);
  datos.writeUInt16LE(2, 32);
  datos.writeUInt16LE(16, 34);
  datos.write('data', 36);
  datos.writeUInt32LE(muestras.length * 2, 40);
  muestras.forEach((m, i) => datos.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(m * 32767))), 44 + i * 2));
  writeFileSync(ruta, datos);
}

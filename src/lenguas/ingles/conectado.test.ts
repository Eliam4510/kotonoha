import { describe, expect, it } from 'vitest';
import { comoSuena } from './conectado';

/** Lo que cambia, como «escrito → dicho (fenómeno)», para comparar de un vistazo. */
const cambios = (frase: string) => comoSuena(frase).filter((t) => t.suena).map((t) => `${t.texto} → ${t.suena} (${t.fenomeno})`);

describe('cómo suena de verdad', () => {
  it('reconstruye la frase entera, en orden', () => {
    const frase = "What are you going to do? I don't know.";
    expect(comoSuena(frase).map((t) => t.texto).join('')).toBe(frase);
  });

  it('las reducciones de siempre, con su mayúscula', () => {
    expect(cambios("What are you going to do? I don't know.")).toEqual(['What are you → Whaddaya (reduccion)', 'going to → gonna (reduccion)', "don't know → dunno (reduccion)"]);
    expect(cambios('Let me see')).toEqual(['Let me → Lemme (reduccion)']);
  });

  it('going to un sitio no es gonna', () => {
    // Ante un sitio, «to» solo se debilita.
    expect(cambios("I'm going to school")).toEqual(['to → tə (debil)']);
    expect(cambios("I'm going to the park")).not.toContain('going to → gonna (reduccion)');
  });

  it('la t o la d con you, la t suave y la unión de consonante y vocal', () => {
    expect(cambios('Nice to meet you')).toContain('meet you → meechu (fusion)');
    expect(cambios('Get it now')).toEqual(['Get it → Ge‿dit (tSuave)']);
    expect(cambios('Turn off the light')).toContain('Turn off → Tur‿noff (union)');
    // La e muda no suena; y «one» empieza por una w, no por vocal.
    expect(cambios('Make it quick')).toEqual(['Make it → Ma‿kit (union)']);
    expect(cambios('Pick one')).toEqual([]);
  });

  it('going to be es gonna be; going to Paris y got to the station, no', () => {
    expect(cambios("It's going to be fine")).toEqual(['going to → gonna (reduccion)']);
    expect(cambios("I'm going to Paris")).toEqual(['to → tə (debil)']);
    expect(cambios('I got to the station')).toEqual(['to → tə (debil)']);
    expect(cambios("You've got to see it")).toContain('got to → gotta (reduccion)');
  });

  it('la e de the, she, we o be sí suena; la de they’re no', () => {
    expect(cambios('the apple')).toEqual([]);
    expect(cambios('She is here')).toEqual([]);
    expect(cambios('We are late')).toEqual([]);
    expect(cambios("They're always late")).toEqual(["They're always → They‿ralways (union)"]);
    expect(cambios("Didn't you see it")).toContain("Didn't you → Didnchu (fusion)");
  });

  it('la consonante pasa como se oye: ck, letras dobles, c y g ante e muda, s que suena z', () => {
    expect(cambios('Check it')).toEqual(['Check it → Che‿kit (union)']);
    expect(cambios('Call it')).toEqual(['Call it → Ca‿lit (union)']);
    expect(cambios('A piece of cake')).toContain('piece of → pie‿səv (union)');
    expect(cambios('Change it')).toEqual(['Change it → Chan‿jit (union)']);
    expect(cambios('Is it')).toEqual(['Is it → I‿zit (union)']);
    // La ng no pasa como una g; y la t suave también ante «I»: what I → wha‿dI.
    expect(cambios('talking about')).toEqual([]);
    expect(cambios('That is what I said')).toContain('what I → wha‿dI (tSuave)');
    expect(cambios("What you're doing")).toContain("What you're → Whachur (fusion)");
  });

  it('las formas débiles, salvo al final de la frase', () => {
    expect(cambios('Tea for two')).toContain('for → fər (debil)');
    // Unida a la consonante de antes, con su forma débil.
    expect(cambios('A cup of tea')).toContain('cup of → cu‿pəv (union)');
    expect(cambios('Who is it for?')).not.toContain('for → fər (debil)');
  });
});

// Los .css se importan como texto para inyectarlos en el Shadow DOM.
declare module '*.css' {
  const contenido: string;
  export default contenido;
}

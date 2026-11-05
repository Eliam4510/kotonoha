# Mide si el escritorio de Windows se traba: tiempo entre composiciones del DWM, en milisegundos.
# DwmFlush bloquea hasta la siguiente composición. A 60 Hz debería volver cada 16,7 ms.
#
# Si nada cambia en pantalla, el DWM apenas usa la GPU y la medida saldría buena aunque la GPU
# estuviera saturada. Por eso se anima un cuadrito en una esquina, que obliga a recomponer en cada
# cuadro. No roba el foco ni recibe clics.
# Uso: sonda-escritorio.ps1 -Segundos 30
param([int]$Segundos = 10)
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public class CuadroSonda : Form {
  protected override bool ShowWithoutActivation { get { return true; } }
  protected override CreateParams CreateParams {
    get {
      var c = base.CreateParams;
      c.ExStyle |= 0x08000000 | 0x00000080 | 0x00000020; // Sin activación, ventana de herramientas, sin clics
      return c;
    }
  }
}

public static class SondaDwm {
  [DllImport("dwmapi.dll")] public static extern int DwmFlush();

  public static double[] Medir(int segundos) {
    var lista = new List<double>();
    var pantalla = Screen.PrimaryScreen.WorkingArea;
    var f = new CuadroSonda {
      FormBorderStyle = FormBorderStyle.None,
      ShowInTaskbar = false,
      TopMost = true,
      StartPosition = FormStartPosition.Manual,
      Size = new Size(48, 48),
      Location = new Point(pantalla.Right - 60, pantalla.Bottom - 60),
      BackColor = Color.FromArgb(20, 40, 30),
    };
    int paso = 0;
    var t = new System.Windows.Forms.Timer { Interval = 15 };
    t.Tick += (s, e) => {
      paso = (paso + 3) % 512;
      int v = paso < 256 ? paso : 511 - paso;
      f.BackColor = Color.FromArgb(20 + v / 8, 40 + v / 6, 30 + v / 8);
    };
    var hilo = new Thread(() => {
      var reloj = Stopwatch.StartNew();
      double previo = 0;
      while (reloj.Elapsed.TotalSeconds < segundos) {
        DwmFlush();
        double ahora = reloj.Elapsed.TotalMilliseconds;
        lista.Add(ahora - previo);
        previo = ahora;
      }
      f.BeginInvoke(new Action(() => { t.Stop(); f.Close(); }));
    });
    hilo.IsBackground = true;
    f.Shown += (s, e) => { t.Start(); hilo.Start(); };
    Application.Run(f);
    hilo.Join();
    return lista.ToArray();
  }
}
'@
$m = [SondaDwm]::Medir($Segundos)
$o = $m | Sort-Object
$n = $o.Count
"{""cuadros"":$n,""mediana"":$([math]::Round($o[[int]($n*0.5)],1)),""p99"":$([math]::Round($o[[int]($n*0.99)],1)),""max"":$([math]::Round($o[$n-1],1)),""mayor33"":$(($m | Where-Object {$_ -gt 33}).Count),""mayor50"":$(($m | Where-Object {$_ -gt 50}).Count),""mayor100"":$(($m | Where-Object {$_ -gt 100}).Count),""mayor250"":$(($m | Where-Object {$_ -gt 250}).Count)}"

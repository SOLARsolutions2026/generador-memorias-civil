/* Pasa páginas de un PDF a hoja carta vertical (pedido de Amo 29-oct): las fichas técnicas llegan en A4, en
   tamaños raros o acostadas; aquí cada página se pone centrada en una hoja carta (612 × 792 pt), escalada para
   caber dentro de los márgenes y girada 90° si es más ancha que alta. Sirve en el navegador y en Node (tools/). */
const Carta = {
  W:612, H:792,
  // src: PDFDocument de origen; out: PDFDocument destino. Devuelve las páginas nuevas (ya agregadas a out).
  async paginas(PDFLib, out, src, m = { x:36, top:36, bot:54 }){
    const nuevas = [], pags = src.getPages();
    for(const [i, p] of pags.entries()){
      const sz = p.getSize();
      if(Math.abs(sz.width - Carta.W) < 1 && Math.abs(sz.height - Carta.H) < 1 && !(p.getRotation().angle % 360)){   // ya es carta vertical: igual
        const [cp] = await out.copyPages(src, [i]); nuevas.push(out.addPage(cp)); continue; }
      const cb = p.getCropBox(), rot0 = ((p.getRotation().angle % 360) + 360) % 360;
      const emb = await out.embedPage(p, { left:cb.x, bottom:cb.y, right:cb.x + cb.width, top:cb.y + cb.height });
      let w = cb.width, h = cb.height;
      // la rotación propia de la página (/Rotate gira en sentido horario al mostrarla)
      let rot = -rot0;                                           // grados en sentido antihorario para drawPage
      let ew = rot0 % 180 ? h : w, eh = rot0 % 180 ? w : h;      // tamaño como se ve
      if(ew > eh){ rot += 90; [ew, eh] = [eh, ew]; }             // acostada → vertical
      const aw = Carta.W - 2*m.x, ah = Carta.H - m.top - m.bot, s = Math.min(aw/ew, ah/eh);
      // esquinas de la página escalada y girada alrededor del origen, para ubicarla centrada
      const r = rot * Math.PI/180, c = Math.cos(r), sn = Math.sin(r);
      const pts = [[0,0],[w,0],[0,h],[w,h]].map(([u, v]) => [s*(u*c - v*sn), s*(u*sn + v*c)]);
      const minX = Math.min(...pts.map(q => q[0])), minY = Math.min(...pts.map(q => q[1]));
      const x0 = m.x + (aw - ew*s)/2, y0 = m.bot + (ah - eh*s)/2;
      const pg = out.addPage([Carta.W, Carta.H]);
      pg.drawPage(emb, { x:x0 - minX, y:y0 - minY, xScale:s, yScale:s, rotate:PDFLib.degrees(((rot % 360) + 360) % 360) });
      nuevas.push(pg);
    }
    return nuevas;
  }
};
if(typeof module !== 'undefined') module.exports = Carta;

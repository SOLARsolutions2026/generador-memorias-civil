// Pasa a carta vertical las fichas técnicas de la carpeta fichas/ (uso: node tools/fichas_carta.js [archivos…])
const fs = require('fs'), path = require('path');
const PDFLib = require('../vendor/pdf-lib.min.js'), Carta = require('../calc/carta.js');
(async () => {
  const dir = path.join(__dirname, '..', 'fichas');
  const lista = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter(f => f.endsWith('.pdf')).map(f => path.join(dir, f));
  for(const f of lista){
    const src = await PDFLib.PDFDocument.load(fs.readFileSync(f), { ignoreEncryption:true });
    const ok = src.getPages().every(p => { const { width:w, height:h } = p.getSize(); return Math.abs(w - 612) < 1 && Math.abs(h - 792) < 1 && !p.getRotation().angle; });
    if(ok){ console.log('ya está en carta:', path.basename(f)); continue; }
    const out = await PDFLib.PDFDocument.create(); await Carta.paginas(PDFLib, out, src);
    fs.writeFileSync(f, await out.save()); console.log('carta vertical:', path.basename(f), src.getPageCount(), 'pág.');
  }
})();

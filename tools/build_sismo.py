# Genera data/sismo.js: une los valores Aa/Av del Apéndice A-4 (NSR-10, extraídos del PDF oficial; ver github.com/Yojemr/Espectra-NSR10)
# con los límites municipales DANE MGN 2018 del paquete npm @john-guerra/geo-colombia (MIT), simplificados con Douglas-Peucker.
# Entradas: a4.json (registros del Apéndice A-4) y municipalities.geo.json.
import json, math
g = json.load(open('gc/package/data/municipalities.geo.json'))
a4 = {r['code']: r for r in json.load(open('a4.json'))}
def dp(pts, tol):
    if len(pts) < 4: return pts
    keep = [False]*len(pts); keep[0] = keep[-1] = True
    st = [(0, len(pts)-1)]
    while st:
        i, j = st.pop(); x1,y1 = pts[i]; x2,y2 = pts[j]; dx,dy = x2-x1, y2-y1; L = math.hypot(dx,dy) or 1e-12
        best, bi = -1, -1
        for k in range(i+1, j):
            d = abs(dy*(pts[k][0]-x1) - dx*(pts[k][1]-y1)) / L
            if d > best: best, bi = d, k
        if best > tol: keep[bi] = True; st += [(i, bi), (bi, j)]
    return [p for p,k in zip(pts,keep) if k]
TOL = 0.008
out = []; npts = 0
for f in g['features']:
    p = f['properties']; code = p['MPIO_CDPMP']; geom = f['geometry']
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    rings = []
    for poly in polys:
        ring = poly[0]
        if len(ring) < 4: continue
        x0, y0 = ring[0]; far = max(range(len(ring)), key=lambda k: (ring[k][0]-x0)**2 + (ring[k][1]-y0)**2)
        r = dp(ring[:far+1], TOL)[:-1] + dp(ring[far:], TOL)
        if len(r) >= 4:
            flat = []
            for x, y in r: flat += [round(x, 3), round(y, 3)]
            rings.append(flat); npts += len(r)
    r4 = a4.get(code)
    out.append({'c': code, 'n': r4['name'] if r4 else p['MPIO_CNMBR'].title(), 'd': r4['department'] if r4 else None,
                'aa': r4['aa'] if r4 else None, 'av': r4['av'] if r4 else None, 'z': r4['hazard'] if r4 else None,
                'lat': round(p['LATITUD'], 4), 'lon': round(p['LONGITUD'], 4), 'r': rings})
# municipio del A-4 sin polígono: solo en la tabla
gcodes = {o['c'] for o in out}
for code, r in a4.items():
    if code not in gcodes: out.append({'c': code, 'n': r['name'], 'd': r['department'], 'aa': r['aa'], 'av': r['av'], 'z': r['hazard'], 'lat': None, 'lon': None, 'r': []})
data = {'fuente': 'NSR-10, Título A, Apéndice A-4 (valores Aa y Av por municipio); límites municipales DANE MGN 2018 (paquete @john-guerra/geo-colombia, licencia MIT), simplificados ~400 m',
        'mun': out}
s = '/* Parámetros sísmicos por municipio (NSR-10 Apéndice A-4) y límites municipales (DANE MGN 2018, simplificados). Generado por tools/sismo. */\nglobalThis.NSR_SISMO = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('sismo.js', 'w').write(s)
print(len(out), 'municipios', npts, 'puntos', len(s)//1024, 'KB')

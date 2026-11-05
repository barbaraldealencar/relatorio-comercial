// Reserva para quando o Comex Stat recusa consultas (limite de requisições): usa a cópia mais recente
// já salva do mesmo recorte. Meses fechados não mudam, então a cópia de dias anteriores continua válida.
import fs from 'node:fs/promises';
import path from 'node:path';
import { DADOS } from './dados.js';

// prefixo: nome do arquivo de cache sem a data (ex.: "comex2_3901-3902_2026")
export async function copiaMaisRecente(prefixo) {
  const pasta = path.join(DADOS, 'cache');
  const arquivos = (await fs.readdir(pasta).catch(() => []))
    .filter(f => f.startsWith(`${prefixo}_`) && /_\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!arquivos.length) return null;
  return JSON.parse(await fs.readFile(path.join(pasta, arquivos[arquivos.length - 1]), 'utf8'));
}

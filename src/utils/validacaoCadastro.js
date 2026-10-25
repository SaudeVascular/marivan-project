// Mesmas regras do banco (migração 45), para avisar antes de enviar.
const digitos = v => String(v || '').replace(/\D/g, '');

export function cpfValido(valor) {
  const d = digitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function cnsValido(valor) {
  const d = digitos(valor);
  if (d.length !== 15) return false;
  const soma = (n) => [...d.slice(0, n)].reduce((s, c, i) => s + Number(c) * (15 - i), 0);
  if (d[0] === '1' || d[0] === '2') {
    let s = soma(11);
    let dv = 11 - (s % 11);
    if (dv === 11) dv = 0;
    let esperado;
    if (dv === 10) {
      s += 2;
      dv = 11 - (s % 11);
      esperado = `${d.slice(0, 11)}001${dv}`;
    } else {
      esperado = `${d.slice(0, 11)}000${dv}`;
    }
    return d === esperado;
  }
  if (['7', '8', '9'].includes(d[0])) return soma(15) % 11 === 0;
  return false;
}

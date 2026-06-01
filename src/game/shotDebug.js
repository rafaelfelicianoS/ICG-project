/**
 * shotDebug.js — Histórico de lançamentos para modo debug (F3).
 *
 * Guarda os últimos MAX_HISTORY lançamentos com todos os dados relevantes.
 * renderDebugOverlay(el) escreve o histórico num elemento HTML.
 */

const MAX_HISTORY = 10;
const history = [];

/**
 * Regista um lançamento no histórico.
 * @param {object} data
 *   distancia      {number}  metros ao aro
 *   power          {number}  0-1
 *   janelaMin      {number}  min da janela perfeita
 *   janelaMax      {number}  max da janela perfeita
 *   isPerfect      {boolean}
 *   angulo         {number}  graus
 *   velocidade     {number}  m/s
 *   crossPoint     {object|null} {x,y,z} ponto interpolado no plano do aro
 *   desvioXZ       {number|null} distância XZ ao centro do aro no cruzamento
 *   raioEfetivo    {number}  rimRadius - ballRadius * 0.35
 *   entrou         {boolean}
 */
export function recordShot(data) {
  history.unshift(data); // mais recente primeiro
  if (history.length > MAX_HISTORY) {
    history.pop();
  }
}

export function getHistory() {
  return history;
}

function motivoFalha(data) {
  if (data.entrou) return "—";
  if (!data.isPerfect) {
    if (data.power < data.janelaMin) return "power curto (abaixo da janela)";
    if (data.power > data.janelaMax) return "power alto (acima da janela)";
  }
  if (data.crossPoint === null) return "bola nao cruzou o plano do aro";
  if (data.desvioXZ !== null && data.desvioXZ > data.raioEfetivo) {
    return `desvio XZ (${data.desvioXZ.toFixed(3)}m) > raio (${data.raioEfetivo.toFixed(3)}m)`;
  }
  return "motivo desconhecido";
}

/**
 * Escreve o histórico de lançamentos no elemento HTML fornecido.
 * @param {HTMLElement} el
 */
export function renderDebugOverlay(el) {
  if (!el) return;

  if (history.length === 0) {
    el.textContent = "[DEBUG F3] Sem lançamentos ainda.";
    return;
  }

  const lines = ["[DEBUG LANÇAMENTOS — últimos 10]", ""];

  history.forEach((d, i) => {
    const n = i + 1;
    const ok = d.entrou ? "✓ CESTO" : "✗ FALHA";
    const perf = d.isPerfect ? "PERFEITO" : "nao-perfeito";
    const cp = d.crossPoint
      ? `(${d.crossPoint.x.toFixed(2)}, ${d.crossPoint.z.toFixed(2)})`
      : "n/a";
    const desvio = d.desvioXZ !== null ? `${d.desvioXZ.toFixed(3)}m` : "n/a";

    lines.push(`#${n} ${ok} | ${perf}`);
    lines.push(`  dist=${d.distancia.toFixed(2)}m  power=${(d.power * 100).toFixed(1)}%  janela=[${(d.janelaMin * 100).toFixed(1)}%,${(d.janelaMax * 100).toFixed(1)}%]`);
    lines.push(`  angulo=${d.angulo.toFixed(1)}°  vel=${d.velocidade.toFixed(2)}m/s`);
    lines.push(`  crossXZ=${cp}  desvio=${desvio}  raioEf=${d.raioEfetivo.toFixed(3)}m`);
    if (!d.entrou) {
      lines.push(`  motivo: ${motivoFalha(d)}`);
    }
    lines.push("");
  });

  el.textContent = lines.join("\n");
}

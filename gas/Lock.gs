/**
 * Serializa operacoes que alteram estoque/solicitacoes.
 */

function comLock_(fn, timeoutMs) {
  var lock = LockService.getScriptLock();
  var limite = timeoutMs || 30000;
  if (!lock.tryLock(limite)) {
    throw erroApp_("SISTEMA_OCUPADO", "O sistema esta processando outra operacao. Tente novamente em instantes.");
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

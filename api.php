<?php

// SEC: nunca exibir erros ao cliente em produção; apenas registrar no servidor.
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

/**
 * SEC: devolve mensagem genérica ao cliente e registra o detalhe no log do servidor.
 * Use no lugar de err_detail($e) em respostas HTTP.
 */
function err_detail($e, $ctx = '') {
    $msg = is_object($e) && method_exists($e, 'getMessage') ? $e->getMessage() : (string)$e;
    error_log('[api.php]' . ($ctx ? " [$ctx]" : '') . ' ' . $msg);
    if (getenv('APP_DEBUG') === '1') return $msg;
    return 'erro interno';
}

// ============================================================
// CORS — DEVE vir antes de QUALQUER outra saída ou lógica
// ============================================================

// 1. Origens permitidas (whitelist explícita é mais segura que "*")
$allowedOrigins = [
    'https://jogab.lovable.app',                                              // produção
    'https://743e12ae-6928-4f0d-9c18-c2bf6f2ead15.lovableproject.com',        // preview Lovable
    'http://localhost:5173',                                                  // dev local Vite
    'http://localhost:8080',                                                  // dev local alternativo
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Vary: Origin");
} else {
    // Fallback aberto (útil para testes; remova em produção rígida)
    header("Access-Control-Allow-Origin: *");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 86400"); // cacheia preflight por 24h
header("Content-Type: application/json; charset=utf-8");

// 2. Responde o preflight ANTES de qualquer lógica de auth
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);   // No Content
    exit;
}

// ============================================================
// Helper para respostas JSON com CORS garantido
// ============================================================
function json_response($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ============================================================
// Trilha de auditoria (audit_logs) — best-effort: nunca derruba a
// operação principal (ex.: migração ainda não aplicada).
// ============================================================
function logAudit($conn, $authUser, string $entidade, $entidadeId, string $acao, $before = null, $after = null): void {
    try {
        $stmt = $conn->prepare("
            INSERT INTO audit_logs (entidade, entidade_id, acao, before_json, after_json, user_id, user_login, created_at)
            VALUES (:entidade, :entidade_id, :acao, :before_json, :after_json, :user_id, :user_login, NOW())
        ");
        $stmt->execute([
            'entidade'    => $entidade,
            'entidade_id' => $entidadeId !== null ? (string)$entidadeId : null,
            'acao'        => $acao,
            'before_json' => $before !== null ? json_encode($before, JSON_UNESCAPED_UNICODE) : null,
            'after_json'  => $after !== null ? json_encode($after, JSON_UNESCAPED_UNICODE) : null,
            'user_id'     => isset($authUser['user_id']) ? (string)$authUser['user_id'] : null,
            'user_login'  => $authUser['login'] ?? null,
        ]);
    } catch (Exception $e) {
        /* silencioso */
    }
}

// ============================================================
// HISTÓRICO DO COLABORADOR — log de eventos tipado
// ============================================================
// `movimentacoes` é o log de eventos do colaborador (migração
// 2026_07_30_colaborador_eventos_tipados_mysql). Tem um único produtor
// (estas funções) e um único consumidor ($loadHistorico + rota
// mobilizacoesPeriodos). `data_programada` é a data EFETIVA do evento;
// `registrado_em`, o instante do lançamento.

/** Vocabulário de status do log. Aceita tanto `__ferias__` quanto `ferias`. */
function normalizaStatusColaborador($valor) {
    if ($valor === null || $valor === '') return null;
    $s = strtolower(trim(preg_replace('/^__|__$/', '', (string)$valor)));
    $conhecidos = ['folga', 'afastamento', 'ferias', 'sem_alocacao', 'indeterminado'];
    return in_array($s, $conhecidos, true) ? $s : null;
}

/**
 * Vocabulário de status do patrimônio. `__manutencao__` vira `manutencao`.
 * Diferente do colaborador, aqui o status vive em flags booleanas
 * (`em_manutencao`, `sujo`) e não numa coluna exclusiva.
 */
function normalizaStatusPatrimonio($valor) {
    if ($valor === null || $valor === '') return null;
    $s = strtolower(trim(preg_replace('/^__|__$/', '', (string)$valor)));
    $conhecidos = ['manutencao', 'sujo', 'sem_alocacao', 'indeterminado'];
    return in_array($s, $conhecidos, true) ? $s : null;
}

/**
 * A migração de eventos tipados já foi aplicada nesta tabela? Mesmo padrão de
 * degradação graciosa usado no georreferenciamento: sem as colunas, o endpoint
 * continua funcionando no comportamento anterior em vez de quebrar.
 */
function temEventosTipadosEm($conn, string $tabela): bool {
    static $cache = [];
    if (array_key_exists($tabela, $cache)) return $cache[$tabela];
    try {
        $cols = $conn->query("SHOW COLUMNS FROM `$tabela`")->fetchAll(PDO::FETCH_COLUMN);
        $cache[$tabela] = in_array('tipo', $cols, true)
                       && in_array('status_destino', $cols, true)
                       && in_array('registrado_em', $cols, true);
    } catch (Exception $e) {
        $cache[$tabela] = false;
    }
    return $cache[$tabela];
}

function temEventosTipados($conn): bool {
    return temEventosTipadosEm($conn, 'movimentacoes');
}

/**
 * A migração 2026_08_13_movimentacoes_veiculos_motorista já foi aplicada?
 * Mesma degradação graciosa de `temEventosTipadosEm`: sem as colunas, a troca
 * de motorista continua sendo gravada e lida como movimentação de obra.
 */
function temMotoristaEmMovimentacoesVeiculos($conn): bool {
    static $cache = null;
    if ($cache !== null) return $cache;
    try {
        $cols = $conn->query("SHOW COLUMNS FROM `movimentacoes_veiculos`")->fetchAll(PDO::FETCH_COLUMN);
        $cache = in_array('motorista_origem_id', $cols, true)
              && in_array('motorista_destino_id', $cols, true);
    } catch (Exception $e) {
        $cache = false;
    }
    return $cache;
}

/**
 * Grava um evento no histórico do colaborador.
 *
 * `$ev`: colaborador_id, tipo, data_efetiva (Y-m-d) e, conforme o tipo,
 * obra_origem_id, obra_destino_id, status_origem, status_destino, usuario_id,
 * observacao.
 *
 * Idempotente: um evento idêntico (mesmo colaborador, data efetiva, tipo,
 * destino e observação) não é gravado duas vezes — o histórico em produção tem
 * duplicatas justamente por faltar essa guarda, e cada uma vira um período
 * fantasma de 0 dias na aba Histórico.
 *
 * Retorna true se gravou. Em banco sem a migração, só os tipos que já existiam
 * antes (mobilizacao/status) são gravados, nas colunas legadas.
 */
function registrarEventoColaborador($conn, array $ev): bool {
    $colabId = $ev['colaborador_id'] ?? null;
    if (!$colabId) return false;

    $tipo          = $ev['tipo'] ?? 'mobilizacao';
    $dataEfetiva   = !empty($ev['data_efetiva']) ? $ev['data_efetiva'] : date('Y-m-d');
    $obraOrigem    = !empty($ev['obra_origem_id'])  ? (int)$ev['obra_origem_id']  : null;
    $obraDestino   = !empty($ev['obra_destino_id']) ? (int)$ev['obra_destino_id'] : null;
    $statusOrigem  = normalizaStatusColaborador($ev['status_origem']  ?? null);
    $statusDestino = normalizaStatusColaborador($ev['status_destino'] ?? null);
    $usuarioId     = !empty($ev['usuario_id']) ? $ev['usuario_id'] : null;
    $observacao    = $ev['observacao'] ?? null;

    try {
        if (!temEventosTipados($conn)) {
            // Banco sem a migração: preserva exatamente o comportamento anterior.
            if ($tipo !== 'mobilizacao' && $tipo !== 'status') return false;
            $stmt = $conn->prepare("
                INSERT INTO movimentacoes
                    (colaborador_id, obra_origem_id, obra_destino_id, data_movimentacao, data_programada, usuario_id)
                VALUES (?, ?, ?, NOW(), ?, ?)
            ");
            $stmt->execute([$colabId, $obraOrigem, $obraDestino, $dataEfetiva, $usuarioId]);
            return true;
        }

        // Guarda de idempotência. `<=>` é a igualdade NULL-safe do MySQL: sem
        // ela, linhas com destino NULL nunca casariam entre si.
        $dup = $conn->prepare("
            SELECT id FROM movimentacoes
             WHERE colaborador_id  = ?
               AND data_programada <=> ?
               AND tipo            = ?
               AND obra_destino_id <=> ?
               AND status_destino  <=> ?
               AND observacao      <=> ?
             LIMIT 1
        ");
        $dup->execute([$colabId, $dataEfetiva, $tipo, $obraDestino, $statusDestino, $observacao]);
        if ($dup->fetchColumn()) return false;

        $stmt = $conn->prepare("
            INSERT INTO movimentacoes
                (colaborador_id, obra_origem_id, obra_destino_id, data_movimentacao,
                 data_programada, usuario_id, tipo, status_origem, status_destino,
                 observacao, registrado_em)
            VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $colabId, $obraOrigem, $obraDestino, $dataEfetiva, $usuarioId,
            $tipo, $statusOrigem, $statusDestino, $observacao,
        ]);
        return true;
    } catch (PDOException $e) {
        // Histórico é complementar à operação: nunca derrubar a escrita
        // principal do colaborador por falha ao registrar o evento.
        return false;
    }
}

/**
 * Vocabulário de status do contrato. Duas famílias que não colidem: alocação
 * (`ocioso`, `sem_alocacao`, `indeterminado`) e situação contratual
 * (`rascunho`, `ativo`, `suspenso`, `encerrado`, `inadimplente`).
 */
function normalizaStatusContrato($valor) {
    if ($valor === null || $valor === '') return null;
    $s = strtolower(trim(preg_replace('/^__|__$/', '', (string)$valor)));
    $conhecidos = [
        'ocioso', 'sem_alocacao', 'indeterminado',
        'rascunho', 'ativo', 'suspenso', 'encerrado', 'inadimplente',
    ];
    return in_array($s, $conhecidos, true) ? $s : null;
}

/**
 * Grava um evento no histórico do contrato (`movimentacoes_contratos`).
 *
 * Mesmo contrato de `registrarEventoColaborador` e `registrarEventoPatrimonio`.
 * O tipo `status_contrato` registra a mudança da situação contratual, que antes
 * acontecia sem deixar rastro de quem mudou nem quando.
 */
function registrarEventoContrato($conn, array $ev): bool {
    $contratoId = $ev['contrato_id'] ?? null;
    if (!$contratoId) return false;

    $tipo          = $ev['tipo'] ?? 'mobilizacao';
    $dataEfetiva   = !empty($ev['data_efetiva']) ? $ev['data_efetiva'] : date('Y-m-d');
    $obraOrigem    = !empty($ev['obra_origem_id'])  ? (int)$ev['obra_origem_id']  : null;
    $obraDestino   = !empty($ev['obra_destino_id']) ? (int)$ev['obra_destino_id'] : null;
    $statusOrigem  = normalizaStatusContrato($ev['status_origem']  ?? null);
    $statusDestino = normalizaStatusContrato($ev['status_destino'] ?? null);
    $usuarioId     = !empty($ev['usuario_id']) ? $ev['usuario_id'] : null;
    $observacao    = $ev['observacao'] ?? null;

    try {
        if (!temEventosTipadosEm($conn, 'movimentacoes_contratos')) {
            if ($tipo !== 'mobilizacao' && $tipo !== 'status') return false;
            $stmt = $conn->prepare("
                INSERT INTO movimentacoes_contratos
                    (contrato_id, obra_origem_id, obra_destino_id, data_movimentacao, data_programada, usuario_id)
                VALUES (?, ?, ?, NOW(), ?, ?)
            ");
            $stmt->execute([$contratoId, $obraOrigem, $obraDestino, $dataEfetiva, $usuarioId]);
            return true;
        }

        $dup = $conn->prepare("
            SELECT id FROM movimentacoes_contratos
             WHERE contrato_id     = ?
               AND data_programada <=> ?
               AND tipo            = ?
               AND obra_destino_id <=> ?
               AND status_destino  <=> ?
               AND observacao      <=> ?
             LIMIT 1
        ");
        $dup->execute([$contratoId, $dataEfetiva, $tipo, $obraDestino, $statusDestino, $observacao]);
        if ($dup->fetchColumn()) return false;

        $stmt = $conn->prepare("
            INSERT INTO movimentacoes_contratos
                (contrato_id, obra_origem_id, obra_destino_id, data_movimentacao,
                 data_programada, usuario_id, tipo, status_origem, status_destino,
                 observacao, registrado_em)
            VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $contratoId, $obraOrigem, $obraDestino, $dataEfetiva, $usuarioId,
            $tipo, $statusOrigem, $statusDestino, $observacao,
        ]);
        return true;
    } catch (PDOException $e) {
        return false;
    }
}

/**
 * Grava um evento no histórico do patrimônio (`movimentacoes_patrimonios`).
 *
 * Mesmo contrato de `registrarEventoColaborador`, com dois acréscimos próprios
 * do domínio: `tipo = 'responsavel'` registra a transferência do bem para um
 * colaborador — que antes só existia em `responsabilidades_patrimonios`, fora
 * do histórico do bem — e o vocabulário de status é o de patrimônio.
 *
 * `$ev`: patrimonio_id, tipo, data_efetiva e, conforme o tipo,
 * obra_origem_id, obra_destino_id, status_origem, status_destino,
 * colaborador_id, usuario_id, observacao.
 */
function registrarEventoPatrimonio($conn, array $ev): bool {
    $patId = $ev['patrimonio_id'] ?? null;
    if (!$patId) return false;

    $tipo          = $ev['tipo'] ?? 'mobilizacao';
    $dataEfetiva   = !empty($ev['data_efetiva']) ? $ev['data_efetiva'] : date('Y-m-d');
    $obraOrigem    = !empty($ev['obra_origem_id'])  ? (int)$ev['obra_origem_id']  : null;
    $obraDestino   = !empty($ev['obra_destino_id']) ? (int)$ev['obra_destino_id'] : null;
    $statusOrigem  = normalizaStatusPatrimonio($ev['status_origem']  ?? null);
    $statusDestino = normalizaStatusPatrimonio($ev['status_destino'] ?? null);
    $colaboradorId = !empty($ev['colaborador_id']) ? (int)$ev['colaborador_id'] : null;
    $usuarioId     = !empty($ev['usuario_id']) ? $ev['usuario_id'] : null;
    $observacao    = $ev['observacao'] ?? null;

    try {
        if (!temEventosTipadosEm($conn, 'movimentacoes_patrimonios')) {
            // Banco sem a migração: preserva o comportamento anterior, que só
            // sabia registrar mobilização entre obras.
            if ($tipo !== 'mobilizacao' && $tipo !== 'status') return false;
            $stmt = $conn->prepare("
                INSERT INTO movimentacoes_patrimonios
                    (patrimonio_id, obra_origem_id, obra_destino_id, data_movimentacao, data_programada, usuario_id)
                VALUES (?, ?, ?, NOW(), ?, ?)
            ");
            $stmt->execute([$patId, $obraOrigem, $obraDestino, $dataEfetiva, $usuarioId]);
            return true;
        }

        // Idempotência: `<=>` é a igualdade NULL-safe do MySQL.
        $dup = $conn->prepare("
            SELECT id FROM movimentacoes_patrimonios
             WHERE patrimonio_id   = ?
               AND data_programada <=> ?
               AND tipo            = ?
               AND obra_destino_id <=> ?
               AND status_destino  <=> ?
               AND colaborador_id  <=> ?
               AND observacao      <=> ?
             LIMIT 1
        ");
        $dup->execute([$patId, $dataEfetiva, $tipo, $obraDestino, $statusDestino, $colaboradorId, $observacao]);
        if ($dup->fetchColumn()) return false;

        $stmt = $conn->prepare("
            INSERT INTO movimentacoes_patrimonios
                (patrimonio_id, obra_origem_id, obra_destino_id, data_movimentacao,
                 data_programada, usuario_id, tipo, status_origem, status_destino,
                 colaborador_id, observacao, registrado_em)
            VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $patId, $obraOrigem, $obraDestino, $dataEfetiva, $usuarioId,
            $tipo, $statusOrigem, $statusDestino, $colaboradorId, $observacao,
        ]);
        return true;
    } catch (PDOException $e) {
        return false;
    }
}

// ============================================================
// Conexão com banco
// ============================================================
// SEC: credenciais NUNCA no código. Lidas de variáveis de ambiente ou de
// `api-config.php` (fora do versionamento) que retorna
// ['host'=>..,'db'=>..,'user'=>..,'pass'=>..].
$dbCfg = [];
$dbCfgFile = __DIR__ . '/api-config.php';
if (is_readable($dbCfgFile)) {
    $loaded = require $dbCfgFile;
    if (is_array($loaded)) $dbCfg = $loaded;
}
$host     = getenv('DB_HOST') ?: ($dbCfg['host'] ?? 'localhost');
$db_name  = getenv('DB_NAME') ?: ($dbCfg['db']   ?? '');
$username = getenv('DB_USER') ?: ($dbCfg['user'] ?? '');
$password = getenv('DB_PASS') ?: ($dbCfg['pass'] ?? '');

if ($db_name === '' || $username === '') {
    error_log('[api.php] credenciais de banco ausentes (DB_NAME/DB_USER)');
    json_response(["error" => "Configuração de banco ausente"], 500);
}

try {
    $conn = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8mb4", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    error_log('[api.php] falha na conexão: ' . $e->getMessage());
    json_response(["error" => "Falha na conexão com o banco de dados"], 500);
}

// ============================================================
// FUNÇÃO PARA SANITIZAR obraAtualId (converte strings especiais em status_especial)
// ============================================================
/**
 * Sanitiza o valor de obraAtualId vindo do frontend.
 * Retorna um array com 'obraAtualId' (int|null) e 'status_especial' (string|null).
 *
 * @param mixed $value      Valor original (pode ser string especial como "__afastamento__")
 * @param string|null $currentStatus   Status atual do colaborador (caso queira manter)
 * @return array
 */
function sanitizeObraAtualId($value, $currentStatus = null) {
    // Se for null ou vazio, apenas anula obraAtualId e mantém status atual
    if ($value === null || $value === '') {
        return ['obraAtualId' => null, 'status_especial' => $currentStatus];
    }

    // Se for uma string especial do tipo __afastamento__, __folga__, __ferias__
    if (is_string($value) && preg_match('/^__(.*)__$/', $value, $matches)) {
        $status = $matches[1]; // afastamento, folga, ferias
        return ['obraAtualId' => null, 'status_especial' => $status];
    }

    // Se for numérico, força inteiro
    if (is_numeric($value)) {
        return ['obraAtualId' => (int)$value, 'status_especial' => $currentStatus];
    }

    // Fallback: anula obraAtualId e mantém status atual
    return ['obraAtualId' => null, 'status_especial' => $currentStatus];
}

// ============================================================
// Identificar recurso
// ============================================================
$method = $_SERVER['REQUEST_METHOD'];
$resource = $_GET['rota'] ?? '';
$id = $_GET['id'] ?? null;
$input = json_decode(file_get_contents("php://input"), true) ?? [];

// ==============================================
// NORMALIZAR INPUT: converter camelCase → snake_case
// ==============================================
function normalizeInputKeys($arr) {
    // Mantém as chaves originais (a maior parte do código lê camelCase, ex.
    // $input['clienteId']) e apenas ADICIONA um alias snake_case quando ainda
    // não existir, para os poucos trechos que leem snake_case diretamente.
    // Versão anterior substituía as chaves e quebrava ~70 leituras camelCase.
    $result = $arr;
    foreach ($arr as $key => $value) {
        $snake_key = preg_replace('/([a-z0-9])([A-Z])/', '$1_$2', $key);
        $snake_key = strtolower($snake_key);
        if (!array_key_exists($snake_key, $result)) {
            $result[$snake_key] = $value;
        }
    }
    return $result;
}
$input = normalizeInputKeys($input);

// ==============================================
// FUNÇÕES JWT E MIDDLEWARE
// ==============================================
// SEC: tokens assinados (HMAC-SHA256). Sem assinatura válida o payload é
// recusado — impossível forjar user_id/is_gm no cliente.
function b64url_encode($raw) { return rtrim(strtr(base64_encode($raw), '+/', '-_'), '='); }
function b64url_decode($str) {
    $str = strtr($str, '-_', '+/');
    $pad = strlen($str) % 4;
    if ($pad) $str .= str_repeat('=', 4 - $pad);
    return base64_decode($str);
}

function tokenSecret() {
    static $secret = null;
    if ($secret !== null) return $secret;
    $env = getenv('APP_TOKEN_SECRET');
    if ($env) { $secret = $env; return $secret; }
    // Fallback: segredo persistido em arquivo local (gerado uma única vez).
    $file = __DIR__ . '/.api-token-secret';
    if (is_readable($file)) {
        $secret = trim(file_get_contents($file));
        if ($secret !== '') return $secret;
    }
    $secret = bin2hex(random_bytes(32));
    @file_put_contents($file, $secret);
    @chmod($file, 0600);
    return $secret;
}

function generateToken($userId, $login) {
    $payload = ['user_id' => $userId, 'login' => $login, 'exp' => time() + (24 * 60 * 60)];
    $body = b64url_encode(json_encode($payload));
    $sig  = b64url_encode(hash_hmac('sha256', $body, tokenSecret(), true));
    return $body . '.' . $sig;
}

/** @param bool $allowExpired usado pelo refresh (janela de graça). */
function validateToken($token, $allowExpired = false) {
    if (!$token) return false;
    $parts = explode('.', $token);
    if (count($parts) !== 2) return false;
    [$body, $sig] = $parts;
    $expected = b64url_encode(hash_hmac('sha256', $body, tokenSecret(), true));
    if (!hash_equals($expected, $sig)) return false;
    $payload = json_decode(b64url_decode($body), true);
    if (!$payload || !isset($payload['exp'])) return false;
    if (!$allowExpired && $payload['exp'] < time()) return false;
    return $payload;
}

// Detecta se a migração 2026_07_16 (matriz_permissoes/papeis_permissao/
// acesso_compras) já foi aplicada. Memoizado por request.
function usuariosTemColunasMatriz($conn) {
    static $tem = null;
    if ($tem !== null) return $tem;
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'matriz_permissoes'");
        $tem = $stmt && $stmt->fetch() !== false;

        // Log se as colunas estão faltando (para debug)
        if (!$tem) {
            error_log("[AVISO] Colunas matriz_permissoes/papeis_permissao NÃO ENCONTRADAS na tabela usuarios. Migração 2026_07_16 pode não ter sido executada. Permissões não serão persistidas!");
        }
    } catch (PDOException $e) {
        $tem = false;
        error_log("[ERRO] Falha ao verificar colunas matriz_permissoes: " . err_detail($e));
    }
    return $tem;
}

// Detecta se a migração 2026_08_07 (cliente_responsaveis) já foi aplicada.
// Memoizado por request. Sem a tabela, o "Responsável por negociação" e o
// recorte de carteira do CRM degradam ABERTOS (nada é filtrado) — degradar
// fechado esvaziaria o funil de todo mundo num host desatualizado.
function clienteResponsaveisDisponivel($conn) {
    static $tem = null;
    if ($tem !== null) return $tem;
    try {
        $stmt = $conn->query("SHOW TABLES LIKE 'cliente_responsaveis'");
        $tem = $stmt && $stmt->fetch() !== false;
        if (!$tem) {
            error_log("[AVISO] Tabela cliente_responsaveis NÃO ENCONTRADA. Migração 2026_08_07 pode não ter sido executada. Responsáveis por negociação não serão persistidos nem filtrados!");
        }
    } catch (PDOException $e) {
        $tem = false;
        error_log("[ERRO] Falha ao verificar tabela cliente_responsaveis: " . err_detail($e));
    }
    return $tem;
}

// Decodifica coluna JSON (LONGTEXT) tolerando NULL/valor inválido.
function decodePermissaoJson($valor) {
    if ($valor === null || $valor === '') return null;
    $dec = json_decode($valor, true);
    return is_array($dec) ? $dec : null;
}

/**
 * Verifica se o usuário do token é GM, consultando usuarios.is_gm.
 * O token só carrega { user_id, login, exp }, então o flag vem do banco.
 * Memoizado por request (o mesmo usuário não é consultado duas vezes).
 */
function usuarioEhGm($conn, $authUser) {
    static $cache = [];
    $uid = $authUser['user_id'] ?? null;
    if ($uid === null) return false;
    if (array_key_exists($uid, $cache)) return $cache[$uid];
    try {
        $stmt = $conn->prepare("SELECT is_gm FROM usuarios WHERE id = ?");
        $stmt->execute([$uid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $cache[$uid] = $row ? (bool)$row['is_gm'] : false;
    } catch (PDOException $e) {
        $cache[$uid] = false;
    }
    return $cache[$uid];
}

/**
 * Barreira de GM para rotas administrativas. Encerra a requisição com 403
 * quando o usuário do token não é GM — a decisão vem do banco (`is_gm`), nunca
 * do payload do token (que carrega apenas user_id/login/exp) nem do corpo da
 * requisição, ambos sob controle do cliente.
 *
 * Use em toda rota cuja PÁGINA correspondente é GM-only no frontend
 * (`RequireAccess gm`): sem isto, o gate existe só na UI e a rota continua
 * aberta a qualquer usuário autenticado por chamada direta ao api.php.
 * Ver docs/security/access-control.md §9.
 */
function exigirGm($conn, $authUser, $oque = 'esta operação') {
    if (!usuarioEhGm($conn, $authUser)) {
        json_response(["error" => "Permissão negada: apenas GM pode executar $oque."], 403);
    }
}

// ============================================================
// Autorização por MÓDULO (PageKey). Espelha RANK_NIVEL/podePlayerAcao de
// src/lib/authz/paginas.ts.
//
// Fonte do nível: as colunas `acesso_*` da tabela `usuarios`. Elas são a
// projeção grossa da matriz fina e o Quadro de Permissões as regrava a cada
// salvamento (Permissoes.tsx envia `matrizPermissoes` E `acessos`, este último
// derivado por `acessosDerivadosDeMatriz`). Diferente de `matriz_permissoes`,
// existem em qualquer host — inclusive nos sem a migração 2026_07_16 — então o
// gate nunca degrada para "libera tudo".
// ============================================================
define('NIVEL_NENHUM', 0);
define('NIVEL_VISUALIZAR', 1);
define('NIVEL_EDITAR', 2);

/** PageKey do frontend => coluna ENUM correspondente em `usuarios`. */
function colunaAcessoDaPage($page) {
    $map = [
        'obras_div'   => 'acesso_obras',
        'rh'          => 'acesso_colaboradores',
        'patrimonios' => 'acesso_patrimonios',
        'frotas'      => 'acesso_frotas',
        'dp'          => 'acesso_dp',
        'admin'       => 'acesso_gm',
        'financeiro'  => 'acesso_financeiro',
        'contratos'   => 'acesso_contratos',
        'crm'         => 'acesso_crm',
        // Suprimentos/Almoxarifado. A coluna manteve o nome legado
        // `acesso_compras`, como `rh` mora em `acesso_colaboradores`.
        'almoxarifado' => 'acesso_compras',
    ];
    return $map[$page] ?? null;
}

/**
 * Nível do usuário do token no módulo `$page` (0/1/2). GM sempre 2.
 * 'compras' e 'financeiro' são níveis do ENUM de acesso_financeiro e valem
 * edição, como em RANK_NIVEL no frontend.
 * Em erro de banco devolve 0 (restritivo) — nunca libera por falha.
 */
function nivelAcessoModulo($conn, $authUser, $page) {
    static $linha = [];
    if (usuarioEhGm($conn, $authUser)) return NIVEL_EDITAR;
    $col = colunaAcessoDaPage($page);
    if ($col === null) return NIVEL_NENHUM;
    $uid = $authUser['user_id'] ?? null;
    if ($uid === null) return NIVEL_NENHUM;
    if (!array_key_exists($uid, $linha)) {
        try {
            // `acesso_compras` (módulo Almoxarifado) só existe com a migração
            // 2026_07_16 — incluí-la sem checar derrubaria o SELECT inteiro em
            // host antigo e, pelo catch abaixo, trancaria TODOS os módulos.
            $colCompras = usuariosTemColunasMatriz($conn) ? ", acesso_compras" : "";
            $stmt = $conn->prepare(
                "SELECT acesso_obras, acesso_colaboradores, acesso_patrimonios,
                        acesso_frotas, acesso_dp, acesso_gm, acesso_financeiro,
                        acesso_contratos, acesso_crm{$colCompras}
                 FROM usuarios WHERE id = ?"
            );
            $stmt->execute([$uid]);
            $linha[$uid] = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        } catch (PDOException $e) {
            $linha[$uid] = [];
        }
    }
    // Sem a coluna (host sem migração), o Almoxarifado herda o nível de Obras:
    // é de lá que o módulo saiu, então ninguém perde acesso na transição.
    if ($col === 'acesso_compras' && !array_key_exists('acesso_compras', $linha[$uid])) {
        $col = 'acesso_obras';
    }
    $valor = strtolower(trim((string)($linha[$uid][$col] ?? '')));
    if ($valor === 'editar' || $valor === 'compras' || $valor === 'financeiro') return NIVEL_EDITAR;
    if ($valor === 'visualizar') return NIVEL_VISUALIZAR;
    return NIVEL_NENHUM;
}

/**
 * Exige nível mínimo em PELO MENOS UM dos módulos informados. A lista existe
 * porque há rotas legitimamente compartilhadas — `despesas` alimenta Financeiro
 * e Contratos; `medicoes` alimenta Financeiro e as abas de /obras/:id.
 * Encerra a requisição com 403 quando nenhum módulo satisfaz.
 */
function exigirAcesso($conn, $authUser, array $pages, $nivelMin = NIVEL_VISUALIZAR) {
    foreach ($pages as $page) {
        if (nivelAcessoModulo($conn, $authUser, $page) >= $nivelMin) return;
    }
    $acao = $nivelMin >= NIVEL_EDITAR ? 'alterar' : 'consultar';
    json_response([
        "error" => "Permissão negada: sem acesso para $acao dados deste módulo (" .
                   implode('/', $pages) . ")."
    ], 403);
}

// ============================================================
// Autorização por SETOR da Aprovação Financeira.
// Espelha src/lib/authz/paginas.ts (SETORES_SUPABASE, normalizarSetores,
// normalizarSetorLegado): os setores concedidos ao usuário são slugs
// canônicos; o rótulo legado da lista antiga da tela ("RH") mapeia para o slug
// correspondente. Mantidos aqui em PHP para que o filtro seja aplicado no
// servidor (não só escondido na UI).
//
// ⚠️ CÓPIA de src/lib/authz/paginas.ts — se mudar setores/rótulos lá, mude aqui
// (e na edge sync-player-auth). Ver docs/security/access-control.md §8.
// ============================================================
function setoresValidosFin() {
    return ['engenharia', 'dp', 'financeiro', 'compras', 'seguranca', 'fiscalizacao', 'qualidade', 'almoxarifado', 'frotas'];
}
function setoresLabelFin() { // slug => rótulo (lowercase) canônico
    return [
        'engenharia'   => 'engenharia',
        'dp'           => 'depto. pessoal',
        'financeiro'   => 'financeiro',
        'compras'      => 'compras',
        'seguranca'    => 'segurança',
        'fiscalizacao' => 'fiscalização',
        'qualidade'    => 'qualidade',
        'almoxarifado' => 'almoxarifado',
        'frotas'       => 'frotas',
    ];
}
// "almoxarifado"/"frotas" saíram daqui ao virarem setor próprio: mantê-los faria
// setoresRawAceitosFin() aceitar essas linhas para quem tem só Compras/Engenharia.
function setoresLegadoFin() { // raw(lowercase) => slug
    return ['rh' => 'dp'];
}

/** Normaliza a lista de setores gravada do usuário para os slugs válidos. */
function normalizarSetoresFin($arr) {
    $validos = setoresValidosFin();
    $out = [];
    if (!is_array($arr)) return $out;
    foreach ($arr as $s) {
        if (!is_string($s)) continue;
        $n = strtolower(trim($s));
        if (in_array($n, $validos, true) && !in_array($n, $out, true)) $out[] = $n;
    }
    return $out;
}

/** Converte um valor de setor gravado (slug/rótulo/legado) no slug canônico. */
function normalizarSetorLegadoFin($raw) {
    if (!is_string($raw)) return '';
    $n = strtolower(trim($raw));
    if ($n === '') return '';
    if (in_array($n, setoresValidosFin(), true)) return $n;
    foreach (setoresLabelFin() as $slug => $label) { if ($label === $n) return $slug; }
    $leg = setoresLegadoFin();
    if (isset($leg[$n])) return $leg[$n];
    return trim($raw); // desconhecido: preserva (só GM enxerga)
}

/** Valores crus (lowercase) aceitos no WHERE p/ os slugs concedidos. */
function setoresRawAceitosFin($slugs) {
    $labels = setoresLabelFin();
    $leg = setoresLegadoFin();
    $out = [];
    foreach ($slugs as $s) {
        $out[$s] = true;
        if (isset($labels[$s])) $out[$labels[$s]] = true;
    }
    foreach ($leg as $raw => $slug) { if (in_array($slug, $slugs, true)) $out[$raw] = true; }
    return array_keys($out);
}

/**
 * Papel de visibilidade financeira do usuário do token.
 * Retorna ['is_gm'=>bool, 'setores'=>slugs[], 'aplicavel'=>bool]. `aplicavel`
 * indica que as colunas de permissão existem; sem a migração 2026_07_16 o
 * filtro degrada (retorna tudo) para não quebrar hosts desatualizados.
 */
function papelSetorFin($conn, $authUser) {
    $res = ['is_gm' => false, 'setores' => [], 'aplicavel' => false];
    if (!usuariosTemColunasMatriz($conn)) return $res; // sem migração → sem filtro
    $res['aplicavel'] = true;
    try {
        $stmt = $conn->prepare("SELECT is_gm, papeis_permissao FROM usuarios WHERE id = ?");
        $stmt->execute([$authUser['user_id'] ?? 0]);
        if ($ru = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $res['is_gm'] = (bool)$ru['is_gm'];
            $papeis = decodePermissaoJson($ru['papeis_permissao'] ?? null);
            $setores = (is_array($papeis) && isset($papeis['setores'])) ? $papeis['setores'] : [];
            $res['setores'] = normalizarSetoresFin($setores);
        }
    } catch (PDOException $e) { /* restritivo: aplicavel=true, setores=[] */ }
    return $res;
}

/**
 * Autorização de ESCRITA numa solicitação existente (aprovar/recusar/cancelar/
 * editar/comentar). GM sempre pode; não-GM só se a solicitação for de um setor
 * concedido a ele ou criada por ele. Sem migração de permissões, não restringe.
 * `$solId` inexistente devolve true — deixa o handler responder o 404 dele.
 */
function podeMexerSolicitacaoFin($conn, $authUser, $solId) {
    $papel = papelSetorFin($conn, $authUser);
    if (!$papel['aplicavel'] || $papel['is_gm']) return true;
    if (!$solId) return false;
    try {
        $stmt = $conn->prepare("SELECT setor, criado_por FROM solicitacoes_financeiras WHERE id = ?");
        $stmt->execute([$solId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return true; // inexistente: handler trata 404
        $slug = normalizarSetorLegadoFin($row['setor'] ?? '');
        $criador = (string)($row['criado_por'] ?? '');
        $meuId = (string)($authUser['user_id'] ?? '');
        return in_array($slug, $papel['setores'], true) || $criador === $meuId;
    } catch (PDOException $e) {
        return false; // restritivo em erro
    }
}

// ============================================================
// CRM — escopo de visibilidade por carteira de clientes
// ============================================================

/**
 * Predicado SQL de escopo do CRM sobre a tabela `oportunidades` (alias `$alias`).
 *
 * Regra: **GM vê tudo**; qualquer outro usuário vê as oportunidades dos clientes
 * em que consta como "Responsável por negociação" (`cliente_responsaveis`) MAIS
 * aquelas em que ele é o responsável do próprio card. O braço `responsavel_id`
 * é o que mantém visível uma oportunidade ainda sem cliente vinculado — com
 * `cliente_id` nulo o EXISTS é falso e só ele carrega o card.
 *
 * `is_gm` vem do banco (`usuarioEhGm`), nunca de campo do token ou do corpo
 * da requisição — ver docs/security/access-control.md §9.1.
 *
 * Devolve `['sql' => string, 'params' => array]`. `sql` vazio significa "sem
 * filtro": é o caso do GM e o da degradação quando a migração 2026_08_07 não
 * foi aplicada (sem a tabela, filtrar esvaziaria o funil de todos).
 *
 * ⚠️ Espelhado no frontend por `podeVerOportunidade()` em src/lib/crm/escopo.ts.
 * Mudou a regra aqui? Mude lá também — a camada do servidor é a que vale como
 * segurança; a do cliente é UX/defesa em profundidade.
 */
function escopoOportunidadesFin($conn, $authUser, $alias = 'l') {
    $vazio = ['sql' => '', 'params' => []];
    if (usuarioEhGm($conn, $authUser)) return $vazio;
    if (!clienteResponsaveisDisponivel($conn)) return $vazio;
    $meuId = (int)($authUser['user_id'] ?? 0);
    return [
        'sql' => "(EXISTS (SELECT 1 FROM cliente_responsaveis cr"
               . " WHERE cr.cliente_id = {$alias}.cliente_id AND cr.usuario_id = ?)"
               . " OR {$alias}.responsavel_id = ?)",
        'params' => [$meuId, $meuId],
    ];
}

/** Lê os responsáveis por negociação de um cliente (ids como string). */
function responsaveisDoClienteFin($conn, $clienteId) {
    if (!clienteResponsaveisDisponivel($conn)) return [];
    try {
        $stmt = $conn->prepare("SELECT usuario_id FROM cliente_responsaveis WHERE cliente_id = ? ORDER BY usuario_id");
        $stmt->execute([$clienteId]);
        return array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    } catch (PDOException $e) {
        return [];
    }
}

/**
 * Substitui a lista de responsáveis por negociação de um cliente pelo conteúdo
 * de `$ids` (sincronização completa: apaga o que saiu, insere o que entrou).
 * Ignora ids não numéricos e duplicados. No-op sem a migração aplicada.
 */
function salvarResponsaveisClienteFin($conn, $clienteId, $ids) {
    if (!clienteResponsaveisDisponivel($conn)) return;
    $limpos = [];
    if (is_array($ids)) {
        foreach ($ids as $raw) {
            if (!is_scalar($raw)) continue;
            $uid = (int)$raw;
            if ($uid > 0 && !in_array($uid, $limpos, true)) $limpos[] = $uid;
        }
    }
    $conn->prepare("DELETE FROM cliente_responsaveis WHERE cliente_id = ?")->execute([$clienteId]);
    if (!$limpos) return;
    $stmt = $conn->prepare("INSERT IGNORE INTO cliente_responsaveis (cliente_id, usuario_id) VALUES (?, ?)");
    foreach ($limpos as $uid) $stmt->execute([$clienteId, $uid]);
}

/**
 * Handler genérico de comentários encadeados por entidade (mesmo padrão de
 * oportunidade_comentarios). Usado pelos quadros de Colaboradores, Patrimônios
 * e Contratos. GET (lista, filtra por <idCol>), POST (cria), PUT (edita texto),
 * DELETE (remove). Mapeia a coluna <idCol> do banco para a chave camelCase
 * <idKey> no JSON de resposta.
 *
 * Segurança: o autor é gravado a partir do login do token (fonte-verdade);
 * editar/excluir exige ser o autor ou GM; toda mutação registra trilha de
 * auditoria (logAudit). Limite de tamanho do texto para evitar abuso.
 */
function handleComentariosEntidade($conn, $method, $id, $input, $table, $idCol, $idKey, $authUser) {
    $LIMITE_TEXTO = 5000;
    $prep = function($r) use ($idCol, $idKey) {
        if (!$r) return $r;
        $r['id'] = (string)$r['id'];
        $r[$idKey] = (string)$r[$idCol];
        unset($r[$idCol]);
        return $r;
    };
    // Carrega um comentário cru (para checagem de posse/auditoria).
    $carregar = function($cid) use ($conn, $table) {
        $s = $conn->prepare("SELECT * FROM $table WHERE id = ?");
        $s->execute([$cid]);
        return $s->fetch(PDO::FETCH_ASSOC) ?: null;
    };
    // Só o autor (por login) ou um GM pode editar/excluir.
    $podeMutar = function($alvo) use ($conn, $authUser) {
        $meuLogin = $authUser['login'] ?? '';
        $dono = $alvo['autor'] ?? '';
        $ehDono = ($dono !== '' && $dono === $meuLogin);
        return $ehDono || usuarioEhGm($conn, $authUser);
    };

    if ($method === 'GET') {
        try {
            $entId = $_GET[$idCol] ?? null;
            $sql = "SELECT * FROM $table";
            $params = [];
            if ($entId) { $sql .= " WHERE $idCol = ?"; $params[] = $entId; }
            $sql .= " ORDER BY created_at ASC";
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
            json_response(array_map($prep, $stmt->fetchAll(PDO::FETCH_ASSOC)));
        } catch (PDOException $e) {
            json_response(["error" => "Erro ao buscar comentários: " . err_detail($e)], 500);
        }
    }
    elseif ($method === 'POST') {
        try {
            $entId = $input[$idKey] ?? null;
            $texto = trim($input['texto'] ?? '');
            if (!$entId || $texto === '') {
                json_response(["error" => "$idKey e texto são obrigatórios"], 400);
            }
            if (mb_strlen($texto) > $LIMITE_TEXTO) $texto = mb_substr($texto, 0, $LIMITE_TEXTO);
            // Autor confiável: login do token (fallback ao enviado pelo cliente).
            $autor = $authUser['login'] ?? ($input['autor'] ?? '');
            $stmt = $conn->prepare("INSERT INTO $table ($idCol, texto, autor) VALUES (:ent, :texto, :autor)");
            $stmt->execute(['ent' => (int)$entId, 'texto' => $texto, 'autor' => $autor]);
            $novoId = $conn->lastInsertId();
            logAudit($conn, $authUser, $table, $novoId, 'insert', null, ['texto' => $texto, $idKey => (string)$entId]);
            $stmt2 = $conn->prepare("SELECT * FROM $table WHERE id = ?");
            $stmt2->execute([$novoId]);
            json_response($prep($stmt2->fetch(PDO::FETCH_ASSOC)), 201);
        } catch (PDOException $e) {
            json_response(["error" => "Erro ao adicionar comentário: " . err_detail($e)], 500);
        }
    }
    elseif ($method === 'PUT' && $id) {
        try {
            $texto = trim($input['texto'] ?? '');
            if ($texto === '') json_response(["error" => "texto é obrigatório"], 400);
            if (mb_strlen($texto) > $LIMITE_TEXTO) $texto = mb_substr($texto, 0, $LIMITE_TEXTO);
            $alvo = $carregar($id);
            if (!$alvo) json_response(["error" => "Comentário não encontrado"], 404);
            if (!$podeMutar($alvo)) json_response(["error" => "Apenas o autor ou um GM pode editar"], 403);
            $conn->prepare("UPDATE $table SET texto = :texto, updated_at = NOW() WHERE id = :id")
                 ->execute(['texto' => $texto, 'id' => $id]);
            logAudit($conn, $authUser, $table, $id, 'update', ['texto' => $alvo['texto'] ?? null], ['texto' => $texto]);
            $stmt2 = $conn->prepare("SELECT * FROM $table WHERE id = ?");
            $stmt2->execute([$id]);
            json_response($prep($stmt2->fetch(PDO::FETCH_ASSOC)));
        } catch (PDOException $e) {
            json_response(["error" => "Erro ao atualizar comentário: " . err_detail($e)], 500);
        }
    }
    elseif ($method === 'DELETE' && $id) {
        try {
            $alvo = $carregar($id);
            if (!$alvo) json_response(["error" => "Comentário não encontrado"], 404);
            if (!$podeMutar($alvo)) json_response(["error" => "Apenas o autor ou um GM pode excluir"], 403);
            $conn->prepare("DELETE FROM $table WHERE id = ?")->execute([$id]);
            logAudit($conn, $authUser, $table, $id, 'delete', ['texto' => $alvo['texto'] ?? null], null);
            json_response(["message" => "Comentário removido"]);
        } catch (PDOException $e) {
            json_response(["error" => "Erro ao remover comentário: " . err_detail($e)], 500);
        }
    }
    else {
        json_response(["error" => "Método não permitido"], 405);
    }
}

// Rotas protegidas
$protectedRoutes = [
    'colaboradores', 'obras', 'funcoes', 'mobilizar', 'mobilizacoesPeriodos', 'patrimonios', 'patrimoniosPeriodos', 'responsabilidades', 'mobilizarPatrimonio', 'contratos',
    'mobilizarContrato', 'contratosPeriodos', 'veiculos', 'mobilizarVeiculo', 'documentoTipos', 'despesas', 'formasPagamento',
    'historicoSalarial', 'fopagEntries', 'horasExtras', 'provisoes', 'decimoTerceiro',
    'solicitacoesFinanceiras', 'solicitacaoComentarios', 'aprovarSolicitacao', 'usuarios',
    // 'dp', 'folhaPagamento', 'ferias', 'rescisoes' foram removidos: não existe
    // `case` correspondente no switch principal, então só poluíam a auditoria
    // sugerindo uma superfície protegida que na prática cai em 404.
    'documentoColaborador', 'clientes',
    'recebimentos', 'notas_fiscais', 'medicoes', 'bms_previstas',
    'centros_custo_totvs', 'financeiro_snapshots', 'financeiro_lancamentos',
    'oportunidades', 'oportunidadeEstagio', 'oportunidadeConverter', 'interacoes', 'funil_estagios',
    'atividades', 'crmStats', 'oportunidadeComentarios',
    'dpHolerites', 'pontoImportacoes', 'pontoRegistros', 'dpHomemHora', 'dpFechamentoCompetencia',
    'crmTarefas', 'crmMotivosPerda', 'crmPerdas', 'oportunidadeHistorico',
    'auditLogs', 'perfisPermissao',
    'delegacoes', 'veiculoTipos', 'histograma',
    'colaboradorComentarios', 'patrimonioComentarios', 'contratoComentarios',
    // Estavam FORA desta lista — ou seja, acessíveis sem token nenhum, mesmo
    // servindo páginas GM-only. `auditLogins` fica de fora de propósito: o POST
    // registra tentativas de login (inclusive as que falharam), quando ainda não
    // existe token; o GET dela valida o token inline.
    'featureFlags', 'notificacoes', 'diagnostico-permissoes',
    // Ponto/RHiD e o log de eventos tipado entraram sem passar por aqui: sem
    // token nenhum, expunham espelho de ponto, ocorrências, justificativas,
    // dispositivos REP e arquivos AFD. Mesma classe de falha que featureFlags.
    'pontoEspelho', 'pontoOcorrencias', 'pontoDepartamentoObra', 'pontoRhidVinculos',
    'pontoJustificativas', 'pontoJustificativaTipos', 'pontoDispositivos',
    'pontoAfdArquivos', 'pontoSyncErros',
    'mobilizacoesPeriodos', 'patrimoniosPeriodos', 'contratosPeriodos'
];

if (in_array($resource, $protectedRoutes)) {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authHeader = $headers['Authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $token = str_replace('Bearer ', '', $authHeader);
    $payload = validateToken($token);
    if (!$payload) {
        json_response(["error" => "Não autorizado"], 401);
    }
    $authUser = $payload;
}

// ============================================================
// AUTORIZAÇÃO POR MÓDULO (PageKey) — espelha podePlayerAcao do frontend.
//
// Estar em $protectedRoutes significa AUTENTICADO, não autorizado. Este bloco
// acrescenta a pergunta que faltava: "este usuário tem o módulo?". A tabela
// abaixo é o equivalente servidor do gate de UI (RequireAccess/sidebar).
//
// `gateGet` decide se a LEITURA também é restrita:
//   - true  → dado do módulo (folha, lançamentos, pipeline comercial);
//   - false → dado de referência lido por várias telas, ou carregado por um
//             provider global do App.tsx para QUALQUER autenticado (obras,
//             colaboradores, funcoes, clientes, oportunidades, patrimonios,
//             veiculos, contratos, responsabilidades, usuarios...). Gatear o
//             GET destes derrubaria o carregamento do app inteiro; só a
//             ESCRITA é restrita ao módulo dono.
// Ver docs/security/access-control.md §9.5.
// ============================================================
$moduloDasRotas = [
    // --- DP: folha, ponto, salário. Módulo fechado, leitura inclusive. ---
    'dpHolerites'            => ['pages' => ['dp'], 'gateGet' => true],
    'fopagEntries'           => ['pages' => ['dp'], 'gateGet' => true],
    'historicoSalarial'      => ['pages' => ['dp'], 'gateGet' => true],
    'horasExtras'            => ['pages' => ['dp'], 'gateGet' => true],
    'provisoes'              => ['pages' => ['dp'], 'gateGet' => true],
    'decimoTerceiro'         => ['pages' => ['dp'], 'gateGet' => true],
    'pontoImportacoes'       => ['pages' => ['dp'], 'gateGet' => true],
    'pontoRegistros'         => ['pages' => ['dp'], 'gateGet' => true],
    'dpHomemHora'            => ['pages' => ['dp'], 'gateGet' => true],
    // Ponto/RHiD: espelho, tratativas e infraestrutura de coleta. Tudo dado de
    // jornada — mesma sensibilidade da folha, logo leitura restrita também.
    'pontoEspelho'           => ['pages' => ['dp'], 'gateGet' => true],
    'pontoOcorrencias'       => ['pages' => ['dp'], 'gateGet' => true],
    'pontoDepartamentoObra'  => ['pages' => ['dp'], 'gateGet' => true],
    'pontoRhidVinculos'      => ['pages' => ['dp'], 'gateGet' => true],
    'pontoJustificativas'    => ['pages' => ['dp'], 'gateGet' => true],
    'pontoJustificativaTipos' => ['pages' => ['dp'], 'gateGet' => true],
    'pontoDispositivos'      => ['pages' => ['dp'], 'gateGet' => true],
    'pontoAfdArquivos'       => ['pages' => ['dp'], 'gateGet' => true],
    'pontoSyncErros'         => ['pages' => ['dp'], 'gateGet' => true],

    // --- Financeiro exclusivo ---
    'financeiro_lancamentos' => ['pages' => ['financeiro'], 'gateGet' => true],
    'financeiro_snapshots'   => ['pages' => ['financeiro'], 'gateGet' => true],
    // Despesas e formas de pagamento também alimentam a tela de Contratos.
    'despesas'               => ['pages' => ['financeiro', 'contratos'], 'gateGet' => true],
    'formasPagamento'        => ['pages' => ['financeiro', 'contratos'], 'gateGet' => true],
    // Financeiro DA OBRA. Aceitavam `obras_div` para preservar as abas de
    // /obras/:id, que exibiam medições e notas fiscais sem exigir Financeiro.
    // Decisão do produto: passam a exigir o módulo Financeiro, e as abas avisam
    // o que falta em vez de sumir (OBRA_TABS_FINANCEIRAS + SemAcessoModulo).
    'medicoes'               => ['pages' => ['financeiro'], 'gateGet' => true],
    'recebimentos'           => ['pages' => ['financeiro'], 'gateGet' => true],
    'notas_fiscais'          => ['pages' => ['financeiro'], 'gateGet' => true],
    'bms_previstas'          => ['pages' => ['financeiro'], 'gateGet' => true],
    'centros_custo_totvs'    => ['pages' => ['financeiro'], 'gateGet' => true],
    // Solicitações já filtram por SETOR dentro do handler; aqui entra o gate de
    // MÓDULO, que é ortogonal (setor diz "quais", módulo diz "se").
    'solicitacoesFinanceiras' => ['pages' => ['financeiro'], 'gateGet' => true],
    'solicitacaoComentarios'  => ['pages' => ['financeiro'], 'gateGet' => true],
    'aprovarSolicitacao'      => ['pages' => ['financeiro'], 'gateGet' => true],

    // --- CRM (o que não é carregado por provider global) ---
    'crmStats'               => ['pages' => ['crm'], 'gateGet' => true],
    'atividades'             => ['pages' => ['crm'], 'gateGet' => true],
    'interacoes'             => ['pages' => ['crm'], 'gateGet' => true],
    'crmTarefas'             => ['pages' => ['crm'], 'gateGet' => true],
    'crmMotivosPerda'        => ['pages' => ['crm'], 'gateGet' => true],
    'crmPerdas'              => ['pages' => ['crm'], 'gateGet' => true],
    'oportunidadeHistorico'  => ['pages' => ['crm'], 'gateGet' => true],
    'oportunidadeComentarios' => ['pages' => ['crm'], 'gateGet' => true],

    // --- Só ESCRITA (GET aberto: provider global / referência compartilhada) ---
    // Vários destes aceitam MAIS DE UM módulo porque a escrita cruza fronteiras
    // por desenho do produto — não por descuido:
    //   · o board /rh/equipes edita colaboradores e pode ser liberado por
    //     `rh` OU `obras_div` (ver Board.tsx: canEdit);
    //   · `mobilizar` move um COLABORADOR para uma obra — parte de RH, parte de
    //     Obras, disparado das duas telas;
    //   · delegações aparecem no Histograma (obras) e na aba de RH;
    //   · inativar colaborador (fluxo de RH) encerra responsabilidades e
    //     desvincula patrimônios.
    'colaboradores'          => ['pages' => ['rh', 'obras_div'], 'gateGet' => false],
    'documentoColaborador'   => ['pages' => ['rh'], 'gateGet' => false],
    'funcoes'                => ['pages' => ['rh'], 'gateGet' => false],
    'documentoTipos'         => ['pages' => ['rh'], 'gateGet' => false],
    'colaboradorComentarios' => ['pages' => ['rh'], 'gateGet' => false],
    'obras'                  => ['pages' => ['obras_div'], 'gateGet' => false],
    'mobilizar'              => ['pages' => ['obras_div', 'rh'], 'gateGet' => false],
    'histograma'             => ['pages' => ['obras_div'], 'gateGet' => false],
    'delegacoes'             => ['pages' => ['obras_div', 'rh'], 'gateGet' => false],
    'patrimonios'            => ['pages' => ['patrimonios', 'rh'], 'gateGet' => false],
    'responsabilidades'      => ['pages' => ['patrimonios', 'rh'], 'gateGet' => false],
    'mobilizarPatrimonio'    => ['pages' => ['patrimonios'], 'gateGet' => false],
    'patrimonioComentarios'  => ['pages' => ['patrimonios'], 'gateGet' => false],
    // Log de eventos tipado (períodos de alocação). Leitura aberta: o histórico
    // de mobilização é lido do RDO da obra, do export de movimentações e do
    // perfil do colaborador — módulos diferentes olhando o mesmo fato.
    'mobilizacoesPeriodos'   => ['pages' => ['rh', 'obras_div'], 'gateGet' => false],
    'patrimoniosPeriodos'    => ['pages' => ['patrimonios', 'rh'], 'gateGet' => false],
    'contratosPeriodos'      => ['pages' => ['contratos'], 'gateGet' => false],
    'contratos'              => ['pages' => ['contratos'], 'gateGet' => false],
    'mobilizarContrato'      => ['pages' => ['contratos'], 'gateGet' => false],
    'contratoComentarios'    => ['pages' => ['contratos'], 'gateGet' => false],
    'veiculos'               => ['pages' => ['frotas'], 'gateGet' => false],
    'mobilizarVeiculo'       => ['pages' => ['frotas'], 'gateGet' => false],
    'veiculoTipos'           => ['pages' => ['frotas'], 'gateGet' => false],
    'clientes'               => ['pages' => ['crm', 'financeiro'], 'gateGet' => false],
    'oportunidades'          => ['pages' => ['crm'], 'gateGet' => false],
    'funil_estagios'         => ['pages' => ['crm'], 'gateGet' => false],
    'oportunidadeEstagio'    => ['pages' => ['crm'], 'gateGet' => false],
    'oportunidadeConverter'  => ['pages' => ['crm'], 'gateGet' => false],

    // --- Notificações: hoje só existem escopos `compras` e `financeiro`, ambos
    // do fluxo de Aprovação Financeira. Leitura gateada: quem não tem nenhum dos
    // dois módulos não tem por que ler a fila. O handler ainda filtra os escopos
    // pedidos pelos que o usuário realmente possui (módulo diz "se"; o filtro
    // dentro do case diz "quais").
    'notificacoes'           => ['pages' => ['financeiro', 'almoxarifado'], 'gateGet' => true],
];


if (isset($moduloDasRotas[$resource])) {
    $cfgModulo = $moduloDasRotas[$resource];
    $ehLeitura = ($method === 'GET');
    if (!$ehLeitura || !empty($cfgModulo['gateGet'])) {
        exigirAcesso(
            $conn,
            $authUser,
            $cfgModulo['pages'],
            $ehLeitura ? NIVEL_VISUALIZAR : NIVEL_EDITAR
        );
    }
}

// ==============================================
// SWITCH PRINCIPAL
// ==============================================
switch ($resource) {

        // -------------------- LOGIN --------------------
    case 'login':
        if ($method == 'POST') {
            // SEC: busca só pelo login e valida a senha com password_verify.
            // Migração transparente: hashes legados em texto plano são
            // reconvertidos para bcrypt no primeiro login bem-sucedido.
            $stmt = $conn->prepare("SELECT * FROM usuarios WHERE login = :l");
            $stmt->execute(['l' => $input['username'] ?? '']);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            $senhaInformada = (string)($input['password'] ?? '');
            $armazenada = (string)($user['senha'] ?? '');
            $senhaOk = false;
            if ($user && $armazenada !== '') {
                $info = password_get_info($armazenada);
                if (!empty($info['algo'])) {
                    $senhaOk = password_verify($senhaInformada, $armazenada);
                } else {
                    $senhaOk = hash_equals($armazenada, $senhaInformada);
                    if ($senhaOk) {
                        $upd = $conn->prepare("UPDATE usuarios SET senha = ? WHERE id = ?");
                        $upd->execute([password_hash($senhaInformada, PASSWORD_DEFAULT), $user['id']]);
                    }
                }
            }
            if (!$senhaOk) $user = null;
            if ($user) {
                $token = generateToken($user['id'], $user['login']);
                $user['acessos'] = [
                    'rh'          => $user['acesso_colaboradores'] ?? 'visualizar',
                    'dp'          => $user['acesso_dp'] ?? 'nenhum',
                    'patrimonios' => $user['acesso_patrimonios'] ?? 'visualizar',
                    'frotas'      => $user['acesso_frotas'] ?? 'nenhum',
                    'obras_div'   => $user['acesso_obras'] ?? 'visualizar',
                    'admin'       => $user['is_gm'] ? 'editar' : ($user['acesso_gm'] ?? 'nenhum'),
                    'financeiro'  => $user['acesso_financeiro'] ?? 'nenhum',
                    'contratos'   => $user['acesso_contratos'] ?? 'nenhum',
                    'almoxarifado' => $user['acesso_compras'] ?? 'nenhum',
                    'crm'         => $user['acesso_crm'] ?? 'nenhum'
                ];
                // Matriz fina (migração 2026_07_16); ausente = null (frontend usa fallback legado).
                $user['matrizPermissoes'] = decodePermissaoJson($user['matriz_permissoes'] ?? null);
                $user['papeisPermissao'] = decodePermissaoJson($user['papeis_permissao'] ?? null);
                unset($user['senha'], $user['matriz_permissoes'], $user['papeis_permissao']);
                $user['token'] = $token;
                json_response($user);
            } else {
                json_response(["error" => "Credenciais inválidas"], 401);
            }
        }
        break;

        // -------------------- REFRESH TOKEN --------------------
        // Aceita um token (mesmo expirado dentro da janela de 30 dias) e emite outro.
        // Token aqui é base64(JSON) — não é assinado; a "prova" é o user_id ainda existir.
    case 'refresh':
        if ($method == 'POST') {
            $headers = function_exists('getallheaders') ? getallheaders() : [];
            $authHeader = $headers['Authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
            $oldToken = trim(str_replace('Bearer ', '', $authHeader));
            if (!$oldToken && !empty($input['token'])) $oldToken = $input['token'];
            if (!$oldToken) json_response(["error" => "Token ausente"], 401);

            // SEC: exige assinatura válida (expiração é tolerada dentro da janela).
            $payload = validateToken($oldToken, true);
            if (!$payload || empty($payload['user_id'])) {
                json_response(["error" => "Token inválido"], 401);
            }
            // Grace period: 30 dias após exp; depois disso precisa relogar.
            $exp = isset($payload['exp']) ? (int)$payload['exp'] : 0;
            if ($exp > 0 && (time() - $exp) > (30 * 24 * 60 * 60)) {
                json_response(["error" => "Token muito antigo, faça login novamente"], 401);
            }

            $stmt = $conn->prepare("SELECT id, login FROM usuarios WHERE id = :id");
            $stmt->execute(['id' => $payload['user_id']]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$user) json_response(["error" => "Usuário não encontrado"], 401);

            $newToken = generateToken($user['id'], $user['login']);
            json_response(["token" => $newToken]);
        }
        break;



    // -------------------- COLABORADORES (JSON + normalização) --------------------
    case 'colaboradores':
        // Campos que devem ser armazenados como JSON no banco
        $jsonFields = ['ferias', 'integracoes', 'responsabilidades', 'mobilizacao_pendente'];
    
        // Whitelist de colunas aceitas no INSERT/UPDATE (inclui status_especial)
        $camposPermitidos = [
            'matricula', 'nome', 'cpf', 'rg', 'orgaoEmissorRG', 'ufEmissorRG',
            'dataEmissaoRG', 'dataEmissaoCPF', 'pis', 'dataEmissaoPIS',
            'dataNascimento', 'cidade', 'nacionalidade', 'etnia', 'genero',
            'estadoCivil', 'nomeConjuge', 'nomePai', 'nomeMae',
            'endereco', 'cep', 'funcao', 'dataAdmissao', 'salario', 'formaSalario',
            'banco', 'agencia', 'numero_conta', 'tipo_conta', 'numero_banco',
            'chave_pix', 'tipo_chave_pix',
            'obraAtualId', 'ativo', 'data_inativacao', 'motivo_inativacao', 'data_rescisao',
            'ferias', 'integracoes', 'responsabilidades', 'mobilizacao_pendente', 'status_especial'
        ];

        // Georreferenciamento (migração 2026_07_26_logistica_georreferenciada_mysql).
        // Só entram na whitelist se as colunas existirem: mantém o endpoint
        // funcional em bancos onde a migração ainda não foi aplicada.
        $colabCols = $conn->query("SHOW COLUMNS FROM colaboradores")->fetchAll(PDO::FETCH_COLUMN);
        $temGeoColab = in_array('latitude', $colabCols) && in_array('longitude', $colabCols);
        if (in_array('uf', $colabCols)) $camposPermitidos[] = 'uf';
        if ($temGeoColab) {
            $camposPermitidos[] = 'latitude';
            $camposPermitidos[] = 'longitude';
        }

        // Mapeia camelCase do frontend → snake_case do banco
        $mapFrontToDb = [
            'orgaoEmissorRg'    => 'orgaoEmissorRG',
            'ufEmissorRg'       => 'ufEmissorRG',
            'dataEmissaoRg'     => 'dataEmissaoRG',
            'dataEmissaoCpf'    => 'dataEmissaoCPF',
            'dataEmissaoPis'    => 'dataEmissaoPIS',
            'obraAtualId'       => 'obraAtualId',
            'dataInativacao'    => 'data_inativacao',
            'motivoInativacao'  => 'motivo_inativacao',
            'dataRescisao'      => 'data_rescisao',
            'mobilizacaoPendente' => 'mobilizacao_pendente',
            'statusEspecial'    => 'status_especial'
        ];
    
        // Helper: carrega o histórico do colaborador como EVENTO TIPADO.
        //
        // O frontend recebe os campos estruturados (tipo, obra de origem/destino,
        // status de origem/destino, data efetiva, autor) e não precisa mais
        // interpretar a prosa de volta com regex — que era como ele descobria,
        // mal, para onde o colaborador tinha ido. `descricao` continua sendo
        // montada aqui para exportações e clientes antigos, mas deixou de ser
        // a fonte de verdade.
        $loadHistorico = function($colabId) use ($conn) {
            $tipado = temEventosTipados($conn);

            // Sem a migração aplicada, todo evento de movimentação é lido como
            // mobilização (comportamento anterior) e os campos novos vêm nulos.
            $colTipo    = $tipado ? 'm.tipo'           : "'mobilizacao'";
            $colStatusO = $tipado ? 'm.status_origem'  : 'NULL';
            $colStatusD = $tipado ? 'm.status_destino' : 'NULL';
            $colObs     = $tipado ? 'm.observacao'     : 'NULL';
            $colData    = $tipado ? 'COALESCE(m.data_programada, m.data_movimentacao)' : 'm.data_movimentacao';
            $colReg     = $tipado ? 'COALESCE(m.registrado_em, m.data_movimentacao)'   : 'm.data_movimentacao';

            // Rótulo legível do status, para compor `descricao`.
            $rotulo = "CASE %s
                         WHEN 'ferias'        THEN 'Férias'
                         WHEN 'folga'         THEN 'Folga'
                         WHEN 'afastamento'   THEN 'Afastamento'
                         WHEN 'sem_alocacao'  THEN 'Sem Alocação'
                         WHEN 'indeterminado' THEN 'Saiu da obra'
                         ELSE NULL
                       END";
            $rotuloO = sprintf($rotulo, $colStatusO);
            $rotuloD = sprintf($rotulo, $colStatusD);

            // Os ramos derivados de colunas de `colaboradores` (cadastro,
            // rescisão, inativação) continuam existindo para o histórico
            // anterior ao log de eventos. Os de inativação são suprimidos assim
            // que existe evento real equivalente, senão o mesmo fato apareceria
            // duas vezes — uma sem autor, outra com.
            $guardaInativacao = $tipado
                ? "AND NOT EXISTS (SELECT 1 FROM movimentacoes mm
                                    WHERE mm.colaborador_id = c.id
                                      AND mm.tipo IN ('inativacao','reativacao'))"
                : '';

            $sql = "
                SELECT
                    CONCAT('mov_', m.id)      AS id,
                    $colTipo                  AS tipo,
                    m.obra_origem_id          AS obraOrigemId,
                    o_orig.nome               AS obraOrigemNome,
                    m.obra_destino_id         AS obraDestinoId,
                    o_dest.nome               AS obraDestinoNome,
                    $colStatusO               AS statusOrigem,
                    $colStatusD               AS statusDestino,
                    $colObs                   AS observacao,
                    $colData                  AS data,
                    $colReg                   AS registradoEm,
                    COALESCE(u.login, 'Sistema') AS usuario,
                    CONCAT(
                        CASE WHEN m.obra_destino_id IS NOT NULL THEN 'Mobilizado de ' ELSE 'Status alterado de ' END,
                        COALESCE(o_orig.nome, $rotuloO, 'Sem Alocação'),
                        ' para ',
                        COALESCE(o_dest.nome, $rotuloD, 'Sem Alocação'),
                        ' em ', DATE_FORMAT($colData, '%d/%m/%Y')
                    ) AS descricao
                FROM movimentacoes m
                LEFT JOIN obras o_orig ON m.obra_origem_id = o_orig.id
                LEFT JOIN obras o_dest ON m.obra_destino_id = o_dest.id
                LEFT JOIN usuarios u   ON m.usuario_id = u.id
                WHERE m.colaborador_id = ?
                  " . ($tipado ? "AND m.tipo IN ('mobilizacao','status')" : '') . "

                UNION ALL

                SELECT CONCAT('cad_', c.id), 'outro',
                       NULL, NULL, NULL, NULL, NULL, NULL, NULL,
                       c.data_registo, c.data_registo, 'Sistema',
                       'Colaborador cadastrado'
                FROM colaboradores c
                WHERE c.id = ?

                UNION ALL

                SELECT CONCAT('res_', c.id), 'inativacao',
                       NULL, NULL, NULL, NULL, NULL, NULL, 'Rescisão',
                       c.data_rescisao, c.data_rescisao, 'Sistema',
                       CONCAT('Rescisão em ', DATE_FORMAT(c.data_rescisao, '%d/%m/%Y'))
                FROM colaboradores c
                WHERE c.id = ? AND c.data_rescisao IS NOT NULL
                  AND c.motivo_inativacao = 'rescisao' $guardaInativacao

                UNION ALL

                SELECT CONCAT('inac_', c.id), 'inativacao',
                       NULL, NULL, NULL, NULL, NULL, NULL, 'Outro motivo',
                       c.data_inativacao, c.data_inativacao, 'Sistema',
                       CONCAT('Inativado em ', DATE_FORMAT(c.data_inativacao, '%d/%m/%Y'))
                FROM colaboradores c
                WHERE c.id = ? AND c.data_inativacao IS NOT NULL AND c.ativo = 0
                  AND (c.motivo_inativacao IS NULL OR c.motivo_inativacao != 'rescisao')
                  $guardaInativacao
            ";

            if ($tipado) {
                // Eventos que não são de alocação (inativação, reativação,
                // programação, cancelamento) vivem no mesmo log.
                $sql .= "
                UNION ALL

                SELECT CONCAT('evt_', m.id), m.tipo,
                       NULL, NULL, NULL, NULL, NULL, NULL, m.observacao,
                       COALESCE(m.data_programada, m.data_movimentacao),
                       COALESCE(m.registrado_em, m.data_movimentacao),
                       COALESCE(u.login, 'Sistema'),
                       COALESCE(m.observacao, 'Evento registrado')
                FROM movimentacoes m
                LEFT JOIN usuarios u ON m.usuario_id = u.id
                WHERE m.colaborador_id = ?
                  AND m.tipo IN ('inativacao','reativacao','outro')
                ";
            }

            // Desempate por id: sem ele, eventos com a mesma data efetiva saem
            // em ordem arbitrária e a reconstrução de períodos embaralha.
            $sql .= " ORDER BY data DESC, id DESC";

            $params = $tipado
                ? [$colabId, $colabId, $colabId, $colabId, $colabId]
                : [$colabId, $colabId, $colabId, $colabId];

            $stmt = $conn->prepare($sql);
            $stmt->execute($params);

            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$r) {
                if (isset($r['obraOrigemId']))  $r['obraOrigemId']  = (string)$r['obraOrigemId'];
                if (isset($r['obraDestinoId'])) $r['obraDestinoId'] = (string)$r['obraDestinoId'];
            }
            return $rows;
        };
    
        // Helper: prepara linha vinda do banco para o frontend
        $prepareRow = function($row) use ($jsonFields) {
            if (!$row) return $row;
            foreach ($jsonFields as $f) {
                if (array_key_exists($f, $row)) {
                    $val = $row[$f];
                    if (is_string($val) && $val !== '') {
                        $decoded = json_decode($val, true);
                        $row[$f] = ($decoded === null && json_last_error() !== JSON_ERROR_NONE) ? null : $decoded;
                    } elseif ($val === null || $val === '') {
                        if (in_array($f, ['ferias','responsabilidades'])) {
                            $row[$f] = [];
                        } else {
                            $row[$f] = null;
                        }
                    }
                }
            }
            // Normaliza booleano
            if (isset($row['ativo'])) {
                $row['ativo'] = ((int)$row['ativo']) === 1;
            }
            // Renomeia mobilizacao_pendente → mobilizacaoPendente
            if (array_key_exists('mobilizacao_pendente', $row)) {
                $row['mobilizacaoPendente'] = $row['mobilizacao_pendente'];
                unset($row['mobilizacao_pendente']);
            }
            // Renomeia status_especial → statusEspecial
            if (array_key_exists('status_especial', $row)) {
                $row['statusEspecial'] = $row['status_especial'];
                unset($row['status_especial']);
            }
            // Converte IDs para string
            if (isset($row['id'])) $row['id'] = (string)$row['id'];
            if (isset($row['obra_atual_id'])) $row['obraAtualId'] = $row['obra_atual_id'] ? (string)$row['obra_atual_id'] : null;
            unset($row['obra_atual_id']);
            return $row;
        };
    
        // Helper: normaliza payload do frontend para colunas do banco (ignora historico)
        $normalizePayload = function($data) use ($mapFrontToDb, $camposPermitidos, $jsonFields) {
            $out = [];
            foreach ($data as $k => $v) {
                if ($k === 'historico') continue;
                $col = isset($mapFrontToDb[$k]) ? $mapFrontToDb[$k] : $k;
                if (!in_array($col, $camposPermitidos, true)) continue;
                if ($col === 'mobilizacao_pendente') {
                    // "Sem mobilização agendada" precisa virar NULL de verdade.
                    // `json_encode($v ?? [])` gravava a string "[]", que não é
                    // pega por `WHERE mobilizacao_pendente IS NULL` e obriga
                    // todo leitor a tratar um array vazio como se fosse objeto.
                    $out[$col] = ($v === null || $v === '' || $v === [])
                        ? null
                        : json_encode($v, JSON_UNESCAPED_UNICODE);
                } elseif (in_array($col, $jsonFields, true)) {
                    $out[$col] = json_encode($v ?? [], JSON_UNESCAPED_UNICODE);
                } elseif (in_array($col, ['dataNascimento', 'dataEmissaoRG', 'dataEmissaoCPF', 'dataEmissaoPIS', 'dataAdmissao', 'data_inativacao', 'data_rescisao'], true)) {
                    $out[$col] = ($v === '' || $v === null) ? null : $v;
                } elseif ($col === 'ativo') {
                    $out[$col] = ($v === true || $v === 1 || $v === '1' || $v === 'true') ? 1 : 0;
                } elseif ($col === 'latitude' || $col === 'longitude') {
                    // String vazia precisa virar NULL: (float)"" = 0 jogaria o
                    // colaborador para o Golfo da Guiné em vez de deixá-lo sem posição.
                    $out[$col] = ($v === '' || $v === null) ? null : (float)$v;
                } elseif ($col === 'uf') {
                    $out[$col] = !empty($v) ? strtoupper(substr($v, 0, 2)) : null;
                } else {
                    $out[$col] = $v;
                }
            }
            return $out;
        };
    
        try {
            if ($method === 'GET') {
                if ($id) {
                    $stmt = $conn->prepare("SELECT * FROM colaboradores WHERE id = ?");
                    $stmt->execute([$id]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($row) {
                        $row = $prepareRow($row);
                        $stmtDocs = $conn->prepare("SELECT id, nome_documento AS nome, data_vencimento AS dataVencimento, status_aprovacao, obrigatorio, ferias_id AS feriasId FROM vencimentos WHERE colaborador_id = ?");
                        $stmtDocs->execute([$row['id']]);
                        $row['documentos'] = $stmtDocs->fetchAll(PDO::FETCH_ASSOC);
                        $row['historico'] = $loadHistorico($row['id']);
                        json_response($row);
                    } else {
                        json_response(["error" => "Colaborador não encontrado"], 404);
                    }
                } else {
                    $stmt = $conn->query("SELECT * FROM colaboradores ORDER BY nome");
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    $result = [];
                    foreach ($rows as $row) {
                        $row = $prepareRow($row);
                        $stmtDocs = $conn->prepare("SELECT id, nome_documento AS nome, data_vencimento AS dataVencimento, status_aprovacao, obrigatorio, ferias_id AS feriasId FROM vencimentos WHERE colaborador_id = ?");
                        $stmtDocs->execute([$row['id']]);
                        $row['documentos'] = $stmtDocs->fetchAll(PDO::FETCH_ASSOC);
                        $row['historico'] = $loadHistorico($row['id']);
                        $result[] = $row;
                    }
                    json_response($result);
                }
            }
            elseif ($method === 'POST') {
                $data = $normalizePayload($input);
                if (empty($data)) {
                    json_response(["error" => "Payload vazio"], 400);
                    break;
                }
    
                // --- SANITIZA obraAtualId e status_especial ---
                if (array_key_exists('obraAtualId', $data)) {
                    $sanitized = sanitizeObraAtualId($data['obraAtualId']);
                    $data['obraAtualId'] = $sanitized['obraAtualId'];
                    if ($sanitized['status_especial'] !== null) {
                        $data['status_especial'] = $sanitized['status_especial'];
                    }
                    // Se foi definido status_especial, remove possível valor conflitante de obraAtualId (já null)
                    if (isset($data['status_especial'])) {
                        $data['obraAtualId'] = null;
                    }
                }
    
                $cols = array_keys($data);
                $place = array_map(function($c) { return ":$c"; }, $cols);
                $sql = "INSERT INTO colaboradores (" . implode(',', $cols) . ") VALUES (" . implode(',', $place) . ")";
                $stmt = $conn->prepare($sql);
                foreach ($data as $k => $v) $stmt->bindValue(":$k", $v);
                $stmt->execute();
                $newId = $conn->lastInsertId();
    
                // Sincroniza documentos
                if (isset($input['documentos']) && is_array($input['documentos'])) {
                    $stmtDel = $conn->prepare("DELETE FROM vencimentos WHERE colaborador_id = ?");
                    $stmtDel->execute([$newId]);
                    $stmtIns = $conn->prepare("INSERT INTO vencimentos (colaborador_id, nome_documento, data_vencimento, status_aprovacao, obrigatorio, ferias_id) VALUES (?, ?, ?, ?, ?, ?)");
                    foreach ($input['documentos'] as $doc) {
                        $dataVenc = !empty($doc['dataVencimento']) ? $doc['dataVencimento'] : null;
                        $statusAprov = $doc['status_aprovacao'] ?? 'pendente';
                        $obrigatorio = isset($doc['obrigatorio']) ? (int)$doc['obrigatorio'] : 1;
                        $feriasId = $doc['feriasId'] ?? null;
                        $stmtIns->execute([$newId, $doc['nome'], $dataVenc, $statusAprov, $obrigatorio, $feriasId]);
                    }
                }

                $stmt = $conn->prepare("SELECT * FROM colaboradores WHERE id = ?");
                $stmt->execute([$newId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $row = $prepareRow($row);
                    $stmtDocs = $conn->prepare("SELECT id, nome_documento AS nome, data_vencimento AS dataVencimento, status_aprovacao, obrigatorio, ferias_id AS feriasId FROM vencimentos WHERE colaborador_id = ?");
                    $stmtDocs->execute([$row['id']]);
                    $row['documentos'] = $stmtDocs->fetchAll(PDO::FETCH_ASSOC);
                    $row['historico'] = $loadHistorico($row['id']);
                    logAudit($conn, $authUser ?? null, 'colaboradores', $row['id'], 'insert', null, ['nome' => $row['nome'] ?? null]);
                    json_response($row, 201);
                } else {
                    json_response(["error" => "Erro ao recuperar colaborador"], 500);
                }
            }
            elseif ($method === 'PUT') {
                if (!$id) {
                    json_response(["error" => "ID obrigatório"], 400);
                    break;
                }
    
                // Estado anterior: base para a sanitização e para detectar as
                // transições que viram evento de histórico.
                $stmtCurr = $conn->prepare("SELECT obraAtualId, status_especial, ativo, data_inativacao, motivo_inativacao, data_rescisao FROM colaboradores WHERE id = ?");
                $stmtCurr->execute([$id]);
                $antes = $stmtCurr->fetch(PDO::FETCH_ASSOC) ?: [];
                $currentStatus = $antes['status_especial'] ?? null;

                $data = $normalizePayload($input);
                if (empty($data)) {
                    json_response(["error" => "Payload vazio"], 400);
                    break;
                }

                // --- SANITIZA obraAtualId e ajusta status_especial ---
                // O front pode enviar `status_especial` explicitamente nulo para
                // dizer "tire este colaborador de férias e ponha na obra". A
                // condição precisa ser `array_key_exists` e não `!== null`: com
                // `!== null`, o status anterior era reinjetado por cima do nulo
                // explícito e o bloco seguinte forçava obraAtualId de volta a
                // NULL — o UPDATE virava no-op e a resposta saía 200, de modo
                // que o front exibia o colaborador na obra e o banco o mantinha
                // de férias até o próximo reload.
                if (array_key_exists('obraAtualId', $data)) {
                    $statusVeioNoPayload = array_key_exists('status_especial', $data);
                    $sanitized = sanitizeObraAtualId($data['obraAtualId'], $currentStatus ?: null);
                    $data['obraAtualId'] = $sanitized['obraAtualId'];

                    if ($statusVeioNoPayload) {
                        // O front foi explícito: sua palavra vale, inclusive o nulo.
                        if (!empty($data['status_especial'])) $data['obraAtualId'] = null;
                    } elseif ($data['obraAtualId'] !== null) {
                        // Alocar numa obra encerra qualquer status especial —
                        // são mutuamente exclusivos. Preservar o status aqui era
                        // a segunda porta para o mesmo reverte-em-silêncio.
                        $data['status_especial'] = null;
                    } elseif ($sanitized['status_especial'] !== null) {
                        // Sem obra e sem menção ao status: preserva o atual.
                        $data['status_especial'] = $sanitized['status_especial'];
                    }
                }

                $sets = array_map(function($c) { return "$c = :$c"; }, array_keys($data));
                $sql = "UPDATE colaboradores SET " . implode(',', $sets) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                foreach ($data as $k => $v) $stmt->bindValue(":$k", $v);
                $stmt->bindValue(':id', $id);
                $stmt->execute();

                // --- Eventos de histórico das transições de vínculo ---
                // Registrados pelo SERVIDOR, não pelo cliente: antes, o front
                // montava estas entradas no array `historico` e as enviava no
                // PUT, mas `historico` não é coluna de `colaboradores` e o
                // $normalizePayload as descarta — inativação, reativação,
                // programação e cancelamento sumiam no primeiro reload, junto
                // com a autoria. Aqui a gravação não depende de o cliente
                // lembrar de mandar.
                $hojeIso    = date('Y-m-d');
                $ativoAntes = isset($antes['ativo']) ? (int)$antes['ativo'] : null;
                $ativoDepois = array_key_exists('ativo', $data) ? (int)$data['ativo'] : $ativoAntes;
                $inatAntes  = $antes['data_inativacao'] ?? null;
                $inatDepois = array_key_exists('data_inativacao', $data) ? $data['data_inativacao'] : $inatAntes;
                $usuarioEvt = $authUser['user_id'] ?? null;

                if ($ativoAntes === 1 && $ativoDepois === 0) {
                    $motivo    = $data['motivo_inativacao'] ?? ($antes['motivo_inativacao'] ?? null);
                    $rescisao  = $data['data_rescisao'] ?? ($antes['data_rescisao'] ?? null);
                    $descMotivo = $motivo === 'rescisao' ? 'Rescisão' : 'Outro motivo';
                    registrarEventoColaborador($conn, [
                        'colaborador_id' => $id,
                        'tipo'           => 'inativacao',
                        'data_efetiva'   => $inatDepois ?: $hojeIso,
                        'usuario_id'     => $usuarioEvt,
                        'observacao'     => $descMotivo . ($rescisao ? " — data da rescisão: $rescisao" : ''),
                    ]);
                } elseif ($ativoAntes === 0 && $ativoDepois === 1) {
                    registrarEventoColaborador($conn, [
                        'colaborador_id' => $id,
                        'tipo'           => 'reativacao',
                        'data_efetiva'   => $hojeIso,
                        'usuario_id'     => $usuarioEvt,
                        'observacao'     => 'Colaborador reativado',
                    ]);
                } elseif ($ativoDepois === 1 && $inatAntes !== $inatDepois) {
                    // Ainda ativo: é a programação da inativação sendo criada,
                    // alterada ou cancelada.
                    registrarEventoColaborador($conn, [
                        'colaborador_id' => $id,
                        'tipo'           => 'outro',
                        'data_efetiva'   => $hojeIso,
                        'usuario_id'     => $usuarioEvt,
                        'observacao'     => $inatDepois
                            ? "Inativação programada para $inatDepois"
                            : 'Inativação programada cancelada',
                    ]);
                }

                // Sincroniza documentos
                if (isset($input['documentos']) && is_array($input['documentos'])) {
                    $stmtDel = $conn->prepare("DELETE FROM vencimentos WHERE colaborador_id = ?");
                    $stmtDel->execute([$id]);
                    $stmtIns = $conn->prepare("INSERT INTO vencimentos (colaborador_id, nome_documento, data_vencimento, status_aprovacao, obrigatorio, ferias_id) VALUES (?, ?, ?, ?, ?, ?)");
                    foreach ($input['documentos'] as $doc) {
                        $dataVenc = !empty($doc['dataVencimento']) ? $doc['dataVencimento'] : null;
                        $statusAprov = $doc['status_aprovacao'] ?? 'pendente';
                        $obrigatorio = isset($doc['obrigatorio']) ? (int)$doc['obrigatorio'] : 1;
                        $feriasId = $doc['feriasId'] ?? null;
                        $stmtIns->execute([$id, $doc['nome'], $dataVenc, $statusAprov, $obrigatorio, $feriasId]);
                    }
                }
    
                $stmt = $conn->prepare("SELECT * FROM colaboradores WHERE id = ?");
                $stmt->execute([$id]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $row = $prepareRow($row);
                    $stmtDocs = $conn->prepare("SELECT id, nome_documento AS nome, data_vencimento AS dataVencimento, status_aprovacao, obrigatorio, ferias_id AS feriasId FROM vencimentos WHERE colaborador_id = ?");
                    $stmtDocs->execute([$row['id']]);
                    $row['documentos'] = $stmtDocs->fetchAll(PDO::FETCH_ASSOC);
                    $row['historico'] = $loadHistorico($row['id']);
                    logAudit($conn, $authUser ?? null, 'colaboradores', $id, 'update', null, $data ?? null);
                    json_response($row);
                } else {
                    json_response(["error" => "Colaborador não encontrado após atualização"], 404);
                }
            }
            elseif ($method === 'DELETE') {
                if (!$id) {
                    json_response(["error" => "ID obrigatório"], 400);
                    break;
                }
                $stmt = $conn->prepare("DELETE FROM colaboradores WHERE id = ?");
                $stmt->execute([$id]);
                logAudit($conn, $authUser ?? null, 'colaboradores', $id, 'delete');
                json_response(["success" => true]);
            }
            else {
                json_response(["error" => "Método não permitido"], 405);
            }
        } catch (PDOException $e) {
            json_response(["error" => "Erro no banco de dados: " . err_detail($e)], 500);
        } catch (Exception $e) {
            json_response(["error" => "Erro interno: " . err_detail($e)], 500);
        }
        break;

    // -------------------- DOCUMENTOS DE COLABORADORES --------------------
    case 'documentoColaborador':
        if ($method === 'POST') {
            $colabId    = $input['colaborador_id'] ?? null;
            $docId      = $input['documento_id']   ?? null;
            $nome       = trim($input['nome'] ?? '');
            $venc       = !empty($input['dataVencimento']) ? $input['dataVencimento'] : null;
            $obrig      = !empty($input['obrigatorio']) ? 1 : 0;
            $feriasId   = $input['feriasId'] ?? null;

            if (!$colabId || $nome === '') {
                json_response(['error' => 'colaborador_id e nome são obrigatórios'], 400);
                break;
            }

            try {
                if ($docId) {
                    $stmt = $conn->prepare("
                        UPDATE vencimentos
                        SET nome_documento = :nome, data_vencimento = :venc, obrigatorio = :ob, ferias_id = :fid
                        WHERE id = :id AND colaborador_id = :cid
                    ");
                    $stmt->execute([
                        ':nome' => $nome, ':venc' => $venc, ':ob' => $obrig,
                        ':fid' => $feriasId, ':id' => $docId, ':cid' => $colabId,
                    ]);
                    json_response(['success' => true, 'id' => $docId]);
                } else {
                    $stmt = $conn->prepare("
                        INSERT INTO vencimentos
                            (colaborador_id, nome_documento, data_vencimento, obrigatorio, ferias_id, status_aprovacao)
                        VALUES (:cid, :nome, :venc, :ob, :fid, 'pendente')
                    ");
                    $stmt->execute([
                        ':cid' => $colabId, ':nome' => $nome, ':venc' => $venc,
                        ':ob' => $obrig, ':fid' => $feriasId,
                    ]);
                    json_response(['success' => true, 'id' => $conn->lastInsertId()]);
                }
            } catch (PDOException $e) {
                json_response(['error' => err_detail($e)], 500);
            }
            break;
        }

        if ($method === 'DELETE') {
            $colabId = $_GET['colaborador_id'] ?? null;
            $docId   = $_GET['documento_id']   ?? null;
            if (!$colabId || !$docId) {
                json_response(['error' => 'Parâmetros obrigatórios ausentes'], 400);
                break;
            }
            try {
                $stmt = $conn->prepare("DELETE FROM vencimentos WHERE id = :id AND colaborador_id = :cid");
                $stmt->execute([':id' => $docId, ':cid' => $colabId]);
                json_response(['success' => true]);
            } catch (PDOException $e) {
                json_response(['error' => err_detail($e)], 500);
            }
            break;
        }

        json_response(['error' => 'Método não permitido'], 405);
        break;

    // -------------------- OBRAS --------------------
    case 'obras':
        $prepareRowObra = function($o) {
            $o['id'] = (string)$o['id'];
            $o['ativa'] = (bool)$o['ativa'];
            $o['requerIntegracao'] = (bool)($o['requerIntegracao'] ?? $o['requer_integracao'] ?? false);
            foreach (['valorContrato','valorAntecipacao','diasAteEmissaoNf','prazoPagamentoDias',
                      'percentualMaterial','aliquotaIss','aliquotaInss','aliquotaCbs','aliquotaIbs'] as $k) {
                if (array_key_exists($k, $o) && $o[$k] !== null) $o[$k] = (float)$o[$k];
            }
            foreach (['diasCorteBms','diasFixosPagamento'] as $k) {
                if (array_key_exists($k, $o) && is_string($o[$k]) && $o[$k] !== '') {
                    $decoded = json_decode($o[$k], true);
                    $o[$k] = is_array($decoded) ? $decoded : null;
                }
            }
            return $o;
        };

        $obraCols      = $conn->query("SHOW COLUMNS FROM obras")->fetchAll(PDO::FETCH_COLUMN);
        $temFinanceiro = in_array('valor_contrato', $obraCols);
        $temCodigo     = in_array('codigo', $obraCols);
        $temClienteId  = in_array('cliente_id', $obraCols);
        // Georreferenciamento (migração 2026_07_26_logistica_georreferenciada_mysql).
        $temGeo        = in_array('latitude', $obraCols) && in_array('longitude', $obraCols)
                         && in_array('cidade', $obraCols) && in_array('uf', $obraCols);

        if ($method == 'GET') {
            $sel = "SELECT o.id, o.nome, o.cliente, o.ativa,
                       o.requer_integracao  AS requerIntegracao,
                       o.info_integracao    AS integracaoInfo,
                       o.data_mobilizacao   AS dataMobilizacao,
                       o.data_desmobilizacao AS dataDesmobilizacao";

            if ($temCodigo)    $sel .= ", o.codigo";
            if ($temClienteId) $sel .= ", o.cliente_id AS clienteId, c.nome AS cliente_nome";
            if ($temFinanceiro) $sel .= ",
                       o.pedido_contrato        AS pedidoContrato,
                       o.local,
                       o.centro_custo_totvs     AS centroCustoTotvs,
                       o.flowcast_id            AS flowcastId,
                       o.cnpj,
                       o.prazo_padrao_pagamento AS prazoPadraoPagamento,
                       o.dia_fixo_pagamento_1   AS diaFixoPagamento1,
                       o.dia_fixo_pagamento_2   AS diaFixoPagamento2,
                       o.data_corte_medicao_1   AS dataCorteMedicao1,
                       o.data_corte_medicao_2   AS dataCorteMedicao2,
                       o.observacao,
                       o.valor_contrato         AS valorContrato,
                       o.valor_antecipacao      AS valorAntecipacao,
                       o.data_inicio            AS dataInicio,
                       o.data_fim               AS dataFim,
                       o.data_previsao_termino  AS dataPrevisaoTermino,
                       o.regra_medicao          AS regraMedicao,
                       o.dias_corte_bms         AS diasCorteBms,
                       o.dias_ate_emissao_nf    AS diasAteEmissaoNf,
                       o.prazo_pagamento_dias   AS prazoPagamentoDias,
                       o.dias_fixos_pagamento   AS diasFixosPagamento,
                       o.percentual_material    AS percentualMaterial,
                       o.aliquota_iss           AS aliquotaIss,
                       o.aliquota_inss          AS aliquotaInss,
                       o.aliquota_cbs           AS aliquotaCbs,
                       o.aliquota_ibs           AS aliquotaIbs,
                       o.observacoes";
            if ($temGeo) $sel .= ", o.cidade, o.uf, o.latitude, o.longitude";

            $from = " FROM obras o";
            if ($temClienteId) $from .= " LEFT JOIN clientes c ON c.id = o.cliente_id";

            if ($id) {
                try {
                    $stmt = $conn->prepare($sel . $from . " WHERE o.id = ?");
                    $stmt->execute([$id]);
                    $obra = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($obra) {
                        json_response($prepareRowObra($obra));
                    } else {
                        json_response(["error" => "Obra não encontrada"], 404);
                    }
                } catch (PDOException $e) {
                    json_response(["error" => "Erro ao buscar obra: " . err_detail($e)], 500);
                }
            } else {
                try {
                    $stmt = $conn->query($sel . $from . " ORDER BY o.nome");
                    $obras = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    json_response(array_map($prepareRowObra, $obras));
                } catch (PDOException $e) {
                    json_response(["error" => "Erro ao buscar obras: " . err_detail($e)], 500);
                }
            }
        }
        elseif ($method == 'POST') {
            try {
                $baseCols = "nome, cliente, info_integracao, ativa, requer_integracao, data_mobilizacao, data_desmobilizacao";
                $baseVals = ":nome, :cliente, :integracaoInfo, :ativa, :requerIntegracao, :dataMobilizacao, :dataDesmobilizacao";
                $extraCols = "";
                $extraVals = "";

                if ($temCodigo)    { $extraCols .= ", codigo";     $extraVals .= ", :codigo"; }
                if ($temClienteId) { $extraCols .= ", cliente_id"; $extraVals .= ", :clienteId"; }
                if ($temFinanceiro) {
                    $extraCols .= ", pedido_contrato, local, centro_custo_totvs, flowcast_id,
                        cnpj, prazo_padrao_pagamento, dia_fixo_pagamento_1, dia_fixo_pagamento_2,
                        data_corte_medicao_1, data_corte_medicao_2, observacao,
                        valor_contrato, valor_antecipacao, data_inicio, data_fim, data_previsao_termino,
                        regra_medicao, dias_corte_bms, dias_ate_emissao_nf, prazo_pagamento_dias,
                        dias_fixos_pagamento, percentual_material, aliquota_iss, aliquota_inss,
                        aliquota_cbs, aliquota_ibs, observacoes";
                    $extraVals .= ", :pedidoContrato, :local, :centroCustoTotvs, :flowcastId,
                        :cnpj, :prazoPadraoPagamento, :diaFixoPagamento1, :diaFixoPagamento2,
                        :dataCorteMedicao1, :dataCorteMedicao2, :observacao,
                        :valorContrato, :valorAntecipacao, :dataInicio, :dataFim, :dataPrevisaoTermino,
                        :regraMedicao, :diasCorteBms, :diasAteEmissaoNf, :prazoPagamentoDias,
                        :diasFixosPagamento, :percentualMaterial, :aliquotaIss, :aliquotaInss,
                        :aliquotaCbs, :aliquotaIbs, :observacoes";
                }
                if ($temGeo) {
                    $extraCols .= ", cidade, uf, latitude, longitude";
                    $extraVals .= ", :cidade, :uf, :latitude, :longitude";
                }

                $stmt = $conn->prepare("INSERT INTO obras ($baseCols$extraCols) VALUES ($baseVals$extraVals)");
                $params = [
                    'nome'               => $input['nome'] ?? '',
                    'cliente'            => $input['cliente'] ?? '',
                    'integracaoInfo'     => $input['integracaoInfo'] ?? null,
                    'ativa'              => isset($input['ativa']) ? (int)$input['ativa'] : 1,
                    'requerIntegracao'   => isset($input['requerIntegracao']) ? (int)$input['requerIntegracao'] : 0,
                    'dataMobilizacao'    => !empty($input['dataMobilizacao']) ? $input['dataMobilizacao'] : null,
                    'dataDesmobilizacao' => !empty($input['dataDesmobilizacao']) ? $input['dataDesmobilizacao'] : null,
                ];
                if ($temCodigo)    $params['codigo']    = $input['codigo'] ?? null;
                if ($temClienteId) $params['clienteId'] = !empty($input['clienteId']) ? (int)$input['clienteId'] : null;
                if ($temFinanceiro) {
                    $params += [
                        'pedidoContrato'      => $input['pedidoContrato'] ?? null,
                        'local'               => $input['local'] ?? null,
                        'centroCustoTotvs'    => $input['centroCustoTotvs'] ?? null,
                        'flowcastId'          => $input['flowcastId'] ?? null,
                        'cnpj'                => $input['cnpj'] ?? null,
                        'prazoPadraoPagamento'=> $input['prazoPadraoPagamento'] ?? null,
                        'diaFixoPagamento1'   => $input['diaFixoPagamento1'] ?? null,
                        'diaFixoPagamento2'   => $input['diaFixoPagamento2'] ?? null,
                        'dataCorteMedicao1'   => $input['dataCorteMedicao1'] ?? null,
                        'dataCorteMedicao2'   => $input['dataCorteMedicao2'] ?? null,
                        'observacao'          => $input['observacao'] ?? null,
                        'valorContrato'       => isset($input['valorContrato']) ? (float)$input['valorContrato'] : null,
                        'valorAntecipacao'    => isset($input['valorAntecipacao']) ? (float)$input['valorAntecipacao'] : null,
                        'dataInicio'          => !empty($input['dataInicio']) ? $input['dataInicio'] : null,
                        'dataFim'             => !empty($input['dataFim']) ? $input['dataFim'] : null,
                        'dataPrevisaoTermino' => !empty($input['dataPrevisaoTermino']) ? $input['dataPrevisaoTermino'] : null,
                        'regraMedicao'        => $input['regraMedicao'] ?? null,
                        'diasCorteBms'        => isset($input['diasCorteBms']) && is_array($input['diasCorteBms']) ? json_encode($input['diasCorteBms']) : null,
                        'diasAteEmissaoNf'    => isset($input['diasAteEmissaoNf']) ? (int)$input['diasAteEmissaoNf'] : null,
                        'prazoPagamentoDias'  => isset($input['prazoPagamentoDias']) ? (int)$input['prazoPagamentoDias'] : null,
                        'diasFixosPagamento'  => isset($input['diasFixosPagamento']) && is_array($input['diasFixosPagamento']) ? json_encode($input['diasFixosPagamento']) : null,
                        'percentualMaterial'  => isset($input['percentualMaterial']) ? (float)$input['percentualMaterial'] : null,
                        'aliquotaIss'         => isset($input['aliquotaIss']) ? (float)$input['aliquotaIss'] : null,
                        'aliquotaInss'        => isset($input['aliquotaInss']) ? (float)$input['aliquotaInss'] : null,
                        'aliquotaCbs'         => isset($input['aliquotaCbs']) ? (float)$input['aliquotaCbs'] : null,
                        'aliquotaIbs'         => isset($input['aliquotaIbs']) ? (float)$input['aliquotaIbs'] : null,
                        'observacoes'         => $input['observacoes'] ?? null,
                    ];
                }
                if ($temGeo) {
                    $params += [
                        'cidade'    => $input['cidade'] ?? null,
                        'uf'        => !empty($input['uf']) ? strtoupper(substr($input['uf'], 0, 2)) : null,
                        'latitude'  => isset($input['latitude'])  && $input['latitude']  !== '' ? (float)$input['latitude']  : null,
                        'longitude' => isset($input['longitude']) && $input['longitude'] !== '' ? (float)$input['longitude'] : null,
                    ];
                }
                $stmt->execute($params);
                $obraCriadaId = (string)$conn->lastInsertId();
                logAudit($conn, $authUser ?? null, 'obras', $obraCriadaId, 'insert', null, ['nome' => $input['nome'] ?? null]);
                json_response(["id" => $obraCriadaId, "message" => "Obra criada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar obra: " . err_detail($e)], 500);
            }
        }
        elseif ($method == 'PUT' && $id) {
            try {
                $fields = [];
                $params = ['id' => $id];
                $obraMap = [
                    'nome'               => 'nome',
                    'cliente'            => 'cliente',
                    'integracaoInfo'     => 'info_integracao',
                    'ativa'              => 'ativa',
                    'requerIntegracao'   => 'requer_integracao',
                    'dataMobilizacao'    => 'data_mobilizacao',
                    'dataDesmobilizacao' => 'data_desmobilizacao',
                ];
                if ($temCodigo)    $obraMap['codigo']    = 'codigo';
                if ($temClienteId) $obraMap['clienteId'] = 'cliente_id';
                if ($temFinanceiro) {
                    $obraMap += [
                        'pedidoContrato'      => 'pedido_contrato',
                        'local'               => 'local',
                        'centroCustoTotvs'    => 'centro_custo_totvs',
                        'flowcastId'          => 'flowcast_id',
                        'cnpj'                => 'cnpj',
                        'prazoPadraoPagamento'=> 'prazo_padrao_pagamento',
                        'diaFixoPagamento1'   => 'dia_fixo_pagamento_1',
                        'diaFixoPagamento2'   => 'dia_fixo_pagamento_2',
                        'dataCorteMedicao1'   => 'data_corte_medicao_1',
                        'dataCorteMedicao2'   => 'data_corte_medicao_2',
                        'observacao'          => 'observacao',
                        'valorContrato'       => 'valor_contrato',
                        'valorAntecipacao'    => 'valor_antecipacao',
                        'dataInicio'          => 'data_inicio',
                        'dataFim'             => 'data_fim',
                        'dataPrevisaoTermino' => 'data_previsao_termino',
                        'regraMedicao'        => 'regra_medicao',
                        'diasCorteBms'        => 'dias_corte_bms',
                        'diasAteEmissaoNf'    => 'dias_ate_emissao_nf',
                        'prazoPagamentoDias'  => 'prazo_pagamento_dias',
                        'diasFixosPagamento'  => 'dias_fixos_pagamento',
                        'percentualMaterial'  => 'percentual_material',
                        'aliquotaIss'         => 'aliquota_iss',
                        'aliquotaInss'        => 'aliquota_inss',
                        'aliquotaCbs'         => 'aliquota_cbs',
                        'aliquotaIbs'         => 'aliquota_ibs',
                        'observacoes'         => 'observacoes',
                    ];
                }
                if ($temGeo) {
                    $obraMap += [
                        'cidade'    => 'cidade',
                        'uf'        => 'uf',
                        'latitude'  => 'latitude',
                        'longitude' => 'longitude',
                    ];
                }
                $boolFields  = ['ativa', 'requerIntegracao'];
                $dateFields  = ['dataMobilizacao','dataDesmobilizacao','dataInicio','dataFim','dataPrevisaoTermino'];
                $floatFields = ['valorContrato','valorAntecipacao','percentualMaterial','aliquotaIss','aliquotaInss','aliquotaCbs','aliquotaIbs'];
                $intFields   = ['diasAteEmissaoNf','prazoPagamentoDias'];
                $jsonFields  = ['diasCorteBms','diasFixosPagamento'];
                // Coordenadas: string vazia precisa virar NULL, não 0 — (float)"" = 0
                // colocaria a obra no Golfo da Guiné em vez de deixá-la sem posição.
                $coordFields = ['latitude','longitude'];

                foreach ($obraMap as $frontKey => $dbCol) {
                    if (!array_key_exists($frontKey, $input)) continue;
                    $v = $input[$frontKey];
                    if (in_array($frontKey, $boolFields))  $v = (int)$v;
                    if (in_array($frontKey, $dateFields))  $v = !empty($v) ? $v : null;
                    if (in_array($frontKey, $floatFields)) $v = $v !== null ? (float)$v : null;
                    if (in_array($frontKey, $coordFields)) $v = ($v === null || $v === '') ? null : (float)$v;
                    if (in_array($frontKey, $intFields))   $v = $v !== null ? (int)$v : null;
                    if (in_array($frontKey, $jsonFields))  $v = is_array($v) ? json_encode($v) : null;
                    if ($frontKey === 'clienteId') $v = !empty($v) ? (int)$v : null;
                    if ($frontKey === 'uf') $v = !empty($v) ? strtoupper(substr($v, 0, 2)) : null;
                    $fields[] = "$dbCol = :$frontKey";
                    $params[$frontKey] = $v;
                }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }
                $sql = "UPDATE obras SET " . implode(', ', $fields) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                logAudit($conn, $authUser ?? null, 'obras', $id, 'update', null, $input);
                json_response(["message" => "Obra atualizada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar obra: " . err_detail($e)], 500);
            }
        }
        elseif ($method == 'DELETE' && $id) {
            try {
                $stmt = $conn->prepare("DELETE FROM obras WHERE id = ?");
                $stmt->execute([$id]);
                logAudit($conn, $authUser ?? null, 'obras', $id, 'delete');
                json_response(["message" => "Obra removida"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao remover obra: " . err_detail($e)], 500);
            }
        }
        break;

    // -------------------- FUNÇÕES --------------------
    case 'funcoes':
        if ($method == 'GET') {
            try {
                // SELECT * tolera a ausência de delegacao_id antes da migração 2026_07_19.
                $stmt = $conn->query("SELECT * FROM funcoes");
                $funcoes = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($funcoes as $i => $f) {
                    $funcoes[$i] = [
                        'id'          => (string)$f['id'],
                        'nome'        => $f['nome'],
                        'ativa'       => (strtolower(trim($f['status'] ?? '')) === 'ativo'),
                        'nrs'         => !empty($f['nrs_obrigatorias']) ? explode(',', $f['nrs_obrigatorias']) : [],
                        'gestao'      => !empty($f['gestao']) ? $f['gestao'] : null,
                        'delegacaoId' => isset($f['delegacao_id']) && $f['delegacao_id'] !== null ? (string)$f['delegacao_id'] : null,
                    ];
                }
                json_response($funcoes);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar funções: " . err_detail($e)], 500);
            }
            break;
        }
        if ($method == 'POST') {
            try {
                $nome = $input['nome'] ?? '';
                $nrs = isset($input['nrs']) ? (is_array($input['nrs']) ? implode(',', $input['nrs']) : $input['nrs']) : '';
                $gestao = $input['gestao'] ?? null;
                $status = 'ativo';
                $stmt = $conn->prepare("INSERT INTO funcoes (nome, nrs_obrigatorias, status, gestao) VALUES (?, ?, ?, ?)");
                $stmt->execute([$nome, $nrs, $status, $gestao]);
                json_response(['id' => (string)$conn->lastInsertId(), 'message' => 'Função criada']);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar função: " . err_detail($e)], 500);
            }
            break;
        }
        $funcaoId = $id ?? $input['id'] ?? null;
        if ($method == 'PUT' && $funcaoId) {
            try {
                $fields = [];
                $params = [];
                if (isset($input['nome'])) { $fields[] = "nome = ?"; $params[] = $input['nome']; }
                if (isset($input['nrs'])) {
                    $nrsString = is_array($input['nrs']) ? implode(',', $input['nrs']) : $input['nrs'];
                    $fields[] = "nrs_obrigatorias = ?"; $params[] = $nrsString;
                }
                if (isset($input['ativa'])) {
                    $fields[] = "status = ?"; $params[] = filter_var($input['ativa'], FILTER_VALIDATE_BOOLEAN) ? 'ativo' : 'inativo';
                }
                if (array_key_exists('gestao', $input)) {
                    $fields[] = "gestao = ?"; $params[] = $input['gestao'] ?: null;
                }
                if (array_key_exists('delegacaoId', $input)) {
                    $fields[] = "delegacao_id = ?"; $params[] = $input['delegacaoId'] !== null && $input['delegacaoId'] !== '' ? (int)$input['delegacaoId'] : null;
                }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }
                $sql = "UPDATE funcoes SET " . implode(', ', $fields) . " WHERE id = ?";
                $params[] = $funcaoId;
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                json_response(["message" => "Função atualizada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar função: " . err_detail($e)], 500);
            }
            break;
        }
        if ($method == 'DELETE' && $funcaoId) {
            try {
                $stmt = $conn->prepare("DELETE FROM funcoes WHERE id = ?");
                $stmt->execute([$funcaoId]);
                json_response(["message" => "Função removida"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao remover função: " . err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- MOBILIZAR COLABORADOR --------------------
    case 'mobilizar':
        if ($method == 'POST') {
            try {
                $colabId = $input['colabId'] ?? null;
                $obraDestinoId = isset($input['obraDestinoId']) && $input['obraDestinoId'] !== '' ? $input['obraDestinoId'] : null;
                $dataProgramada = $input['dataProgramada'] ?? null;
                $usuarioId = $input['usuarioId'] ?? null;
    
                if (!$colabId) {
                    json_response(["error" => "colabId é obrigatório"], 400);
                    break;
                }

                $stmt = $conn->prepare("SELECT obraAtualId, status_especial FROM colaboradores WHERE id = ?");
                $stmt->execute([$colabId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$row) {
                    json_response(["error" => "Colaborador não encontrado"], 404);
                    break;
                }
                $obraAtual   = $row['obraAtualId'];
                $statusAtual = normalizaStatusColaborador($row['status_especial']);

                // Cancelamento de mobilização agendada: registra o evento e
                // limpa a pendência. Sem isto o cancelamento só existia no
                // estado local do front e sumia no reload.
                if (($input['acao'] ?? null) === 'cancelar') {
                    $conn->prepare("UPDATE colaboradores SET mobilizacao_pendente = NULL WHERE id = ?")
                         ->execute([$colabId]);
                    registrarEventoColaborador($conn, [
                        'colaborador_id' => $colabId,
                        'tipo'           => 'outro',
                        'data_efetiva'   => date('Y-m-d'),
                        'usuario_id'     => $usuarioId,
                        'observacao'     => $input['observacao'] ?? 'Mobilização agendada cancelada',
                    ]);
                    json_response(["message" => "Mobilização cancelada"]);
                    break;
                }

                // 🔧 TRATAMENTO DE STATUS ESPECIAL
                // O destino especial pode chegar de duas formas: no campo
                // `status` (cliente atual) ou embutido em `obraDestinoId` como
                // `__ferias__` (clientes antigos). Antes, `status` era ignorado
                // e o prefixo já vinha removido pelo front, de modo que toda
                // ida para férias/folga/afastamento era gravada como destino
                // NULL — indistinguível de uma desmobilização.
                $statusEspecial = normalizaStatusColaborador($input['status'] ?? null);
                if ($obraDestinoId !== null && preg_match('/^__/', $obraDestinoId)) {
                    $statusEspecial = normalizaStatusColaborador($obraDestinoId);
                    $obraDestinoId = null;
                } elseif ($obraDestinoId !== null && is_numeric($obraDestinoId)) {
                    $obraDestinoId = (int)$obraDestinoId;
                } elseif ($obraDestinoId !== null) {
                    // String não numérica e sem prefixo (ex.: "ferias" vindo do Quadro).
                    $statusEspecial = $statusEspecial ?? normalizaStatusColaborador($obraDestinoId);
                    $obraDestinoId = null;
                }

                // Saída de obra sem status declarado é uma desmobilização.
                if ($obraDestinoId === null && $statusEspecial === null) {
                    $statusEspecial = 'sem_alocacao';
                }

                $dataEfetiva = $dataProgramada ?: date('Y-m-d');

                // Só aplica o estado quando a data já chegou. Antes, o UPDATE
                // rodava incondicionalmente: agendar uma mobilização para o mês
                // que vem movia o colaborador na hora, e só o PUT seguinte do
                // front desfazia — com uma janela em que outros usuários liam o
                // estado errado.
                $jaVenceu = $dataEfetiva <= date('Y-m-d');
                if ($jaVenceu) {
                    $stmtUpd = $conn->prepare("UPDATE colaboradores SET obraAtualId = :obra, status_especial = :status WHERE id = :id");
                    $stmtUpd->execute([
                        ':obra'   => $obraDestinoId,
                        // `sem_alocacao` é vocabulário do log; na coluna
                        // status_especial (ENUM folga/afastamento/ferias) o
                        // equivalente é NULL.
                        ':status' => in_array($statusEspecial, ['folga', 'afastamento', 'ferias'], true)
                                     ? $statusEspecial : null,
                        ':id'     => $colabId
                    ]);
                }

                registrarEventoColaborador($conn, [
                    'colaborador_id'  => $colabId,
                    'tipo'            => $obraDestinoId !== null ? 'mobilizacao' : 'status',
                    'obra_origem_id'  => $obraAtual ?: null,
                    'obra_destino_id' => $obraDestinoId,
                    'status_origem'   => $statusAtual,
                    'status_destino'  => $obraDestinoId !== null ? null : $statusEspecial,
                    'data_efetiva'    => $dataEfetiva,
                    'usuario_id'      => $usuarioId,
                ]);

                json_response([
                    "message"  => "Mobilização salva",
                    "aplicada" => $jaVenceu,
                ]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao mobilizar: " . err_detail($e)], 500);
            }
        }
        break;

    // -------------------- PERÍODOS DE ALOCAÇÃO DO COLABORADOR --------------------
    // Períodos fechados (início → fim) derivados do log de eventos. Fecha o
    // período de cada evento com o início do seguinte, via LEAD(), do mesmo
    // modo que a view `v_veiculo_periodos` já faz para veículos — mas com a
    // data efetiva como eixo, desempate por id e sem descartar os eventos de
    // destino nulo (é o filtro que impede o último período de fechar lá).
    //
    // Fazer isso em SQL, e não no cliente, elimina de uma vez os períodos de
    // "0 dias" com fim anterior ao início (fruto de comparadores instáveis no
    // TS) e a resolução de obra por nome, que confundia obras homônimas.
    //
    // Parâmetros: colaborador_id (opcional), from/to (data efetiva, opcionais).
    case 'mobilizacoesPeriodos':
        if ($method !== 'GET') {
            json_response(["error" => "Método não permitido"], 405);
            break;
        }
        try {
            if (!temEventosTipados($conn)) {
                // Sem a migração não há como distinguir período de obra de
                // período de status: devolve vazio em vez de dado enganoso.
                json_response([]);
                break;
            }

            $where  = ["m.tipo IN ('mobilizacao','status')"];
            $params = [];
            if (!empty($_GET['colaborador_id'])) {
                $where[] = 'm.colaborador_id = ?';
                $params[] = $_GET['colaborador_id'];
            }

            $sqlBase = "
                SELECT
                    m.id,
                    m.colaborador_id,
                    m.tipo,
                    m.obra_destino_id,
                    m.status_destino,
                    m.obra_origem_id,
                    m.usuario_id,
                    COALESCE(m.data_programada, m.data_movimentacao) AS data_inicio,
                    COALESCE(m.registrado_em, m.data_movimentacao)   AS registrado_em,
                    LEAD(COALESCE(m.data_programada, m.data_movimentacao)) OVER (
                        PARTITION BY m.colaborador_id
                        ORDER BY COALESCE(m.data_programada, m.data_movimentacao), m.id
                    ) AS proximo_inicio
                FROM movimentacoes m
                WHERE " . implode(' AND ', $where);

            // O recorte por data é aplicado DEPOIS da janela: filtrar antes
            // truncaria o período anterior ao recorte e o fim calculado sairia
            // errado.
            $filtros = [];
            if (!empty($_GET['from'])) { $filtros[] = 't.data_inicio >= ?'; }
            if (!empty($_GET['to']))   { $filtros[] = 't.data_inicio <= ?'; }

            $sql = "
                SELECT
                    t.id, t.colaborador_id, t.tipo, t.data_inicio, t.registrado_em,
                    t.obra_destino_id, t.obra_origem_id, t.status_destino,
                    o.nome        AS obra_nome,
                    o_orig.nome   AS obra_origem_nome,
                    c.nome        AS colaborador_nome,
                    c.matricula   AS colaborador_matricula,
                    c.funcao      AS colaborador_funcao,
                    u.login       AS usuario_nome,
                    CASE WHEN t.proximo_inicio IS NULL THEN NULL
                         ELSE DATE_SUB(t.proximo_inicio, INTERVAL 1 DAY) END AS data_fim,
                    -- Período imediatamente substituído por outro na mesma data
                    -- (duplicata ou correção): sinalizado para a UI não exibir
                    -- um intervalo invertido de 0 dias.
                    (t.proximo_inicio IS NOT NULL AND t.proximo_inicio <= t.data_inicio) AS substituido,
                    GREATEST(
                        DATEDIFF(
                            COALESCE(DATE_SUB(t.proximo_inicio, INTERVAL 1 DAY), CURDATE()),
                            t.data_inicio
                        ) + 1, 0
                    ) AS dias
                FROM ($sqlBase) t
                LEFT JOIN obras     o      ON o.id      = t.obra_destino_id
                LEFT JOIN obras     o_orig ON o_orig.id = t.obra_origem_id
                LEFT JOIN colaboradores c  ON c.id      = t.colaborador_id
                LEFT JOIN usuarios  u      ON u.id      = t.usuario_id
                " . ($filtros ? 'WHERE ' . implode(' AND ', $filtros) : '') . "
                ORDER BY t.data_inicio DESC, t.id DESC
            ";

            if (!empty($_GET['from'])) $params[] = $_GET['from'];
            if (!empty($_GET['to']))   $params[] = $_GET['to'];

            $stmt = $conn->prepare($sql);
            $stmt->execute($params);

            $out = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $out[] = [
                    'id'                    => (string)$r['id'],
                    'colaborador_id'        => (string)$r['colaborador_id'],
                    'colaborador_nome'      => $r['colaborador_nome'],
                    'colaborador_matricula' => $r['colaborador_matricula'],
                    'colaborador_funcao'    => $r['colaborador_funcao'],
                    // 'obra' alimenta a seção Mobilizações; 'status' descreve
                    // férias/folga/afastamento e NÃO é período de obra.
                    'tipo'                  => $r['obra_destino_id'] !== null ? 'obra' : 'status',
                    'obra_id'               => $r['obra_destino_id'] !== null ? (string)$r['obra_destino_id'] : null,
                    'obra_nome'             => $r['obra_nome'],
                    'from_obra_nome'        => $r['obra_origem_nome'],
                    'status'                => $r['status_destino'],
                    'data_inicio'           => $r['data_inicio'],
                    'data_fim'              => $r['data_fim'],
                    'dias'                  => (int)$r['dias'],
                    'substituido'           => (bool)$r['substituido'],
                    'usuario_nome'          => $r['usuario_nome'] ?: 'Sistema',
                    'registrado_em'         => $r['registrado_em'],
                ];
            }
            json_response($out);
        } catch (PDOException $e) {
            json_response(["error" => "Erro ao buscar períodos: " . err_detail($e)], 500);
        }
        break;

    // -------------------- PERÍODOS DE ALOCAÇÃO DO PATRIMÔNIO --------------------
    // Espelha `mobilizacoesPeriodos` (colaborador): períodos fechados com
    // LEAD() sobre a data efetiva, desempate por id. `tipo` separa período de
    // obra, de status (manutenção/sujo) e de responsabilidade — este último
    // é o que sustenta o reflexo do bem na obra onde o responsável está.
    case 'patrimoniosPeriodos':
        if ($method !== 'GET') {
            json_response(["error" => "Método não permitido"], 405);
            break;
        }
        try {
            if (!temEventosTipadosEm($conn, 'movimentacoes_patrimonios')) {
                json_response([]);
                break;
            }

            $where  = ["mp.tipo IN ('mobilizacao','status','responsavel')"];
            $params = [];
            if (!empty($_GET['patrimonio_id'])) {
                $where[] = 'mp.patrimonio_id = ?';
                $params[] = $_GET['patrimonio_id'];
            }

            $sqlBase = "
                SELECT
                    mp.id, mp.patrimonio_id, mp.tipo, mp.obra_destino_id, mp.obra_origem_id,
                    mp.status_destino, mp.colaborador_id, mp.usuario_id,
                    COALESCE(mp.data_programada, mp.data_movimentacao) AS data_inicio,
                    COALESCE(mp.registrado_em, mp.data_movimentacao)   AS registrado_em,
                    LEAD(COALESCE(mp.data_programada, mp.data_movimentacao)) OVER (
                        PARTITION BY mp.patrimonio_id
                        ORDER BY COALESCE(mp.data_programada, mp.data_movimentacao), mp.id
                    ) AS proximo_inicio
                FROM movimentacoes_patrimonios mp
                WHERE " . implode(' AND ', $where);

            $filtros = [];
            if (!empty($_GET['from'])) $filtros[] = 't.data_inicio >= ?';
            if (!empty($_GET['to']))   $filtros[] = 't.data_inicio <= ?';

            $sql = "
                SELECT
                    t.id, t.patrimonio_id, t.tipo, t.data_inicio, t.registrado_em,
                    t.obra_destino_id, t.obra_origem_id, t.status_destino, t.colaborador_id,
                    o.nome      AS obra_nome,
                    o_orig.nome AS obra_origem_nome,
                    c.nome      AS colaborador_nome,
                    p.codigo    AS patrimonio_codigo,
                    p.nome      AS patrimonio_nome,
                    u.login     AS usuario_nome,
                    CASE WHEN t.proximo_inicio IS NULL THEN NULL
                         ELSE DATE_SUB(t.proximo_inicio, INTERVAL 1 DAY) END AS data_fim,
                    (t.proximo_inicio IS NOT NULL AND t.proximo_inicio <= t.data_inicio) AS substituido,
                    GREATEST(
                        DATEDIFF(
                            COALESCE(DATE_SUB(t.proximo_inicio, INTERVAL 1 DAY), CURDATE()),
                            t.data_inicio
                        ) + 1, 0
                    ) AS dias
                FROM ($sqlBase) t
                LEFT JOIN obras         o      ON o.id      = t.obra_destino_id
                LEFT JOIN obras         o_orig ON o_orig.id = t.obra_origem_id
                LEFT JOIN colaboradores c      ON c.id      = t.colaborador_id
                LEFT JOIN patrimonios   p      ON p.id      = t.patrimonio_id
                LEFT JOIN usuarios      u      ON u.id      = t.usuario_id
                " . ($filtros ? 'WHERE ' . implode(' AND ', $filtros) : '') . "
                ORDER BY t.data_inicio DESC, t.id DESC
            ";

            if (!empty($_GET['from'])) $params[] = $_GET['from'];
            if (!empty($_GET['to']))   $params[] = $_GET['to'];

            $stmt = $conn->prepare($sql);
            $stmt->execute($params);

            $out = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $tipo = $r['tipo'] === 'responsavel'
                    ? 'responsavel'
                    : ($r['obra_destino_id'] !== null ? 'obra' : 'status');
                $out[] = [
                    'id'                => (string)$r['id'],
                    'patrimonio_id'     => (string)$r['patrimonio_id'],
                    'patrimonio_codigo' => $r['patrimonio_codigo'],
                    'patrimonio_nome'   => $r['patrimonio_nome'],
                    'tipo'              => $tipo,
                    'obra_id'           => $r['obra_destino_id'] !== null ? (string)$r['obra_destino_id'] : null,
                    'obra_nome'         => $r['obra_nome'],
                    'from_obra_nome'    => $r['obra_origem_nome'],
                    'status'            => $r['status_destino'],
                    'colaborador_id'    => $r['colaborador_id'] !== null ? (string)$r['colaborador_id'] : null,
                    'colaborador_nome'  => $r['colaborador_nome'],
                    'data_inicio'       => $r['data_inicio'],
                    'data_fim'          => $r['data_fim'],
                    'dias'              => (int)$r['dias'],
                    'substituido'       => (bool)$r['substituido'],
                    'usuario_nome'      => $r['usuario_nome'] ?: 'Sistema',
                    'registrado_em'     => $r['registrado_em'],
                ];
            }
            json_response($out);
        } catch (PDOException $e) {
            json_response(["error" => "Erro ao buscar períodos do patrimônio: " . err_detail($e)], 500);
        }
        break;

    // -------------------- PATRIMÔNIOS --------------------
    case 'patrimonios':
        // Campos que devem ser armazenados como JSON no banco (apenas mobilizacao_pendente)
        $jsonFieldsPat = ['mobilizacao_pendente'];
        
        // Whitelist de colunas aceitas no INSERT/UPDATE (historico NÃO é coluna do banco)
        $camposPermitidosPat = [
            'codigo', 'nome', 'ativo', 'obra_atual_id', 'em_manutencao',
            'riscado', 'quebrado', 'sujo', 'alugado', 'data_inativacao',
            'mobilizacao_pendente', 'responsavel_id'
        ];
        
        // Mapeia camelCase do frontend → snake_case do banco
        $mapFrontToDbPat = [
            'obraAtualId'    => 'obra_atual_id',
            'emManutencao'   => 'em_manutencao',
            'dataInativacao' => 'data_inativacao',
            'mobilizacaoPendente' => 'mobilizacao_pendente',
            'responsavelId'  => 'responsavel_id'
        ];
        
        // Mapeamento inverso para leitura (snake_case → camelCase)
        $mapDbToFrontPat = [
            'obra_atual_id'    => 'obraAtualId',
            'em_manutencao'    => 'emManutencao',
            'data_inativacao'  => 'dataInativacao',
            'mobilizacao_pendente' => 'mobilizacaoPendente',
            'responsavel_id'   => 'responsavelId'
        ];
        
        // Helper: normaliza payload do frontend para colunas do banco (ignora historico)
        $normalizePayloadPat = function($data) use ($mapFrontToDbPat, $camposPermitidosPat, $jsonFieldsPat) {
            $out = [];
            foreach ($data as $k => $v) {
                if ($k === 'historico') continue; // não persiste no banco
                $col = isset($mapFrontToDbPat[$k]) ? $mapFrontToDbPat[$k] : $k;
                if (!in_array($col, $camposPermitidosPat, true)) continue;
                if (in_array($col, $jsonFieldsPat, true)) {
                    $out[$col] = ($v !== null && $v !== '') ? json_encode($v, JSON_UNESCAPED_UNICODE) : null;
                } elseif (in_array($col, ['data_inativacao'])) {
                    $out[$col] = ($v === '' || $v === null) ? null : $v;
                } elseif ($col === 'ativo' || $col === 'em_manutencao' || $col === 'riscado' || $col === 'quebrado' || $col === 'sujo' || $col === 'alugado') {
                    $out[$col] = ($v === true || $v === 1 || $v === '1' || $v === 'true') ? 1 : 0;
                } else {
                    $out[$col] = $v;
                }
            }
            return $out;
        };
        
        // Helper: prepara linha vinda do banco para o frontend (adiciona historico separadamente)
        $prepareRowPat = function($row) use ($mapDbToFrontPat, $jsonFieldsPat) {
            if (!$row) return $row;
            $frontRow = [];
            foreach ($row as $dbKey => $value) {
                $frontKey = isset($mapDbToFrontPat[$dbKey]) ? $mapDbToFrontPat[$dbKey] : $dbKey;
                $frontRow[$frontKey] = $value;
            }
            foreach ($jsonFieldsPat as $field) {
                $dbField = isset($mapFrontToDbPat[$field]) ? $mapFrontToDbPat[$field] : $field;
                $frontField = isset($mapDbToFrontPat[$dbField]) ? $mapDbToFrontPat[$dbField] : $field;
                if (isset($frontRow[$frontField]) && is_string($frontRow[$frontField]) && $frontRow[$frontField] !== '') {
                    $decoded = json_decode($frontRow[$frontField], true);
                    $frontRow[$frontField] = ($decoded === null && json_last_error() !== JSON_ERROR_NONE) ? null : $decoded;
                } elseif (isset($frontRow[$frontField]) && ($frontRow[$frontField] === null || $frontRow[$frontField] === '')) {
                    $frontRow[$frontField] = null;
                }
            }
            if (isset($frontRow['id'])) $frontRow['id'] = (string)$frontRow['id'];
            if (isset($frontRow['obraAtualId']) && $frontRow['obraAtualId'] !== null) $frontRow['obraAtualId'] = (string)$frontRow['obraAtualId'];
            if (isset($frontRow['responsavelId']) && $frontRow['responsavelId'] !== null) $frontRow['responsavelId'] = (string)$frontRow['responsavelId'];
            if (isset($frontRow['ativo'])) $frontRow['ativo'] = (bool)$frontRow['ativo'];
            if (isset($frontRow['emManutencao'])) $frontRow['emManutencao'] = (bool)$frontRow['emManutencao'];
            if (isset($frontRow['riscado'])) $frontRow['riscado'] = (bool)$frontRow['riscado'];
            if (isset($frontRow['quebrado'])) $frontRow['quebrado'] = (bool)$frontRow['quebrado'];
            if (isset($frontRow['sujo'])) $frontRow['sujo'] = (bool)$frontRow['sujo'];
            if (isset($frontRow['alugado'])) $frontRow['alugado'] = (bool)$frontRow['alugado'];
            return $frontRow;
        };
        
        // Helper para carregar histórico de movimentações (tabela movimentacoes_patrimonios)
        // Histórico do patrimônio como EVENTO TIPADO — mesmo contrato usado
        // para colaborador. O frontend recebe obra/status/responsável em
        // campos próprios e deixa de reinterpretar a prosa com regex.
        $loadHistoricoPat = function($patId) use ($conn) {
            $tipado = temEventosTipadosEm($conn, 'movimentacoes_patrimonios');

            $colTipo    = $tipado ? 'mp.tipo'           : "'mobilizacao'";
            $colStatusO = $tipado ? 'mp.status_origem'  : 'NULL';
            $colStatusD = $tipado ? 'mp.status_destino' : 'NULL';
            $colObs     = $tipado ? 'mp.observacao'     : 'NULL';
            $colColab   = $tipado ? 'mp.colaborador_id' : 'NULL';
            $colNomeCol = $tipado ? 'c.nome'            : 'NULL';
            $joinColab  = $tipado ? 'LEFT JOIN colaboradores c ON c.id = mp.colaborador_id' : '';
            $colData    = 'COALESCE(mp.data_programada, mp.data_movimentacao)';
            $colReg     = $tipado ? 'COALESCE(mp.registrado_em, mp.data_movimentacao)' : 'mp.data_movimentacao';

            $rotulo = "CASE %s
                         WHEN 'manutencao'    THEN 'Em Manutenção'
                         WHEN 'sujo'          THEN 'Sujo'
                         WHEN 'sem_alocacao'  THEN 'Sem Alocação'
                         WHEN 'indeterminado' THEN 'Saiu da obra'
                         ELSE NULL
                       END";
            $rotuloO = sprintf($rotulo, $colStatusO);
            $rotuloD = sprintf($rotulo, $colStatusD);

            $stmt = $conn->prepare("
                SELECT
                    CONCAT('mov_', mp.id)     AS id,
                    $colTipo                  AS tipo,
                    mp.obra_origem_id         AS obraOrigemId,
                    o_orig.nome               AS obraOrigemNome,
                    mp.obra_destino_id        AS obraDestinoId,
                    o_dest.nome               AS obraDestinoNome,
                    $colStatusO               AS statusOrigem,
                    $colStatusD               AS statusDestino,
                    $colColab                 AS colaboradorId,
                    $colNomeCol               AS colaboradorNome,
                    $colObs                   AS observacao,
                    $colData                  AS data,
                    $colReg                   AS registradoEm,
                    COALESCE(u.login, 'Sistema') AS usuario,
                    CASE
                      WHEN $colTipo = 'responsavel' THEN
                        CONCAT('Sob responsabilidade de ', COALESCE($colNomeCol, 'colaborador'),
                               ' em ', DATE_FORMAT($colData, '%d/%m/%Y'))
                      ELSE
                        CONCAT(
                          CASE WHEN mp.obra_destino_id IS NOT NULL THEN 'Mobilizado de ' ELSE 'Status alterado de ' END,
                          COALESCE(o_orig.nome, $rotuloO, 'Sem Alocação'),
                          ' para ',
                          COALESCE(o_dest.nome, $rotuloD, 'Sem Alocação'),
                          ' em ', DATE_FORMAT($colData, '%d/%m/%Y')
                        )
                    END AS descricao
                FROM movimentacoes_patrimonios mp
                LEFT JOIN obras o_orig ON mp.obra_origem_id = o_orig.id
                LEFT JOIN obras o_dest ON mp.obra_destino_id = o_dest.id
                LEFT JOIN usuarios u   ON mp.usuario_id = u.id
                $joinColab
                WHERE mp.patrimonio_id = ?
                ORDER BY $colData DESC, mp.id DESC
            ");
            $stmt->execute([$patId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$r) {
                if (isset($r['obraOrigemId']))  $r['obraOrigemId']  = (string)$r['obraOrigemId'];
                if (isset($r['obraDestinoId'])) $r['obraDestinoId'] = (string)$r['obraDestinoId'];
                if (isset($r['colaboradorId'])) $r['colaboradorId'] = (string)$r['colaboradorId'];
            }
            return $rows;
        };
        
        try {
            if ($method === 'GET') {
                if ($id) {
                    $stmt = $conn->prepare("
                        SELECT id, codigo, nome, ativo, obra_atual_id, em_manutencao,
                               riscado, quebrado, sujo, alugado, data_inativacao,
                               mobilizacao_pendente, responsavel_id
                        FROM patrimonios WHERE id = ?
                    ");
                    $stmt->execute([$id]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($row) {
                        $row = $prepareRowPat($row);
                        $row['historico'] = $loadHistoricoPat($row['id']);
                        json_response($row);
                    } else {
                        json_response(["error" => "Patrimônio não encontrado"], 404);
                    }
                } else {
                    $stmt = $conn->query("
                        SELECT id, codigo, nome, ativo, obra_atual_id, em_manutencao,
                               riscado, quebrado, sujo, alugado, data_inativacao,
                               mobilizacao_pendente, responsavel_id
                        FROM patrimonios
                    ");
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    $result = [];
                    foreach ($rows as $row) {
                        $row = $prepareRowPat($row);
                        $row['historico'] = $loadHistoricoPat($row['id']);
                        $result[] = $row;
                    }
                    json_response($result);
                }
            }
            elseif ($method === 'POST') {
                $data = $normalizePayloadPat($input);
                if (empty($data)) {
                    json_response(["error" => "Payload vazio"], 400);
                    break;
                }
                
                $cols = array_keys($data);
                $place = array_map(function($c) { return ":$c"; }, $cols);
                $sql = "INSERT INTO patrimonios (" . implode(',', $cols) . ") VALUES (" . implode(',', $place) . ")";
                $stmt = $conn->prepare($sql);
                foreach ($data as $k => $v) $stmt->bindValue(":$k", $v);
                $stmt->execute();
                $newId = $conn->lastInsertId();
                
                $stmtHist = $conn->prepare("
                    INSERT INTO movimentacoes_patrimonios (patrimonio_id, obra_origem_id, obra_destino_id, data_movimentacao, usuario_id)
                    VALUES (?, NULL, NULL, NOW(), ?)
                ");
                $stmtHist->execute([$newId, $authUser['user_id'] ?? null]);
                
                $stmt = $conn->prepare("
                    SELECT id, codigo, nome, ativo, obra_atual_id, em_manutencao,
                           riscado, quebrado, sujo, alugado, data_inativacao,
                           mobilizacao_pendente, responsavel_id
                    FROM patrimonios WHERE id = ?
                ");
                $stmt->execute([$newId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $row = $prepareRowPat($row);
                    $row['historico'] = $loadHistoricoPat($row['id']);
                    json_response($row, 201);
                } else {
                    json_response(["error" => "Erro ao recuperar patrimônio"], 500);
                }
            }
            elseif ($method === 'PUT' && $id) {
                $data = $normalizePayloadPat($input);
                if (empty($data)) {
                    json_response(["error" => "Payload vazio"], 400);
                    break;
                }
                
                $sets = array_map(function($c) { return "$c = :$c"; }, array_keys($data));
                $sql = "UPDATE patrimonios SET " . implode(',', $sets) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                foreach ($data as $k => $v) $stmt->bindValue(":$k", $v);
                $stmt->bindValue(':id', $id);
                $stmt->execute();
                
                // Se a obra atual foi alterada ou a responsabilidade foi removida, registra movimentação
                if (isset($input['obraAtualId']) || isset($input['responsavelId'])) {
                    $oldStmt = $conn->prepare("SELECT obra_atual_id, responsavel_id FROM patrimonios WHERE id = ?");
                    $oldStmt->execute([$id]);
                    $old = $oldStmt->fetch(PDO::FETCH_ASSOC);
                    $novaObra = isset($input['obraAtualId']) ? $input['obraAtualId'] : $old['obra_atual_id'];
                    $novoResp = isset($input['responsavelId']) ? $input['responsavelId'] : $old['responsavel_id'];
                    if ($novaObra != $old['obra_atual_id'] || $novoResp != $old['responsavel_id']) {
                        $stmtHist = $conn->prepare("
                            INSERT INTO movimentacoes_patrimonios (patrimonio_id, obra_origem_id, obra_destino_id, data_movimentacao, data_programada, usuario_id)
                            VALUES (?, ?, ?, NOW(), ?, ?)
                        ");
                        $dataProgramada = isset($input['mobilizacaoPendente']['dataMobilizacao']) ? $input['mobilizacaoPendente']['dataMobilizacao'] : null;
                        $stmtHist->execute([$id, $old['obra_atual_id'], $novaObra, $dataProgramada, $authUser['user_id'] ?? null]);
                    }
                }
                
                $stmt = $conn->prepare("
                    SELECT id, codigo, nome, ativo, obra_atual_id, em_manutencao,
                           riscado, quebrado, sujo, alugado, data_inativacao,
                           mobilizacao_pendente, responsavel_id
                    FROM patrimonios WHERE id = ?
                ");
                $stmt->execute([$id]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $row = $prepareRowPat($row);
                    $row['historico'] = $loadHistoricoPat($row['id']);
                    json_response($row);
                } else {
                    json_response(["error" => "Patrimônio não encontrado após atualização"], 404);
                }
            }
            elseif ($method === 'DELETE' && $id) {
                $stmt = $conn->prepare("DELETE FROM patrimonios WHERE id = ?");
                $stmt->execute([$id]);
                json_response(["success" => true]);
            }
            else {
                json_response(["error" => "Método não permitido"], 405);
            }
        } catch (PDOException $e) {
            json_response(["error" => "Erro no banco de dados: " . err_detail($e)], 500);
        } catch (Exception $e) {
            json_response(["error" => "Erro interno: " . err_detail($e)], 500);
        }
        break;

    // -------------------- RESPONSABILIDADES DE PATRIMÔNIOS --------------------
    case 'responsabilidades':
        // GET: listar períodos (opcional: filtrar por patrimonio_id ou colaborador_id)
        if ($method === 'GET') {
            $patrimonioId = $_GET['patrimonio_id'] ?? null;
            $colaboradorId = $_GET['colaborador_id'] ?? null;
            try {
                $sql = "SELECT id, patrimonio_id, colaborador_id, data_inicio, data_fim, created_at
                        FROM responsabilidades_patrimonios WHERE 1=1";
                $params = [];
                if ($patrimonioId) {
                    $sql .= " AND patrimonio_id = ?";
                    $params[] = $patrimonioId;
                }
                if ($colaboradorId) {
                    $sql .= " AND colaborador_id = ?";
                    $params[] = $colaboradorId;
                }
                $sql .= " ORDER BY data_inicio DESC";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['patrimonio_id'] = (string)$r['patrimonio_id'];
                    $r['colaborador_id'] = (string)$r['colaborador_id'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
    
        // POST: criar novo período de responsabilidade (encerra o anterior automaticamente)
        if ($method === 'POST') {
            $patrimonioId = $input['patrimonio_id'] ?? null;
            $colaboradorId = $input['colaborador_id'] ?? null;
            $dataInicio = $input['data_inicio'] ?? null;
            if (!$patrimonioId || !$colaboradorId || !$dataInicio) {
                json_response(["error" => "patrimonio_id, colaborador_id e data_inicio são obrigatórios"], 400);
            }
            try {
                $conn->beginTransaction();
                // 1. Encerra qualquer período aberto do patrimônio
                $stmt = $conn->prepare("
                    UPDATE responsabilidades_patrimonios
                    SET data_fim = :fim
                    WHERE patrimonio_id = :pid AND data_fim IS NULL
                ");
                $stmt->execute([':fim' => $dataInicio, ':pid' => $patrimonioId]);
                // 2. Insere o novo período
                $stmt = $conn->prepare("
                    INSERT INTO responsabilidades_patrimonios (patrimonio_id, colaborador_id, data_inicio)
                    VALUES (:pid, :cid, :inicio)
                ");
                $stmt->execute([':pid' => $patrimonioId, ':cid' => $colaboradorId, ':inicio' => $dataInicio]);
                $newId = $conn->lastInsertId();
                // 3. Atualiza o campo denormalizado responsavel_id na tabela patrimonios
                $stmt = $conn->prepare("UPDATE patrimonios SET responsavel_id = :rid WHERE id = :pid");
                $stmt->execute([':rid' => $colaboradorId, ':pid' => $patrimonioId]);
                $conn->commit();
                json_response(["id" => (string)$newId, "message" => "Período de responsabilidade criado"]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
    
        // PUT com id: encerra um período específico (data_fim)
        if ($method === 'PUT' && $id) {
            $dataFim = $input['data_fim'] ?? null;
            if (!$dataFim) {
                json_response(["error" => "data_fim é obrigatória"], 400);
            }
            try {
                $conn->beginTransaction();
                // Busca o patrimonio_id relacionado a este período
                $stmt = $conn->prepare("SELECT patrimonio_id FROM responsabilidades_patrimonios WHERE id = ?");
                $stmt->execute([$id]);
                $patrimonioId = $stmt->fetchColumn();
                if (!$patrimonioId) {
                    json_response(["error" => "Período não encontrado"], 404);
                }
                // Encerra o período
                $stmt = $conn->prepare("UPDATE responsabilidades_patrimonios SET data_fim = :fim WHERE id = :id");
                $stmt->execute([':fim' => $dataFim, ':id' => $id]);
                // Verifica se ainda existe algum período aberto para este patrimônio
                $stmt = $conn->prepare("SELECT COUNT(*) FROM responsabilidades_patrimonios WHERE patrimonio_id = :pid AND data_fim IS NULL");
                $stmt->execute([':pid' => $patrimonioId]);
                $abertos = $stmt->fetchColumn();
                if ($abertos == 0) {
                    $stmt = $conn->prepare("UPDATE patrimonios SET responsavel_id = NULL WHERE id = :pid");
                    $stmt->execute([':pid' => $patrimonioId]);
                }
                $conn->commit();
                json_response(["message" => "Período encerrado"]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
    
        // DELETE com query string ?colaborador_id=XX: encerra todos os períodos abertos do colaborador (usado na inativação)
        if ($method === 'DELETE' && isset($_GET['colaborador_id'])) {
            $colaboradorId = $_GET['colaborador_id'];
            $dataFim = date('Y-m-d');
            try {
                $conn->beginTransaction();
                // Encerra todos os períodos abertos do colaborador
                $stmt = $conn->prepare("
                    UPDATE responsabilidades_patrimonios
                    SET data_fim = :fim
                    WHERE colaborador_id = :cid AND data_fim IS NULL
                ");
                $stmt->execute([':fim' => $dataFim, ':cid' => $colaboradorId]);
                // Limpa o campo responsavel_id dos patrimônios que ficaram sem período aberto
                $stmt = $conn->prepare("
                    UPDATE patrimonios p
                    LEFT JOIN responsabilidades_patrimonios r ON p.id = r.patrimonio_id AND r.data_fim IS NULL
                    SET p.responsavel_id = NULL
                    WHERE p.responsavel_id = :cid
                ");
                $stmt->execute([':cid' => $colaboradorId]);
                $conn->commit();
                json_response(["message" => "Responsabilidades encerradas para o colaborador"]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
    
        json_response(["error" => "Método não permitido"], 405);
        break;
    
    // -------------------- MOBILIZAR PATRIMÔNIO --------------------
    case 'mobilizarPatrimonio':
        if ($method !== 'POST') {
            json_response(["error" => "Método não permitido"], 405);
            break;
        }
    
        $patId = $input['patId'] ?? null;
        $obraDestinoId = $input['obraDestinoId'] ?? null;
        $dataProgramada = $input['dataProgramada'] ?? null; // formato YYYY-MM-DD
        $usuarioId = $input['usuarioId'] ?? null;
    
        if (!$patId) {
            json_response(["error" => "patId é obrigatório"], 400);
            break;
        }
    
        // Se não fornecida, usa a data atual
        if (!$dataProgramada) {
            $dataProgramada = date('Y-m-d');
        }
    
        try {
            $conn->beginTransaction();
    
            // 1. Busca estado atual do patrimônio
            $stmt = $conn->prepare("
                SELECT obra_atual_id, responsavel_id, em_manutencao, sujo
                FROM patrimonios WHERE id = ? FOR UPDATE
            ");
            $stmt->execute([$patId]);
            $atual = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$atual) {
                json_response(["error" => "Patrimônio não encontrado"], 404);
            }
    
            // 2. Identifica o tipo de destino
            $isManutencao = ($obraDestinoId === '__manutencao__');
            $isSujo = ($obraDestinoId === '__sujo__');
            $isResp = ($obraDestinoId !== null && str_starts_with($obraDestinoId, '__resp__'));
            $isRealObra = (!$isManutencao && !$isSujo && !$isResp && $obraDestinoId !== null);
            $isSemAlocacao = ($obraDestinoId === null || $obraDestinoId === '');
    
            // 3. Prepara os campos a serem atualizados no patrimônio
            $updates = [];
            $updates['obra_atual_id'] = null;
            $updates['em_manutencao'] = 0;
            $updates['sujo'] = 0;
            $updates['responsavel_id'] = null;
    
            if ($isManutencao) {
                $updates['em_manutencao'] = 1;
            } elseif ($isSujo) {
                $updates['sujo'] = 1;
            } elseif ($isResp) {
                $colabId = str_replace('__resp__', '', $obraDestinoId);
                // Valida se o colaborador existe e pode ser responsável (tem a tag)
                $stmtCol = $conn->prepare("
                    SELECT id FROM colaboradores
                    WHERE id = ? AND ativo = 1
                    AND JSON_CONTAINS(responsabilidades, '\"quadroPatrimonios\"')
                ");
                $stmtCol->execute([$colabId]);
                if (!$stmtCol->fetch()) {
                    json_response(["error" => "Colaborador não encontrado ou não autorizado a ser responsável"], 400);
                }
                $updates['responsavel_id'] = $colabId;
            } elseif ($isRealObra) {
                $updates['obra_atual_id'] = $obraDestinoId;
            }
            // Para $isSemAlocação, todos os campos já estão null (padrão)
    
            // 4. Gerencia os períodos de responsabilidade
            // Sempre que o patrimônio deixar de estar sob responsabilidade (vai para obra, manutenção, sujo ou sem alocação)
            if (!$isResp) {
                // Encerra período aberto atual (se existir)
                $stmt = $conn->prepare("
                    UPDATE responsabilidades_patrimonios
                    SET data_fim = :fim
                    WHERE patrimonio_id = :pid AND data_fim IS NULL
                ");
                $stmt->execute([':fim' => $dataProgramada, ':pid' => $patId]);
            } else {
                // Movendo para um responsável: encerra período anterior e abre novo
                $colabId = str_replace('__resp__', '', $obraDestinoId);
                // Encerra período aberto atual (se houver)
                $stmt = $conn->prepare("
                    UPDATE responsabilidades_patrimonios
                    SET data_fim = :fim
                    WHERE patrimonio_id = :pid AND data_fim IS NULL
                ");
                $stmt->execute([':fim' => $dataProgramada, ':pid' => $patId]);
                // Cria novo período
                $stmt = $conn->prepare("
                    INSERT INTO responsabilidades_patrimonios (patrimonio_id, colaborador_id, data_inicio)
                    VALUES (:pid, :cid, :inicio)
                ");
                $stmt->execute([':pid' => $patId, ':cid' => $colabId, ':inicio' => $dataProgramada]);
            }
    
            // 5. Atualiza a tabela patrimonios — só quando a data já venceu.
            // Antes o UPDATE rodava incondicionalmente: agendar uma mobilização
            // para o mês que vem movia o bem na hora, e o agendamento só era
            // desfeito pelo PUT seguinte do front.
            $jaVenceu = $dataProgramada <= date('Y-m-d');
            if ($jaVenceu) {
                $setClause = [];
                $params = [];
                foreach ($updates as $col => $val) {
                    $setClause[] = "$col = :$col";
                    $params[$col] = $val;
                }
                $params['id'] = $patId;
                $sql = "UPDATE patrimonios SET " . implode(', ', $setClause) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
            }
    
            // 6. Registra o evento tipado. Antes gravava sempre destino NULL
            // para as colunas especiais, o que tornava "foi para manutenção",
            // "ficou sujo", "passou a um responsável" e "saiu da obra" quatro
            // fatos indistinguíveis no histórico.
            $statusOrigemPat = null;
            if ((int)($atual['em_manutencao'] ?? 0) === 1)      $statusOrigemPat = 'manutencao';
            elseif ((int)($atual['sujo'] ?? 0) === 1)           $statusOrigemPat = 'sujo';

            if ($isResp) {
                $tipoEvento = 'responsavel';
                $statusDestinoPat = null;
            } elseif ($isRealObra) {
                $tipoEvento = 'mobilizacao';
                $statusDestinoPat = null;
            } else {
                $tipoEvento = 'status';
                $statusDestinoPat = $isManutencao ? 'manutencao' : ($isSujo ? 'sujo' : 'sem_alocacao');
            }

            registrarEventoPatrimonio($conn, [
                'patrimonio_id'   => $patId,
                'tipo'            => $tipoEvento,
                'obra_origem_id'  => $atual['obra_atual_id'] ?: null,
                'obra_destino_id' => $isRealObra ? $obraDestinoId : null,
                'status_origem'   => $statusOrigemPat,
                'status_destino'  => $statusDestinoPat,
                'colaborador_id'  => $isResp ? str_replace('__resp__', '', $obraDestinoId) : null,
                'data_efetiva'    => $dataProgramada,
                'usuario_id'      => $usuarioId,
            ]);

            $conn->commit();
            json_response(["message" => "Mobilização registrada com sucesso", "aplicada" => $jaVenceu]);
    
        } catch (PDOException $e) {
            $conn->rollBack();
            json_response(["error" => "Erro ao mobilizar patrimônio: " . err_detail($e)], 500);
        } catch (Exception $e) {
            $conn->rollBack();
            json_response(["error" => "Erro interno: " . err_detail($e)], 500);
        }
        break;
        
    // -------------------- CONTRATOS --------------------
    case 'contratos':
        // Campos que devem ser tratados como JSON
        // `historico` sai do conjunto gravável: desde a migração 2026_08_01 o
        // histórico do contrato vive em `movimentacoes_contratos`. A coluna
        // permanece como está — é a cópia original dos 57 eventos importados,
        // e escrever nela de novo faria as duas fontes divergirem.
        $jsonFieldsContrato = ['mobilizacao_pendente', 'aditivos'];
        
        // Colunas permitidas para INSERT/UPDATE (agora incluindo os três novos campos)
        $camposPermitidosContrato = [
            'locacao_servico', 'inicio', 'termino', 'responsavel', 'contato', 'valor',
            'forma_pagamento_id', 'tipo', 'observacao', 'status', 'ativo', 'obra_atual_id',
            'ocioso', 'mobilizacao_pendente', 'aditivos',
            'periodicidade_pagamento',   // 🆕
            'endereco',                  // 🆕
            'tipo_maquina'               // 🆕
        ];
        
        // Mapeamento camelCase (frontend) -> snake_case (banco)
        $mapFrontToDbContrato = [
            'locacaoServico'      => 'locacao_servico',
            'formaPagamentoId'    => 'forma_pagamento_id',
            'obraAtualId'         => 'obra_atual_id',
            'mobilizacaoPendente' => 'mobilizacao_pendente',
            'periodicidadePagamento' => 'periodicidade_pagamento',
            'tipoMaquina'         => 'tipo_maquina'
        ];
        
        // Mapeamento inverso para leitura (snake_case -> camelCase)
        $mapDbToFrontContrato = [
            'locacao_servico'          => 'locacaoServico',
            'forma_pagamento_id'       => 'formaPagamentoId',
            'obra_atual_id'            => 'obraAtualId',
            'mobilizacao_pendente'     => 'mobilizacaoPendente',
            'periodicidade_pagamento'  => 'periodicidadePagamento',
            'tipo_maquina'             => 'tipoMaquina'
        ];
    
        // Helper: normaliza payload do frontend para colunas do banco
        $normalizePayloadContrato = function($data) use ($mapFrontToDbContrato, $camposPermitidosContrato, $jsonFieldsContrato) {
            $out = [];
            foreach ($data as $k => $v) {
                $col = isset($mapFrontToDbContrato[$k]) ? $mapFrontToDbContrato[$k] : $k;
                if (!in_array($col, $camposPermitidosContrato, true)) continue;
                if (in_array($col, $jsonFieldsContrato, true)) {
                    $out[$col] = ($v !== null && $v !== '') ? json_encode($v, JSON_UNESCAPED_UNICODE) : null;
                } elseif (in_array($col, ['inicio','termino'])) {
                    $out[$col] = ($v === '' || $v === null) ? null : $v;
                } elseif ($col === 'valor') {
                    $out[$col] = is_numeric($v) ? (float)$v : 0;
                } elseif ($col === 'ativo' || $col === 'ocioso') {
                    $out[$col] = ($v === true || $v === 1 || $v === '1' || $v === 'true') ? 1 : 0;
                } else {
                    $out[$col] = $v;   // aqui entram periodicidade_pagamento, endereco, tipo_maquina (strings)
                }
            }
            return $out;
        };
    
        // Helper: prepara linha vinda do banco para o frontend
        $prepareRowContrato = function($row) use ($mapDbToFrontContrato, $jsonFieldsContrato) {
            if (!$row) return $row;
            $frontRow = [];
            foreach ($row as $dbKey => $value) {
                $frontKey = isset($mapDbToFrontContrato[$dbKey]) ? $mapDbToFrontContrato[$dbKey] : $dbKey;
                $frontRow[$frontKey] = $value;
            }
            foreach ($jsonFieldsContrato as $field) {
                $dbField = isset($mapFrontToDbContrato[$field]) ? $mapFrontToDbContrato[$field] : $field;
                $frontField = isset($mapDbToFrontContrato[$dbField]) ? $mapDbToFrontContrato[$dbField] : $field;
                if (isset($frontRow[$frontField]) && is_string($frontRow[$frontField]) && $frontRow[$frontField] !== '') {
                    $decoded = json_decode($frontRow[$frontField], true);
                    $frontRow[$frontField] = ($decoded === null && json_last_error() !== JSON_ERROR_NONE) ? null : $decoded;
                } elseif (isset($frontRow[$frontField]) && ($frontRow[$frontField] === null || $frontRow[$frontField] === '')) {
                    $frontRow[$frontField] = null;
                }
            }
            if (isset($frontRow['id'])) $frontRow['id'] = (string)$frontRow['id'];
            if (isset($frontRow['obraAtualId']) && $frontRow['obraAtualId'] !== null) $frontRow['obraAtualId'] = (string)$frontRow['obraAtualId'];
            if (isset($frontRow['formaPagamentoId']) && $frontRow['formaPagamentoId'] !== null) $frontRow['formaPagamentoId'] = (string)$frontRow['formaPagamentoId'];
            if (isset($frontRow['ativo'])) $frontRow['ativo'] = (bool)$frontRow['ativo'];
            if (isset($frontRow['ocioso'])) $frontRow['ocioso'] = (bool)$frontRow['ocioso'];
            if (!isset($frontRow['historico']) || $frontRow['historico'] === null) $frontRow['historico'] = [];
            return $frontRow;
        };
    
        // Helper para carregar movimentações (histórico) da tabela movimentacoes_contratos
        // Histórico do contrato como EVENTO TIPADO.
        //
        // Antes esta função lia de `movimentacoes_contratos` e o GET
        // SOBRESCREVIA `$row['historico']` com o resultado — ou seja, a coluna
        // `contratos.historico`, que tem os 57 eventos com autoria real, era
        // gravada e nunca lida. E o que a substituía vinha de 31 linhas com
        // destino e data nulos, gerando "Mobilizado de Sem Alocação para Sem
        // Alocação" para todo mundo.
        //
        // A migração 2026_08_01 importou aquele JSON para cá. A coluna vira
        // legado somente-leitura e esta passa a ser a única fonte.
        $loadHistoricoContrato = function($contratoId) use ($conn) {
            $tipado = temEventosTipadosEm($conn, 'movimentacoes_contratos');

            $colTipo    = $tipado ? 'm.tipo'           : "'mobilizacao'";
            $colStatusO = $tipado ? 'm.status_origem'  : 'NULL';
            $colStatusD = $tipado ? 'm.status_destino' : 'NULL';
            $colObs     = $tipado ? 'm.observacao'     : 'NULL';
            $colData    = 'COALESCE(m.data_programada, m.data_movimentacao)';
            $colReg     = $tipado ? 'COALESCE(m.registrado_em, m.data_movimentacao)' : 'm.data_movimentacao';

            $rotulo = "CASE %s
                         WHEN 'ocioso'        THEN 'Ocioso'
                         WHEN 'sem_alocacao'  THEN 'Sem Alocação'
                         WHEN 'indeterminado' THEN 'Saiu da obra'
                         WHEN 'rascunho'      THEN 'Rascunho'
                         WHEN 'ativo'         THEN 'Ativo'
                         WHEN 'suspenso'      THEN 'Suspenso'
                         WHEN 'encerrado'     THEN 'Encerrado'
                         WHEN 'inadimplente'  THEN 'Inadimplente'
                         ELSE NULL
                       END";
            $rotuloO = sprintf($rotulo, $colStatusO);
            $rotuloD = sprintf($rotulo, $colStatusD);

            $stmt = $conn->prepare("
                SELECT
                    CONCAT('mov_', m.id)      AS id,
                    $colTipo                  AS tipo,
                    m.obra_origem_id          AS obraOrigemId,
                    o_orig.nome               AS obraOrigemNome,
                    m.obra_destino_id         AS obraDestinoId,
                    o_dest.nome               AS obraDestinoNome,
                    $colStatusO               AS statusOrigem,
                    $colStatusD               AS statusDestino,
                    $colObs                   AS observacao,
                    $colData                  AS data,
                    $colReg                   AS registradoEm,
                    COALESCE(u.login, 'Sistema') AS usuario,
                    CASE
                      WHEN $colTipo = 'cadastro' THEN 'Contrato cadastrado'
                      WHEN $colTipo = 'status_contrato' THEN
                        CONCAT('Situação alterada para ', COALESCE($rotuloD, 'desconhecida'),
                               ' em ', DATE_FORMAT($colData, '%d/%m/%Y'))
                      ELSE
                        CONCAT(
                          CASE WHEN m.obra_destino_id IS NOT NULL THEN 'Mobilizado de ' ELSE 'Status alterado de ' END,
                          COALESCE(o_orig.nome, $rotuloO, 'Sem Alocação'),
                          ' para ',
                          COALESCE(o_dest.nome, $rotuloD, 'Sem Alocação'),
                          ' em ', DATE_FORMAT($colData, '%d/%m/%Y')
                        )
                    END AS descricao
                FROM movimentacoes_contratos m
                LEFT JOIN obras o_orig ON m.obra_origem_id = o_orig.id
                LEFT JOIN obras o_dest ON m.obra_destino_id = o_dest.id
                LEFT JOIN usuarios u   ON m.usuario_id = u.id
                WHERE m.contrato_id = ?
                ORDER BY $colData DESC, m.id DESC
            ");
            $stmt->execute([$contratoId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$r) {
                if (isset($r['obraOrigemId']))  $r['obraOrigemId']  = (string)$r['obraOrigemId'];
                if (isset($r['obraDestinoId'])) $r['obraDestinoId'] = (string)$r['obraDestinoId'];
            }
            return $rows;
        };
    
        try {
            if ($method === 'GET') {
                if ($id) {
                    $stmt = $conn->prepare("SELECT * FROM contratos WHERE id = ?");
                    $stmt->execute([$id]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($row) {
                        $row = $prepareRowContrato($row);
                        $row['historico'] = $loadHistoricoContrato($row['id']);
                        json_response($row);
                    } else {
                        json_response(["error" => "Contrato não encontrado"], 404);
                    }
                } else {
                    $stmt = $conn->query("SELECT * FROM contratos ORDER BY locacao_servico");
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    $result = [];
                    foreach ($rows as $row) {
                        $row = $prepareRowContrato($row);
                        $row['historico'] = $loadHistoricoContrato($row['id']);
                        $result[] = $row;
                    }
                    json_response($result);
                }
            }
            elseif ($method === 'POST') {
                $data = $normalizePayloadContrato($input);
                if (empty($data)) {
                    json_response(["error" => "Payload vazio"], 400);
                    break;
                }
                $cols = array_keys($data);
                $place = array_map(function($c) { return ":$c"; }, $cols);
                $sql = "INSERT INTO contratos (" . implode(',', $cols) . ") VALUES (" . implode(',', $place) . ")";
                $stmt = $conn->prepare($sql);
                foreach ($data as $k => $v) $stmt->bindValue(":$k", $v);
                $stmt->execute();
                $newId = $conn->lastInsertId();
    
                $stmtHist = $conn->prepare("
                    INSERT INTO movimentacoes_contratos (contrato_id, obra_origem_id, obra_destino_id, data_movimentacao, usuario_id)
                    VALUES (?, NULL, NULL, NOW(), ?)
                ");
                $stmtHist->execute([$newId, $authUser['user_id'] ?? null]);
    
                $stmt = $conn->prepare("SELECT * FROM contratos WHERE id = ?");
                $stmt->execute([$newId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $row = $prepareRowContrato($row);
                    $row['historico'] = $loadHistoricoContrato($row['id']);
                    json_response($row, 201);
                } else {
                    json_response(["error" => "Erro ao recuperar contrato"], 500);
                }
            }
            elseif ($method === 'PUT' && $id) {
                $data = $normalizePayloadContrato($input);
                if (empty($data)) {
                    json_response(["error" => "Payload vazio"], 400);
                    break;
                }

                // Estado ANTERIOR, lido antes do UPDATE. Antes esta leitura vinha
                // depois: `$old` já trazia o valor novo, a comparação com o
                // payload nunca dava diferente e a movimentação jamais era
                // gravada.
                $oldStmt = $conn->prepare("SELECT obra_atual_id, ocioso, status FROM contratos WHERE id = ?");
                $oldStmt->execute([$id]);
                $old = $oldStmt->fetch(PDO::FETCH_ASSOC) ?: [];

                $sets = array_map(function($c) { return "$c = :$c"; }, array_keys($data));
                $sql = "UPDATE contratos SET " . implode(',', $sets) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                foreach ($data as $k => $v) $stmt->bindValue(":$k", $v);
                $stmt->bindValue(':id', $id);
                $stmt->execute();

                $usuarioEvtCtr = $authUser['user_id'] ?? null;
                $hojeCtr = date('Y-m-d');

                // Mudança de obra pelo formulário (fora do fluxo de mobilização).
                if (array_key_exists('obraAtualId', $input)
                    && (string)($input['obraAtualId'] ?? '') !== (string)($old['obra_atual_id'] ?? '')) {
                    $dataProgramada = $input['mobilizacaoPendente']['dataMobilizacao'] ?? $hojeCtr;
                    registrarEventoContrato($conn, [
                        'contrato_id'     => $id,
                        'tipo'            => !empty($input['obraAtualId']) ? 'mobilizacao' : 'status',
                        'obra_origem_id'  => $old['obra_atual_id'] ?? null,
                        'obra_destino_id' => $input['obraAtualId'] ?: null,
                        'status_destino'  => !empty($input['obraAtualId']) ? null : 'sem_alocacao',
                        'data_efetiva'    => $dataProgramada,
                        'usuario_id'      => $usuarioEvtCtr,
                    ]);
                }

                // Mudança da situação contratual. Antes um contrato passava a
                // 'inadimplente' ou 'encerrado' sem deixar rastro de quem mudou
                // nem quando.
                $statusAntes  = $old['status'] ?? null;
                $statusDepois = array_key_exists('status', $data) ? $data['status'] : $statusAntes;
                if ($statusDepois !== null && $statusDepois !== $statusAntes) {
                    registrarEventoContrato($conn, [
                        'contrato_id'    => $id,
                        'tipo'           => 'status_contrato',
                        'status_origem'  => $statusAntes,
                        'status_destino' => $statusDepois,
                        'data_efetiva'   => $hojeCtr,
                        'usuario_id'     => $usuarioEvtCtr,
                        'observacao'     => 'Situação contratual alterada',
                    ]);
                }
    
                $stmt = $conn->prepare("SELECT * FROM contratos WHERE id = ?");
                $stmt->execute([$id]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $row = $prepareRowContrato($row);
                    $row['historico'] = $loadHistoricoContrato($row['id']);
                    json_response($row);
                } else {
                    json_response(["error" => "Contrato não encontrado após atualização"], 404);
                }
            }
            elseif ($method === 'DELETE' && $id) {
                $stmt = $conn->prepare("DELETE FROM contratos WHERE id = ?");
                $stmt->execute([$id]);
                json_response(["success" => true]);
            }
            else {
                json_response(["error" => "Método não permitido"], 405);
            }
        } catch (PDOException $e) {
            json_response(["error" => "Erro no banco de dados: " . err_detail($e)], 500);
        } catch (Exception $e) {
            json_response(["error" => "Erro interno: " . err_detail($e)], 500);
        }
        break;
        
    // -------------------- MOBILIZAR CONTRATO --------------------
    case 'mobilizarContrato':
        if ($method == 'POST') {
            try {
                $contratoId = $input['contratoId'] ?? $input['cId'] ?? null; // aceita ambos nomes para compatibilidade
                $obraDestinoId = isset($input['obraDestinoId']) && $input['obraDestinoId'] !== '' ? $input['obraDestinoId'] : null;
                $dataProgramada = $input['dataProgramada'] ?? null;
                $usuarioId = $input['usuarioId'] ?? null;
    
                if (!$contratoId) {
                    json_response(["error" => "contratoId é obrigatório"], 400);
                    break;
                }
    
                // Tratamento especial para "ocioso"
                $ocioso = 0;
                if ($obraDestinoId === '__ocioso__') {
                    $ocioso = 1;
                    $obraDestinoId = null;
                }
    
                // Buscar o estado atual antes da alteração
                $stmt = $conn->prepare("SELECT obra_atual_id, ocioso FROM contratos WHERE id = ?");
                $stmt->execute([$contratoId]);
                $atualCtr   = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
                $obraAtual  = $atualCtr['obra_atual_id'] ?? null;
                $ociosoAtual = (int)($atualCtr['ocioso'] ?? 0) === 1;

                $dataProgramada = $dataProgramada ?: date('Y-m-d');

                // Só aplica o estado quando a data já venceu. Antes o UPDATE
                // rodava incondicionalmente: agendar uma mobilização para o mês
                // que vem movia o contrato na hora.
                $jaVenceu = $dataProgramada <= date('Y-m-d');
                if ($jaVenceu) {
                    $stmtUpd = $conn->prepare("
                        UPDATE contratos
                        SET obra_atual_id = :obra,
                            ocioso = :ocioso,
                            mobilizacao_pendente = NULL
                        WHERE id = :id
                    ");
                    $stmtUpd->execute([
                        ':obra'   => $obraDestinoId,
                        ':ocioso' => $ocioso,
                        ':id'     => $contratoId
                    ]);
                }
    
                // Registrar o evento tipado. Antes gravava sempre destino e
                // data nulos: as 31 linhas do banco não dizem para onde o
                // contrato foi nem quando aquilo passou a valer.
                registrarEventoContrato($conn, [
                    'contrato_id'     => $contratoId,
                    'tipo'            => $obraDestinoId !== null ? 'mobilizacao' : 'status',
                    'obra_origem_id'  => $obraAtual ?: null,
                    'obra_destino_id' => $obraDestinoId,
                    'status_origem'   => $ociosoAtual ? 'ocioso' : null,
                    'status_destino'  => $obraDestinoId !== null
                        ? null
                        : ($ocioso === 1 ? 'ocioso' : 'sem_alocacao'),
                    'data_efetiva'    => $dataProgramada,
                    'usuario_id'      => $usuarioId,
                ]);

                json_response([
                    "message"  => "Mobilização do contrato salva com sucesso",
                    "aplicada" => $jaVenceu,
                ]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao mobilizar contrato: " . err_detail($e)], 500);
            }
        }
        break;

    // -------------------- PERÍODOS DE ALOCAÇÃO DO CONTRATO --------------------
    // Espelha `mobilizacoesPeriodos` e `patrimoniosPeriodos`: períodos fechados
    // com LEAD() sobre a data efetiva, desempate por id. `tipo` separa período
    // de obra de período ocioso — o que sustenta o custo por obra, que antes era
    // calculado sobre períodos que sempre diziam "Sem Alocação".
    case 'contratosPeriodos':
        if ($method !== 'GET') {
            json_response(["error" => "Método não permitido"], 405);
            break;
        }
        try {
            if (!temEventosTipadosEm($conn, 'movimentacoes_contratos')) {
                json_response([]);
                break;
            }

            $where  = ["m.tipo IN ('mobilizacao','status')"];
            $params = [];
            if (!empty($_GET['contrato_id'])) {
                $where[] = 'm.contrato_id = ?';
                $params[] = $_GET['contrato_id'];
            }

            $sqlBase = "
                SELECT
                    m.id, m.contrato_id, m.tipo, m.obra_destino_id, m.obra_origem_id,
                    m.status_destino, m.usuario_id,
                    COALESCE(m.data_programada, m.data_movimentacao) AS data_inicio,
                    COALESCE(m.registrado_em, m.data_movimentacao)   AS registrado_em,
                    LEAD(COALESCE(m.data_programada, m.data_movimentacao)) OVER (
                        PARTITION BY m.contrato_id
                        ORDER BY COALESCE(m.data_programada, m.data_movimentacao), m.id
                    ) AS proximo_inicio
                FROM movimentacoes_contratos m
                WHERE " . implode(' AND ', $where);

            $filtros = [];
            if (!empty($_GET['from'])) $filtros[] = 't.data_inicio >= ?';
            if (!empty($_GET['to']))   $filtros[] = 't.data_inicio <= ?';

            $sql = "
                SELECT
                    t.id, t.contrato_id, t.tipo, t.data_inicio, t.registrado_em,
                    t.obra_destino_id, t.obra_origem_id, t.status_destino,
                    o.nome      AS obra_nome,
                    o_orig.nome AS obra_origem_nome,
                    c.locacao_servico AS contrato_nome,
                    u.login     AS usuario_nome,
                    CASE WHEN t.proximo_inicio IS NULL THEN NULL
                         ELSE DATE_SUB(t.proximo_inicio, INTERVAL 1 DAY) END AS data_fim,
                    (t.proximo_inicio IS NOT NULL AND t.proximo_inicio <= t.data_inicio) AS substituido,
                    GREATEST(
                        DATEDIFF(
                            COALESCE(DATE_SUB(t.proximo_inicio, INTERVAL 1 DAY), CURDATE()),
                            t.data_inicio
                        ) + 1, 0
                    ) AS dias
                FROM ($sqlBase) t
                LEFT JOIN obras     o      ON o.id      = t.obra_destino_id
                LEFT JOIN obras     o_orig ON o_orig.id = t.obra_origem_id
                LEFT JOIN contratos c      ON c.id      = t.contrato_id
                LEFT JOIN usuarios  u      ON u.id      = t.usuario_id
                " . ($filtros ? 'WHERE ' . implode(' AND ', $filtros) : '') . "
                ORDER BY t.data_inicio DESC, t.id DESC
            ";

            if (!empty($_GET['from'])) $params[] = $_GET['from'];
            if (!empty($_GET['to']))   $params[] = $_GET['to'];

            $stmt = $conn->prepare($sql);
            $stmt->execute($params);

            $out = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $out[] = [
                    'id'               => (string)$r['id'],
                    'contrato_id'      => (string)$r['contrato_id'],
                    'contrato_nome'    => $r['contrato_nome'],
                    'tipo'             => $r['obra_destino_id'] !== null ? 'obra' : 'status',
                    'obra_id'          => $r['obra_destino_id'] !== null ? (string)$r['obra_destino_id'] : null,
                    'obra_nome'        => $r['obra_nome'],
                    'from_obra_nome'   => $r['obra_origem_nome'],
                    'status'           => $r['status_destino'],
                    'data_inicio'      => $r['data_inicio'],
                    'data_fim'         => $r['data_fim'],
                    'dias'             => (int)$r['dias'],
                    'substituido'      => (bool)$r['substituido'],
                    'usuario_nome'     => $r['usuario_nome'] ?: 'Sistema',
                    'registrado_em'    => $r['registrado_em'],
                ];
            }
            json_response($out);
        } catch (PDOException $e) {
            json_response(["error" => "Erro ao buscar períodos do contrato: " . err_detail($e)], 500);
        }
        break;

    // -------------------- VEÍCULOS (COM SUPORTE A MOTORISTA_ID) --------------------
    case 'veiculos':
        // Helper: normaliza row de veículo para o frontend
        $prepareRowVeiculo = function($v) {
            $v['id']              = (string)$v['id'];
            $v['obraAtualId']     = !empty($v['obraAtualId']) ? (string)$v['obraAtualId'] : null;
            $v['ativo']           = (bool)$v['ativo'];
            $v['riscado']         = (bool)$v['riscado'];
            $v['quebrado']        = (bool)($v['quebrado'] ?? false);
            $v['manutencao']      = (bool)($v['manutencao'] ?? $v['quebrado'] ?? false);
            $v['sujo']            = (bool)($v['sujo'] ?? false);
            $v['alugado']         = (bool)$v['alugado'];
            $v['motoristaId']     = !empty($v['motorista_id']) ? (string)$v['motorista_id'] : null;
            $v['mobilizacaoPendente'] = !empty($v['mobilizacao_pendente']) ? json_decode($v['mobilizacao_pendente'], true) : null;
            unset($v['motorista_id'], $v['mobilizacao_pendente']);
            return $v;
        };

        if ($method == 'GET') {
            $veiculoSelect = "
                SELECT id, codigo, nome, tipo, ativo, obra_atual_id AS obraAtualId,
                       riscado, quebrado, manutencao, sujo, alugado,
                       data_inativacao AS dataInativacao,
                       mobilizacao_pendente, motorista_id
                FROM veiculos
            ";

            // `veiculos` não tem coluna `historico`: o histórico é reconstruído a
            // partir de `movimentacoes_veiculos`. Com a migração
            // 2026_08_13_movimentacoes_veiculos_motorista aplicada, as linhas de
            // troca de motorista deixam de se passar por mobilização de obra e
            // saem como evento 'outro' com quem entrou e quem saiu do volante.
            if (temMotoristaEmMovimentacoesVeiculos($conn)) {
                $veiculoHistSql = "
                    SELECT mv.id,
                           IF(mv.motorista_origem_id IS NOT NULL OR mv.motorista_destino_id IS NOT NULL,
                              'outro', 'mobilizacao') as tipo,
                           IF(mv.motorista_origem_id IS NOT NULL OR mv.motorista_destino_id IS NOT NULL,
                              CASE
                                WHEN mv.motorista_origem_id IS NULL
                                  THEN CONCAT('Motorista definido: ', COALESCE(c_dest.nome, 'desconhecido'))
                                WHEN mv.motorista_destino_id IS NULL
                                  THEN CONCAT('Motorista removido: ', COALESCE(c_orig.nome, 'desconhecido'))
                                ELSE CONCAT('Motorista alterado de ', COALESCE(c_orig.nome, 'desconhecido'),
                                            ' para ', COALESCE(c_dest.nome, 'desconhecido'))
                              END,
                              CONCAT('Mobilizado de ', COALESCE(o_orig.nome, 'Sem Alocação'),
                                     ' para ', COALESCE(o_dest.nome, 'Sem Alocação'),
                                     IF(mv.data_programada IS NOT NULL,
                                         CONCAT(' em ', DATE_FORMAT(mv.data_programada, '%d/%m/%Y')), ''))) as descricao,
                           mv.data_movimentacao as data, u.login as usuario
                    FROM movimentacoes_veiculos mv
                    LEFT JOIN obras o_orig ON mv.obra_origem_id = o_orig.id
                    LEFT JOIN obras o_dest ON mv.obra_destino_id = o_dest.id
                    LEFT JOIN colaboradores c_orig ON mv.motorista_origem_id = c_orig.id
                    LEFT JOIN colaboradores c_dest ON mv.motorista_destino_id = c_dest.id
                    LEFT JOIN usuarios u ON mv.usuario_id = u.id
                    WHERE mv.veiculo_id = ?
                ";
            } else {
                $veiculoHistSql = "
                    SELECT mv.id, 'mobilizacao' as tipo,
                           CONCAT('Mobilizado de ', COALESCE(o_orig.nome, 'Sem Alocação'),
                                  ' para ', COALESCE(o_dest.nome, 'Sem Alocação'),
                                  IF(mv.data_programada IS NOT NULL,
                                      CONCAT(' em ', DATE_FORMAT(mv.data_programada, '%d/%m/%Y')), '')) as descricao,
                           mv.data_movimentacao as data, u.login as usuario
                    FROM movimentacoes_veiculos mv
                    LEFT JOIN obras o_orig ON mv.obra_origem_id = o_orig.id
                    LEFT JOIN obras o_dest ON mv.obra_destino_id = o_dest.id
                    LEFT JOIN usuarios u ON mv.usuario_id = u.id
                    WHERE mv.veiculo_id = ?
                ";
            }
            if ($id) {
                try {
                    $stmt = $conn->prepare($veiculoSelect . " WHERE id = ?");
                    $stmt->execute([$id]);
                    $v = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($v) {
                        $v = $prepareRowVeiculo($v);

                        $stmtHist = $conn->prepare($veiculoHistSql);
                        $stmtHist->execute([$v['id']]);
                        $v['historico'] = $stmtHist->fetchAll(PDO::FETCH_ASSOC);
                        json_response($v);
                    } else {
                        json_response(["error" => "Veículo não encontrado"], 404);
                    }
                } catch (PDOException $e) {
                    json_response(["error" => "Erro ao buscar veículo: " . err_detail($e)], 500);
                }
            } else {
                try {
                    $stmt = $conn->query($veiculoSelect);
                    $veiculos = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($veiculos as &$v) {
                        $v = $prepareRowVeiculo($v);
                        $stmtHist = $conn->prepare($veiculoHistSql);
                        $stmtHist->execute([$v['id']]);
                        $v['historico'] = $stmtHist->fetchAll(PDO::FETCH_ASSOC);
                    }
                    json_response($veiculos);
                } catch (PDOException $e) {
                    json_response(["error" => "Erro ao buscar veículos: " . err_detail($e)], 500);
                }
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                $stmt = $conn->prepare("
                    INSERT INTO veiculos (codigo, nome, tipo, ativo, obra_atual_id, riscado, quebrado, manutencao, sujo, alugado, motorista_id)
                    VALUES (:codigo, :nome, :tipo, :ativo, :obraAtualId, :riscado, :quebrado, :manutencao, :sujo, :alugado, :motoristaId)
                ");
                $stmt->execute([
                    'codigo'      => $input['codigo'] ?? '',
                    'nome'        => $input['nome'] ?? '',
                    'tipo'        => $input['tipo'] ?? 'Utilitário',
                    'ativo'       => isset($input['ativo']) ? (int)$input['ativo'] : 1,
                    'obraAtualId' => $input['obraAtualId'] ?? null,
                    'riscado'     => isset($input['riscado']) ? (int)$input['riscado'] : 0,
                    'quebrado'    => isset($input['quebrado']) ? (int)$input['quebrado'] : 0,
                    'manutencao'  => isset($input['manutencao']) ? (int)$input['manutencao'] : 0,
                    'sujo'        => isset($input['sujo']) ? (int)$input['sujo'] : 0,
                    'alugado'     => isset($input['alugado']) ? (int)$input['alugado'] : 0,
                    'motoristaId' => $input['motoristaId'] ?? null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Veículo criado"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar veículo: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'PUT' && $id) {
            try {
                $fields = [];
                $params = ['id' => $id];
                $veiDbMap = [
                    'codigo'             => 'codigo',
                    'nome'               => 'nome',
                    'tipo'               => 'tipo',
                    'ativo'              => 'ativo',
                    'obraAtualId'        => 'obra_atual_id',
                    'riscado'            => 'riscado',
                    'quebrado'           => 'quebrado',
                    'manutencao'         => 'manutencao',
                    'sujo'               => 'sujo',
                    'alugado'            => 'alugado',
                    'dataInativacao'     => 'data_inativacao',
                    'mobilizacaoPendente'=> 'mobilizacao_pendente',
                    'motoristaId'        => 'motorista_id',
                ];
                $boolVei = ['ativo','riscado','quebrado','manutencao','sujo','alugado'];
                foreach ($veiDbMap as $frontKey => $dbCol) {
                    if (!array_key_exists($frontKey, $input)) continue;
                    $value = $input[$frontKey];
                    if ($frontKey === 'dataInativacao' && $value === '') $value = null;
                    if (in_array($frontKey, $boolVei)) $value = (int)$value;
                    if ($frontKey === 'mobilizacaoPendente') $value = $value ? json_encode($value) : null;
                    $fields[] = "$dbCol = :$frontKey";
                    $params[$frontKey] = $value;
                }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }

                // Registrar histórico em movimentacoes_veiculos quando o motorista muda
                if (array_key_exists('motoristaId', $input)) {
                    $stmtCur = $conn->prepare("SELECT motorista_id, obra_atual_id FROM veiculos WHERE id = ?");
                    $stmtCur->execute([$id]);
                    $curVei = $stmtCur->fetch(PDO::FETCH_ASSOC);

                    $novoMotoristaId  = !empty($input['motoristaId'])  ? (string)$input['motoristaId']  : null;
                    $atualMotoristaId = !empty($curVei['motorista_id']) ? (string)$curVei['motorista_id'] : null;

                    if ($novoMotoristaId !== $atualMotoristaId) {
                        $obraOrigemId = $curVei['obra_atual_id'] ?: null;

                        // Obra destino: usa o que o frontend já resolveu (obraAtualId do colaborador)
                        // ou consulta diretamente se não veio no payload
                        $obraDestinoId = null;
                        if ($novoMotoristaId) {
                            if (array_key_exists('obraAtualId', $input) && $input['obraAtualId'] !== null) {
                                $obraDestinoId = $input['obraAtualId'] ?: null;
                            } else {
                                $stmtColab = $conn->prepare("SELECT obra_atual_id FROM colaboradores WHERE id = ?");
                                $stmtColab->execute([$novoMotoristaId]);
                                $obraDestinoId = $stmtColab->fetchColumn() ?: null;
                            }
                        }

                        $usuarioId = !empty($input['usuarioId']) ? $input['usuarioId'] : null;

                        if (temMotoristaEmMovimentacoesVeiculos($conn)) {
                            $stmtMov = $conn->prepare("
                                INSERT INTO movimentacoes_veiculos
                                    (veiculo_id, obra_origem_id, obra_destino_id, data_movimentacao,
                                     usuario_id, motorista_origem_id, motorista_destino_id)
                                VALUES (?, ?, ?, NOW(), ?, ?, ?)
                            ");
                            $stmtMov->execute([
                                $id, $obraOrigemId, $obraDestinoId, $usuarioId,
                                $atualMotoristaId, $novoMotoristaId,
                            ]);
                        } else {
                            $stmtMov = $conn->prepare("
                                INSERT INTO movimentacoes_veiculos
                                    (veiculo_id, obra_origem_id, obra_destino_id, data_movimentacao, usuario_id)
                                VALUES (?, ?, ?, NOW(), ?)
                            ");
                            $stmtMov->execute([$id, $obraOrigemId, $obraDestinoId, $usuarioId]);
                        }
                    }
                }

                $sql = "UPDATE veiculos SET " . implode(', ', $fields) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                json_response(["message" => "Veículo atualizado"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'DELETE' && $id) {
            try {
                $stmt = $conn->prepare("DELETE FROM veiculos WHERE id = ?");
                $stmt->execute([$id]);
                json_response(["message" => "Veículo removido"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao remover: " . err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- MOBILIZAR VEÍCULO --------------------
    case 'mobilizarVeiculo':
        if ($method == 'POST') {
            try {
                $vId = $input['veiculoId'] ?? null;
                $obraDestinoId = isset($input['obraDestinoId']) && $input['obraDestinoId'] !== '' ? $input['obraDestinoId'] : null;
                $dataProgramada = $input['dataProgramada'] ?? null;
                $usuarioId = $input['usuarioId'] ?? null;

                if (!$vId) {
                    json_response(["error" => "veiculoId obrigatório"], 400);
                    break;
                }

                $stmt = $conn->prepare("SELECT obra_atual_id FROM veiculos WHERE id = ?");
                $stmt->execute([$vId]);
                $obraAtual = $stmt->fetchColumn();

                $stmt = $conn->prepare("UPDATE veiculos SET obra_atual_id = :obra WHERE id = :id");
                $stmt->execute(['obra' => $obraDestinoId, 'id' => $vId]);

                $stmtMov = $conn->prepare("
                    INSERT INTO movimentacoes_veiculos (veiculo_id, obra_origem_id, obra_destino_id, data_movimentacao, data_programada, usuario_id)
                    VALUES (?, ?, ?, NOW(), ?, ?)
                ");
                $stmtMov->execute([$vId, $obraAtual ?: null, $obraDestinoId, $dataProgramada, $usuarioId]);

                json_response(["message" => "Mobilização salva"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao mobilizar: " . err_detail($e)], 500);
            }
        }
        break;

    // -------------------- TIPOS DE DOCUMENTO --------------------
    case 'documentoTipos':
        if ($method == 'GET') {
            try {
                $stmt = $conn->query("SELECT id, nome, obrigatorio, aviso_dias AS avisoDias, vencimento_dias AS vencimentoDias FROM documento_tipos");
                $tipos = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($tipos as &$t) {
                    $t['id'] = (string)$t['id'];
                    $t['obrigatorio'] = (bool)$t['obrigatorio'];
                }
                json_response($tipos);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar tipos: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                $stmt = $conn->prepare("INSERT INTO documento_tipos (nome, obrigatorio, aviso_dias, vencimento_dias) VALUES (:nome, :obrigatorio, :avisoDias, :vencimentoDias)");
                $stmt->execute([
                    'nome' => $input['nome'] ?? '',
                    'obrigatorio' => isset($input['obrigatorio']) ? (int)$input['obrigatorio'] : 1,
                    'avisoDias' => $input['avisoDias'] ?? 7,
                    'vencimentoDias' => $input['vencimentoDias'] ?? 365,
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Tipo criado"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'PUT' && $id) {
            try {
                $fields = [];
                $params = ['id' => $id];
                if (isset($input['nome'])) { $fields[] = "nome = :nome"; $params['nome'] = $input['nome']; }
                if (isset($input['obrigatorio'])) { $fields[] = "obrigatorio = :obrigatorio"; $params['obrigatorio'] = (int)$input['obrigatorio']; }
                if (isset($input['avisoDias'])) { $fields[] = "aviso_dias = :avisoDias"; $params['avisoDias'] = $input['avisoDias']; }
                if (isset($input['vencimentoDias'])) { $fields[] = "vencimento_dias = :vencimentoDias"; $params['vencimentoDias'] = $input['vencimentoDias']; }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }
                $sql = "UPDATE documento_tipos SET " . implode(', ', $fields) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                json_response(["message" => "Tipo atualizado"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'DELETE' && $id) {
            try {
                $stmt = $conn->prepare("DELETE FROM documento_tipos WHERE id = ?");
                $stmt->execute([$id]);
                json_response(["message" => "Tipo removido"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao remover: " . err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- DESPESAS --------------------
    case 'despesas':
        if ($method == 'GET') {
            try {
                $sql = "SELECT d.*, f.nome as forma_pagamento_nome, o.nome as obra_nome, 
                               c.nome as colaborador_nome, u.login as aprovado_por_login
                        FROM despesas d
                        LEFT JOIN formas_pagamento f ON d.forma_pagamento_id = f.id
                        LEFT JOIN obras o ON d.obra_id = o.id
                        LEFT JOIN colaboradores c ON d.colaborador_id = c.id
                        LEFT JOIN usuarios u ON d.aprovado_por = u.id";
                
                if ($id) {
                    $sql .= " WHERE d.id = ?";
                    $stmt = $conn->prepare($sql);
                    $stmt->execute([$id]);
                    $despesa = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($despesa) {
                        $despesa['id'] = (string)$despesa['id'];
                        $despesa['valor'] = floatval($despesa['valor']);
                        $despesa['obra_id'] = $despesa['obra_id'] ? (string)$despesa['obra_id'] : null;
                        $despesa['colaborador_id'] = $despesa['colaborador_id'] ? (string)$despesa['colaborador_id'] : null;
                        $despesa['veiculo_id'] = $despesa['veiculo_id'] ? (string)$despesa['veiculo_id'] : null;
                        $despesa['patrimonio_id'] = $despesa['patrimonio_id'] ? (string)$despesa['patrimonio_id'] : null;
                        $despesa['forma_pagamento_id'] = $despesa['forma_pagamento_id'] ? (string)$despesa['forma_pagamento_id'] : null;
                        $despesa['aprovado_por'] = $despesa['aprovado_por'] ? (string)$despesa['aprovado_por'] : null;
                        json_response($despesa);
                    } else {
                        json_response(["error" => "Despesa não encontrada"], 404);
                    }
                } else {
                    $stmt = $conn->query($sql);
                    $despesas = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($despesas as &$d) {
                        $d['id'] = (string)$d['id'];
                        $d['valor'] = floatval($d['valor']);
                        $d['obra_id'] = $d['obra_id'] ? (string)$d['obra_id'] : null;
                        $d['colaborador_id'] = $d['colaborador_id'] ? (string)$d['colaborador_id'] : null;
                        $d['veiculo_id'] = $d['veiculo_id'] ? (string)$d['veiculo_id'] : null;
                        $d['patrimonio_id'] = $d['patrimonio_id'] ? (string)$d['patrimonio_id'] : null;
                        $d['forma_pagamento_id'] = $d['forma_pagamento_id'] ? (string)$d['forma_pagamento_id'] : null;
                        $d['aprovado_por'] = $d['aprovado_por'] ? (string)$d['aprovado_por'] : null;
                    }
                    json_response($despesas);
                }
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar despesas: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                $stmt = $conn->prepare("
                    INSERT INTO despesas (
                        descricao, valor, data, categoria, forma_pagamento_id,
                        obra_id, colaborador_id, veiculo_id, patrimonio_id,
                        status, observacao, comprovante_url, responsavel,
                        aprovado_por, data_aprovacao, fornecedor
                    ) VALUES (
                        :descricao, :valor, :data, :categoria, :forma_pagamento_id,
                        :obra_id, :colaborador_id, :veiculo_id, :patrimonio_id,
                        :status, :observacao, :comprovante_url, :responsavel,
                        :aprovado_por, :data_aprovacao, :fornecedor
                    )
                ");
                $stmt->execute([
                    'descricao' => $input['descricao'] ?? '',
                    'valor' => $input['valor'] ?? 0,
                    'data' => $input['data'] ?? date('Y-m-d'),
                    'categoria' => $input['categoria'] ?? null,
                    'forma_pagamento_id' => $input['forma_pagamento_id'] ?? null,
                    'obra_id' => $input['obra_id'] ?? null,
                    'colaborador_id' => $input['colaborador_id'] ?? null,
                    'veiculo_id' => $input['veiculo_id'] ?? null,
                    'patrimonio_id' => $input['patrimonio_id'] ?? null,
                    'status' => $input['status'] ?? 'pendente',
                    'observacao' => $input['observacao'] ?? null,
                    'comprovante_url' => $input['comprovante_url'] ?? null,
                    'responsavel' => $input['responsavel'] ?? null,
                    'aprovado_por' => $input['aprovado_por'] ?? null,
                    'data_aprovacao' => $input['data_aprovacao'] ?? null,
                    'fornecedor' => $input['fornecedor'] ?? null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Despesa criada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar despesa: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'PUT' && $id) {
            try {
                $fields = [];
                $params = ['id' => $id];
                $allowed = [
                    'descricao', 'valor', 'data', 'categoria', 'forma_pagamento_id',
                    'obra_id', 'colaborador_id', 'veiculo_id', 'patrimonio_id',
                    'status', 'aprovado_por', 'data_aprovacao', 'observacao',
                    'comprovante_url', 'responsavel', 'fornecedor'
                ];
                foreach ($allowed as $field) {
                    if (array_key_exists($field, $input)) {
                        $fields[] = "$field = :$field";
                        $params[$field] = $input[$field];
                    }
                }
                if (empty($fields)) {
                    json_response(["error" => "Nenhum campo para atualizar"], 400);
                    break;
                }
                $sql = "UPDATE despesas SET " . implode(', ', $fields) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                json_response(["message" => "Despesa atualizada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'DELETE' && $id) {
            try {
                $stmt = $conn->prepare("DELETE FROM despesas WHERE id = ?");
                $stmt->execute([$id]);
                json_response(["message" => "Despesa removida"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao remover: " . err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- FORMAS DE PAGAMENTO --------------------
    case 'formasPagamento':
        if ($method == 'GET') {
            try {
                $stmt = $conn->query("SELECT id, nome, tipo, detalhes, ativo FROM formas_pagamento");
                $formas = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($formas as &$f) {
                    $f['id'] = (string)$f['id'];
                    $f['ativo'] = (bool)$f['ativo'];
                }
                json_response($formas);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar formas: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                $stmt = $conn->prepare("INSERT INTO formas_pagamento (nome, tipo, detalhes, ativo) VALUES (:nome, :tipo, :detalhes, :ativo)");
                $stmt->execute([
                    'nome' => $input['nome'] ?? '',
                    'tipo' => $input['tipo'] ?? 'outro',
                    'detalhes' => $input['detalhes'] ?? null,
                    'ativo' => isset($input['ativo']) ? (int)$input['ativo'] : 1,
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Forma criada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'PUT' && $id) {
            try {
                $fields = [];
                $params = ['id' => $id];
                $allowed = ['nome', 'tipo', 'detalhes', 'ativo'];
                foreach ($allowed as $field) {
                    if (array_key_exists($field, $input)) {
                        $value = $input[$field];
                        if ($field === 'ativo') {
                            $value = (int)$value;
                        }
                        $fields[] = "$field = :$field";
                        $params[$field] = $value;
                    }
                }
                if (empty($fields)) {
                    json_response(["error" => "Nenhum campo"], 400);
                    break;
                }
                $sql = "UPDATE formas_pagamento SET " . implode(', ', $fields) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                json_response(["message" => "Forma atualizada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'DELETE' && $id) {
            try {
                $stmt = $conn->prepare("DELETE FROM formas_pagamento WHERE id = ?");
                $stmt->execute([$id]);
                json_response(["message" => "Forma removida"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao remover: " . err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- HISTÓRICO SALARIAL --------------------
    case 'historicoSalarial':
        if ($method == 'GET') {
            $colabId = $_GET['colaborador_id'] ?? null;
            try {
                $sql = "SELECT hs.*, u.login as usuario_login FROM historico_salarial hs LEFT JOIN usuarios u ON hs.usuario_id = u.id";
                $params = [];
                if ($colabId) {
                    $sql .= " WHERE hs.colaborador_id = ?";
                    $params[] = $colabId;
                }
                $sql .= " ORDER BY hs.data_inicio DESC";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $hist = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($hist as &$h) {
                    $h['id'] = (string)$h['id'];
                    $h['colaborador_id'] = (string)$h['colaborador_id'];
                    $h['usuario_id'] = $h['usuario_id'] ? (string)$h['usuario_id'] : null;
                    $h['salario'] = floatval($h['salario']);
                    $h['cargo'] = $h['cargo'] ?? '';
                }
                json_response($hist);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                $stmt = $conn->prepare("
                    INSERT INTO historico_salarial (colaborador_id, salario, data_inicio, data_fim, motivo, cargo, usuario_id)
                    VALUES (:colaborador_id, :salario, :data_inicio, :data_fim, :motivo, :cargo, :usuario_id)
                ");
                $stmt->execute([
                    'colaborador_id' => $input['colaborador_id'],
                    'salario'        => $input['salario'],
                    'data_inicio'    => $input['data_inicio'],
                    'data_fim'       => $input['data_fim'] ?? null,
                    'motivo'         => $input['motivo'] ?? null,
                    'cargo'          => $input['cargo'] ?? null,
                    'usuario_id'     => $input['usuario_id'] ?? null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Registro criado"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- FOPAG ENTRIES --------------------
    case 'fopagEntries':
        if ($method == 'GET') {
            try {
                $stmt = $conn->query("
                    SELECT fe.*
                    FROM fopag_eventos fe
                    ORDER BY fe.created_at DESC
                ");
                $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($entries as &$e) {
                    $e['id'] = (string)$e['id'];
                    $e['colaborador_id'] = (string)$e['colaborador_id'];
                    $e['valor'] = floatval($e['valor']);
                }
                json_response($entries);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                $entries = is_array($input) && isset($input[0]) ? $input : [$input];
                $ids = [];
                foreach ($entries as $entry) {
                    $stmt = $conn->prepare("
                        INSERT INTO fopag_eventos (colaborador_id, competencia, evento, tipo, origem, status, valor)
                        VALUES (:colaborador_id, :competencia, :evento, :tipo, :origem, :status, :valor)
                    ");
                    $stmt->execute([
                        'colaborador_id' => $entry['colaborador_id'],
                        'competencia'    => $entry['competencia'] ?? '',
                        'evento'         => $entry['evento'] ?? '',
                        'tipo'           => $entry['tipo'] ?? 'provento',
                        'origem'         => $entry['origem'] ?? 'manual',
                        'status'         => $entry['status'] ?? 'previsto',
                        'valor'          => $entry['valor'] ?? 0,
                    ]);
                    $ids[] = $conn->lastInsertId();
                }
                json_response(["ids" => array_map('strval', $ids), "message" => "Registros criados"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- HORAS EXTRAS --------------------
    case 'horasExtras':
        if ($method == 'GET') {
            try {
                $stmt = $conn->query("
                    SELECT he.*, u.login as usuario_login, o.nome as obra_nome
                    FROM horas_extras he
                    LEFT JOIN usuarios u ON he.usuario_id = u.id
                    LEFT JOIN obras o ON he.obra_id = o.id
                    ORDER BY he.data_registro DESC
                ");
                $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($entries as &$e) {
                    $e['id'] = (string)$e['id'];
                    $e['colaborador_id'] = (string)$e['colaborador_id'];
                    $e['horas'] = floatval($e['horas']);
                    $e['valor_hora'] = floatval($e['valor_hora']);
                    $e['quantidade_horas'] = floatval($e['horas']);
                    $e['valor_total'] = floatval($e['horas'] * $e['valor_hora']);
                    $e['competencia'] = date('Y-m', strtotime($e['data']));
                    $e['status'] = $e['aprovado'] ? 'aprovada' : 'pendente';
                }
                json_response($entries);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                $entries = is_array($input) && isset($input[0]) ? $input : [$input];
                $ids = [];
                foreach ($entries as $entry) {
                    $stmt = $conn->prepare("
                        INSERT INTO horas_extras 
                        (colaborador_id, competencia, data, horas, tipo, valor_hora, obra_id, status, aprovado, usuario_id)
                        VALUES (:colaborador_id, :competencia, :data, :horas, :tipo, :valor_hora, :obra_id, :status, :aprovado, :usuario_id)
                    ");
                    $stmt->execute([
                        'colaborador_id' => $entry['colaborador_id'],
                        'competencia'    => $entry['competencia'] ?? null,
                        'data'           => $entry['data'],
                        'horas'          => $entry['quantidade_horas'] ?? $entry['horas'] ?? 0,
                        'tipo'           => $entry['tipo'] ?? 'normal',
                        'valor_hora'     => $entry['valor_hora'] ?? 0,
                        'obra_id'        => $entry['obra_id'] ?? null,
                        'status'         => $entry['status'] ?? 'pendente',
                        'aprovado'       => ($entry['status'] ?? '') === 'aprovada' ? 1 : 0,
                        'usuario_id'     => $entry['usuario_id'] ?? null,
                    ]);
                    $ids[] = $conn->lastInsertId();
                }
                json_response(["ids" => array_map('strval', $ids), "message" => "Horas extras registradas"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- PROVISÕES --------------------
    case 'provisoes':
        if ($method == 'GET') {
            try {
                $stmt = $conn->query("
                    SELECT p.*, u.login as usuario_login
                    FROM provisoes p
                    LEFT JOIN usuarios u ON p.usuario_id = u.id
                    ORDER BY p.data_criacao DESC
                ");
                $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($entries as &$e) {
                    $e['id'] = (string)$e['id'];
                    $e['colaborador_id'] = (string)$e['colaborador_id'];
                    $e['valor'] = floatval($e['valor']);
                    $e['categoria'] = $e['tipo'];
                    $e['competencia'] = date('Y-m', strtotime($e['data_competencia']));
                    $e['status'] = 'prevista';
                }
                json_response($entries);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                $entries = is_array($input) && isset($input[0]) ? $input : [$input];
                $ids = [];
                foreach ($entries as $entry) {
                    $stmt = $conn->prepare("
                        INSERT INTO provisoes (colaborador_id, tipo, valor, data_competencia, observacao, usuario_id)
                        VALUES (:colaborador_id, :tipo, :valor, :data_competencia, :observacao, :usuario_id)
                    ");
                    $stmt->execute([
                        'colaborador_id' => $entry['colaborador_id'],
                        'tipo' => $entry['categoria'] ?? $entry['tipo'],
                        'valor' => $entry['valor'],
                        'data_competencia' => $entry['competencia'] . '-01',
                        'observacao' => $entry['observacao'] ?? null,
                        'usuario_id' => $entry['usuario_id'] ?? null,
                    ]);
                    $ids[] = $conn->lastInsertId();
                }
                json_response(["ids" => array_map('strval', $ids), "message" => "Provisões registradas"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- 13º SALÁRIO --------------------
    case 'decimoTerceiro':
        if ($method == 'GET') {
            try {
                $stmt = $conn->query("SELECT * FROM decimo_terceiro ORDER BY created_at DESC");
                $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($entries as &$e) {
                    $e['id'] = (string)$e['id'];
                    $e['colaborador_id'] = (string)$e['colaborador_id'];
                    $e['valor'] = floatval($e['valor']);
                }
                json_response($entries);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                $stmt = $conn->prepare("
                    INSERT INTO decimo_terceiro (colaborador_id, competencia, etapa, status, valor, origem)
                    VALUES (:colaborador_id, :competencia, :etapa, :status, :valor, :origem)
                ");
                $stmt->execute([
                    'colaborador_id' => $input['colaborador_id'],
                    'competencia' => $input['competencia'],
                    'etapa' => $input['etapa'],
                    'status' => $input['status'] ?? 'previsto',
                    'valor' => $input['valor'],
                    'origem' => $input['origem'] ?? 'folha',
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "13º registrado"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- SOLICITAÇÕES FINANCEIRAS --------------------
    case 'solicitacoesFinanceiras':
        if ($method == 'GET') {
            try {
                // Autorização por setor: não-GM só enxerga solicitações dos
                // setores concedidos em Permissões (+ as que ele mesmo criou).
                // GM vê tudo; sem a migração de permissões, degrada p/ tudo.
                $finPapel = papelSetorFin($conn, $authUser);
                $finFiltrar = $finPapel['aplicavel'] && !$finPapel['is_gm'];
                $finMeuId = (string)($authUser['user_id'] ?? '');
                if ($id) {
                    $stmt = $conn->prepare("
                        SELECT sf.*, f.nome as forma_pagamento_nome, o.nome as centro_custo_nome
                        FROM solicitacoes_financeiras sf
                        LEFT JOIN formas_pagamento f ON sf.forma_pagamento_id = f.id
                        LEFT JOIN obras o ON sf.centro_custo_id = o.id
                        WHERE sf.id = ?
                    ");
                    $stmt->execute([$id]);
                    $solicitacao = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($solicitacao) {
                        if ($finFiltrar) {
                            $slug = normalizarSetorLegadoFin($solicitacao['setor'] ?? '');
                            $criador = (string)($solicitacao['criado_por'] ?? '');
                            if (!in_array($slug, $finPapel['setores'], true) && $criador !== $finMeuId) {
                                json_response(["error" => "Não autorizado"], 403);
                            }
                        }
                        $solicitacao['id'] = (string)$solicitacao['id'];
                        if ($solicitacao['forma_pagamento_id']) $solicitacao['forma_pagamento_id'] = (string)$solicitacao['forma_pagamento_id'];
                        if ($solicitacao['centro_custo_id']) $solicitacao['centro_custo_id'] = (string)$solicitacao['centro_custo_id'];
                        $solicitacao['valor'] = floatval($solicitacao['valor']);
                        $solicitacao['pagamento_pendente'] = (bool)$solicitacao['pagamento_pendente'];
                        // Cast obrigatório: o MySQL devolve TINYINT como string, e "0" é
                        // truthy em JS. Sem ele toda solicitação viraria previsão na tela.
                        // O `?? false` cobre o intervalo entre o deploy e a migração.
                        $solicitacao['previsao'] = (bool)($solicitacao['previsao'] ?? false);
                        json_response($solicitacao);
                    } else {
                        json_response(["error" => "Solicitação não encontrada"], 404);
                    }
                } else {
                    if ($finFiltrar) {
                        $aceitos = setoresRawAceitosFin($finPapel['setores']);
                        if (empty($aceitos)) {
                            // Sem setores concedidos: só as próprias solicitações.
                            $finWhere = " WHERE sf.criado_por = ?";
                            $finParams = [$finMeuId];
                        } else {
                            $ph = implode(',', array_fill(0, count($aceitos), '?'));
                            $finWhere = " WHERE (LOWER(TRIM(sf.setor)) IN ($ph) OR sf.criado_por = ?)";
                            $finParams = array_merge($aceitos, [$finMeuId]);
                        }
                        $stmt = $conn->prepare("
                            SELECT sf.*, f.nome as forma_pagamento_nome, o.nome as centro_custo_nome
                            FROM solicitacoes_financeiras sf
                            LEFT JOIN formas_pagamento f ON sf.forma_pagamento_id = f.id
                            LEFT JOIN obras o ON sf.centro_custo_id = o.id
                            $finWhere
                            ORDER BY sf.created_at DESC
                        ");
                        $stmt->execute($finParams);
                    } else {
                        $stmt = $conn->query("
                            SELECT sf.*, f.nome as forma_pagamento_nome, o.nome as centro_custo_nome
                            FROM solicitacoes_financeiras sf
                            LEFT JOIN formas_pagamento f ON sf.forma_pagamento_id = f.id
                            LEFT JOIN obras o ON sf.centro_custo_id = o.id
                            ORDER BY sf.created_at DESC
                        ");
                    }
                    $solicitacoes = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($solicitacoes as &$s) {
                        $s['id'] = (string)$s['id'];
                        if ($s['forma_pagamento_id']) $s['forma_pagamento_id'] = (string)$s['forma_pagamento_id'];
                        if ($s['centro_custo_id']) $s['centro_custo_id'] = (string)$s['centro_custo_id'];
                        $s['valor'] = floatval($s['valor']);
                        $s['pagamento_pendente'] = (bool)$s['pagamento_pendente'];
                        $s['previsao'] = (bool)($s['previsao'] ?? false);
                    }
                    json_response($solicitacoes);
                }
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar solicitações: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                // Criação restrita ao setor: não-GM só cria solicitação em setor
                // concedido a ele em Permissões.
                $finPapelNovo = papelSetorFin($conn, $authUser);
                if ($finPapelNovo['aplicavel'] && !$finPapelNovo['is_gm']) {
                    $slugNovo = normalizarSetorLegadoFin($input['setor'] ?? '');
                    if (!in_array($slugNovo, $finPapelNovo['setores'], true)) {
                        json_response(["error" => "Não autorizado: setor fora do seu escopo"], 403);
                    }
                }
                $stmt = $conn->prepare("
                    INSERT INTO solicitacoes_financeiras
                    (setor, valor, data_pagamento, prazo_estimado, forma_pagamento_id, nivel_prioridade,
                     condicao_pagamento, centro_custo_id, solicitante, fornecedor, referencia, observacao,
                     pagamento_pendente, previsao, status, criado_por)
                    VALUES (:setor, :valor, :data_pagamento, :prazo_estimado, :forma_pagamento_id, :nivel_prioridade,
                            :condicao_pagamento, :centro_custo_id, :solicitante, :fornecedor, :referencia, :observacao,
                            :pagamento_pendente, :previsao, 'em_analise', :criado_por)
                ");
                $stmt->execute([
                    'setor' => $input['setor'] ?? '',
                    'valor' => $input['valor'] ?? 0,
                    'data_pagamento' => $input['data_pagamento'] ?? null,
                    'prazo_estimado' => $input['prazo_estimado'] ?? null,
                    'forma_pagamento_id' => $input['forma_pagamento_id'] ?? null,
                    'nivel_prioridade' => $input['nivel_prioridade'] ?? 'normal',
                    'condicao_pagamento' => $input['condicao_pagamento'] ?? null,
                    'centro_custo_id' => $input['centro_custo_id'] ?? null,
                    'solicitante' => $input['solicitante'] ?? '',
                    'fornecedor' => $input['fornecedor'] ?? null,
                    'referencia' => $input['referencia'] ?? null,
                    'observacao' => $input['observacao'] ?? null,
                    'pagamento_pendente' => isset($input['pagamento_pendente']) ? (int)(bool)$input['pagamento_pendente'] : 0,
                    'previsao' => isset($input['previsao']) ? (int)(bool)$input['previsao'] : 0,
                    'criado_por' => $input['criado_por'] ?? null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Solicitação criada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar solicitação: " . err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'PUT' && $id) {
            try {
                // Escrita restrita ao setor: não-GM não altera (aprovar/recusar/
                // cancelar/editar) solicitação de setor fora do seu escopo.
                if (!podeMexerSolicitacaoFin($conn, $authUser, $id)) {
                    json_response(["error" => "Não autorizado"], 403);
                }
                $fields = [];
                $params = ['id' => $id];
                $allowed = [
                    'setor', 'valor', 'data_pagamento', 'prazo_estimado', 'forma_pagamento_id',
                    'nivel_prioridade', 'condicao_pagamento', 'centro_custo_id', 'solicitante',
                    'fornecedor', 'referencia', 'observacao', 'status', 'comentario_aprovacao',
                    'pagamento_pendente', 'previsao'
                ];
                foreach ($allowed as $field) {
                    if (array_key_exists($field, $input)) {
                        $value = $input[$field];
                        if (in_array($field, ['pagamento_pendente', 'previsao'], true)) {
                            $value = (int)(bool)$value;
                        }
                        $fields[] = "$field = :$field";
                        $params[$field] = $value;
                    }
                }
                if (empty($fields)) {
                    json_response(["error" => "Nenhum campo para atualizar"], 400);
                    break;
                }
                $fields[] = "updated_at = NOW()";
                $sql = "UPDATE solicitacoes_financeiras SET " . implode(', ', $fields) . " WHERE id = :id";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                json_response(["message" => "Solicitação atualizada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar solicitação: " . err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- COMENTÁRIOS DE SOLICITAÇÕES --------------------
    case 'solicitacaoComentarios':
        if ($method == 'GET') {
            $solId = $_GET['solicitacao_id'] ?? null;
            try {
                // Mesma autorização por setor das solicitações: não-GM só recebe
                // comentários de solicitações que ele pode ver (setor concedido
                // ou criadas por ele). GM/host sem migração: sem filtro.
                $finPapel = papelSetorFin($conn, $authUser);
                $finFiltrar = $finPapel['aplicavel'] && !$finPapel['is_gm'];
                $finMeuId = (string)($authUser['user_id'] ?? '');

                $where = [];
                $params = [];
                if ($solId) { $where[] = "sc.solicitacao_id = ?"; $params[] = $solId; }
                $join = "";
                if ($finFiltrar) {
                    $join = " JOIN solicitacoes_financeiras sf ON sf.id = sc.solicitacao_id";
                    $aceitos = setoresRawAceitosFin($finPapel['setores']);
                    if (empty($aceitos)) {
                        $where[] = "sf.criado_por = ?";
                        $params[] = $finMeuId;
                    } else {
                        $ph = implode(',', array_fill(0, count($aceitos), '?'));
                        $where[] = "(LOWER(TRIM(sf.setor)) IN ($ph) OR sf.criado_por = ?)";
                        $params = array_merge($params, $aceitos, [$finMeuId]);
                    }
                }
                $sql = "SELECT sc.* FROM solicitacao_comentarios sc" . $join;
                if (count($where)) $sql .= " WHERE " . implode(" AND ", $where);
                $sql .= " ORDER BY sc.created_at ASC";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $comentarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($comentarios as &$c) {
                    $c['id'] = (string)$c['id'];
                    $c['solicitacao_id'] = (string)$c['solicitacao_id'];
                }
                json_response($comentarios);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        elseif ($method == 'POST') {
            try {
                // Não-GM só comenta em solicitação de setor no seu escopo.
                if (!podeMexerSolicitacaoFin($conn, $authUser, $input['solicitacao_id'] ?? null)) {
                    json_response(["error" => "Não autorizado"], 403);
                }
                $stmt = $conn->prepare("
                    INSERT INTO solicitacao_comentarios (solicitacao_id, campo, texto, autor)
                    VALUES (:solicitacao_id, :campo, :texto, :autor)
                ");
                $stmt->execute([
                    'solicitacao_id' => $input['solicitacao_id'],
                    'campo' => $input['campo'],
                    'texto' => $input['texto'],
                    'autor' => $input['autor'] ?? '',
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Comentário adicionado"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- APROVAR SOLICITAÇÃO --------------------
    case 'aprovarSolicitacao':
        if ($method == 'POST' && $id) {
            try {
                // Não-GM só aprova solicitação de setor no seu escopo.
                if (!podeMexerSolicitacaoFin($conn, $authUser, $id)) {
                    json_response(["error" => "Não autorizado"], 403);
                }
                $conn->beginTransaction();

                $stmt = $conn->prepare("UPDATE solicitacoes_financeiras SET status = 'aprovado', updated_at = NOW() WHERE id = ?");
                $stmt->execute([$id]);

                $stmt = $conn->prepare("SELECT * FROM solicitacoes_financeiras WHERE id = ?");
                $stmt->execute([$id]);
                $sol = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$sol) throw new Exception("Solicitação não encontrada");

                $stmtDesp = $conn->prepare("
                    INSERT INTO despesas (descricao, valor, data, categoria, forma_pagamento_id, obra_id, status, observacao)
                    VALUES (:descricao, :valor, :data, :categoria, :forma_pagamento_id, :obra_id, 'pendente', :observacao)
                ");
                $stmtDesp->execute([
                    'descricao' => $sol['referencia'] ?: $sol['setor'],
                    'valor' => $sol['valor'],
                    'data' => $sol['data_pagamento'] ?: date('Y-m-d'),
                    'categoria' => $sol['setor'],
                    'forma_pagamento_id' => $sol['forma_pagamento_id'],
                    'obra_id' => $sol['centro_custo_id'],
                    'observacao' => $sol['observacao'],
                ]);

                $conn->commit();
                json_response(["message" => "Solicitação aprovada e despesa criada"]);
            } catch (Exception $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
            break;
        }
        break;

    // -------------------- USUÁRIOS --------------------
    case 'usuarios':
        // Colunas da matriz de permissões (migração 2026_07_16). Sem elas o
        // código novo degrada para o comportamento antigo (sem erro 500).
        $temColunasMatriz = usuariosTemColunasMatriz($conn);

        // Quem é o solicitante. Criar/remover usuário e alterar QUALQUER campo
        // de identidade ou permissão (is_gm, acessos, matriz, papéis, login,
        // e-mail) é privativo do GM — sem isto um PUT com {"is_gm":1} no próprio
        // id transformava qualquer autenticado em GM.
        // Exceção deliberada: o próprio usuário troca a PRÓPRIA senha
        // (ChangePasswordDialog envia só `senha` para o seu id).
        $usuarioEhGmAqui = usuarioEhGm($conn, $authUser);
        $meuIdUsuarios   = (string)($authUser['user_id'] ?? '');

        // Mapeamento das chaves do frontend (PageKey) para as colunas da tabela usuarios
        $mapFrontendToDb = function($acessos) use ($temColunasMatriz) {
            $mapping = [
                'obras_div'   => 'acesso_obras',
                'rh'          => 'acesso_colaboradores',
                'patrimonios' => 'acesso_patrimonios',
                'frotas'      => 'acesso_frotas',
                'dp'          => 'acesso_dp',
                'admin'       => 'acesso_gm',
                'financeiro'  => 'acesso_financeiro',
                'contratos'   => 'acesso_contratos',
                'crm'         => 'acesso_crm'
            ];
            if ($temColunasMatriz) {
                $mapping['almoxarifado'] = 'acesso_compras';
            }
            // Valores aceitos por cada coluna ENUM. A matriz de permissões deriva
            // níveis legados (nenhum/visualizar/editar), mas acesso_financeiro é um
            // ENUM diferente (nenhum/visualizar/compras/financeiro) e não aceita
            // 'editar' — gravar 'editar' ali causa "Data truncated". Normalizamos
            // cada valor para um membro válido do ENUM da respectiva coluna.
            $enumFinanceiro = ['nenhum', 'visualizar', 'compras', 'financeiro'];
            $enumPadrao     = ['nenhum', 'visualizar', 'editar'];
            $normalizar = function($col, $val) use ($enumFinanceiro, $enumPadrao) {
                if (!is_string($val) || $val === '') return 'nenhum';
                // Colunas varchar aceitam qualquer valor curto.
                if (in_array($col, ['acesso_crm', 'acesso_compras'], true)) return $val;
                if ($col === 'acesso_financeiro') {
                    if (in_array($val, $enumFinanceiro, true)) return $val;
                    // 'editar' derivado da matriz => acesso total ao financeiro.
                    if ($val === 'editar') return 'financeiro';
                    return 'nenhum';
                }
                if (in_array($val, $enumPadrao, true)) return $val;
                // Níveis específicos do financeiro caindo em coluna padrão => edição.
                if ($val === 'compras' || $val === 'financeiro') return 'editar';
                return 'nenhum';
            };
            $dbFields = [];
            foreach ($mapping as $frontKey => $dbCol) {
                $dbFields[$dbCol] = $normalizar($dbCol, $acessos[$frontKey] ?? 'nenhum');
            }
            $dbFields['acesso_quadro'] = 'visualizar';
            $dbFields['acesso_quadro_patrimonios'] = 'visualizar';
            return $dbFields;
        };

        if ($method == 'GET') {
            try {
                $colsMatriz = $temColunasMatriz
                    ? ", matriz_permissoes, papeis_permissao, acesso_compras"
                    : "";
                $stmt = $conn->query("
                    SELECT id, login, email, is_gm,
                           acesso_quadro, acesso_colaboradores, acesso_obras, acesso_gm,
                           acesso_quadro_patrimonios, acesso_patrimonios,
                           acesso_dp, acesso_frotas, acesso_financeiro,
                           acesso_contratos, acesso_crm{$colsMatriz}
                    FROM usuarios
                ");
                $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $players = array_map(function($u) use ($temColunasMatriz) {
                    $player = [
                        'id' => (string)$u['id'],
                        'login' => $u['login'],
                        'email' => $u['email'],
                        'isGM' => (bool)$u['is_gm'],
                        'acessos' => [
                            'obras_div'   => $u['acesso_obras'],
                            'rh'          => $u['acesso_colaboradores'],
                            'patrimonios' => $u['acesso_patrimonios'],
                            'frotas'      => $u['acesso_frotas'],
                            'dp'          => $u['acesso_dp'] ?? 'nenhum',
                            'admin'       => $u['acesso_gm'] ?? 'nenhum',
                            'financeiro'  => $u['acesso_financeiro'] ?? 'nenhum',
                            'contratos'   => $u['acesso_contratos'] ?? 'nenhum',
                            'almoxarifado' => $u['acesso_compras'] ?? 'nenhum',
                            'crm'         => $u['acesso_crm'] ?? 'nenhum'
                        ]
                    ];
                    if ($temColunasMatriz) {
                        $player['matrizPermissoes'] = decodePermissaoJson($u['matriz_permissoes'] ?? null);
                        $player['papeisPermissao'] = decodePermissaoJson($u['papeis_permissao'] ?? null);
                    }
                    return $player;
                }, $usuarios);
                // Filtro opcional por SETOR (?setor=engenharia). Serve o campo
                // "Responsável por negociação" do cadastro de cliente, que só
                // pode listar usuários do setor Engenharia. Roda ANTES do
                // recorte de projeção abaixo: assim um usuário comum recebe a
                // lista certa sem aprender o mapa de permissões de ninguém.
                // Sem a migração 2026_07_16 não há em que filtrar — degrada
                // devolvendo a lista inteira (uma lista maior, não um vazamento).
                $setorFiltro = isset($_GET['setor']) ? normalizarSetorLegadoFin($_GET['setor']) : '';
                if ($setorFiltro !== '' && $temColunasMatriz) {
                    $players = array_values(array_filter($players, function($p) use ($setorFiltro) {
                        $papeis = $p['papeisPermissao'] ?? null;
                        $setores = (is_array($papeis) && isset($papeis['setores'])) ? $papeis['setores'] : [];
                        return in_array($setorFiltro, normalizarSetoresFin($setores), true);
                    }));
                }

                // A lista é consumida por telas comuns (CRM, NCs, comentários)
                // que só precisam de id/login. O mapa de permissões alheio é
                // dado privilegiado: fora do GM, cada um só enxerga o próprio.
                if (!$usuarioEhGmAqui) {
                    $players = array_map(function($p) use ($meuIdUsuarios) {
                        if ($p['id'] === $meuIdUsuarios) return $p;
                        return [
                            'id'    => $p['id'],
                            'login' => $p['login'],
                            'email' => $p['email'],
                            'isGM'  => $p['isGM'],
                        ];
                    }, $players);
                }
                json_response($players);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar usuários: " . err_detail($e)], 500);
            }
        }
        elseif ($method == 'POST') {
            exigirGm($conn, $authUser, 'a criação de usuários');
            try {
                $login = $input['login'] ?? '';
                $senha = (string)($input['senha'] ?? '');
                // SEC: nunca gravar senha em texto plano.
                if ($senha === '') json_response(["error" => "Senha obrigatória"], 400);
                $senha = password_hash($senha, PASSWORD_DEFAULT);
                $email = $input['email'] ?? '';
                // Frontend envia is_gm (snake_case); isGM aceito por compatibilidade.
                $is_gm = isset($input['is_gm']) ? (int)$input['is_gm']
                    : (isset($input['isGM']) ? (int)$input['isGM'] : 0);
    
                $acessosDb = [];
                if (isset($input['acessos']) && is_array($input['acessos'])) {
                    $acessosDb = $mapFrontendToDb($input['acessos']);
                } else {
                    $acessosDb = [
                        'acesso_obras' => 'visualizar',
                        'acesso_colaboradores' => 'visualizar',
                        'acesso_patrimonios' => 'visualizar',
                        'acesso_frotas' => 'nenhum',
                        'acesso_dp' => 'nenhum',
                        'acesso_gm' => 'nenhum',
                        'acesso_financeiro' => 'nenhum',
                        'acesso_contratos' => 'nenhum',
                        'acesso_crm' => 'nenhum',
                        'acesso_quadro' => 'visualizar',
                        'acesso_quadro_patrimonios' => 'visualizar'
                    ];
                }
    
                $stmt = $conn->prepare("
                    INSERT INTO usuarios (
                        login, senha, email, is_gm,
                        acesso_quadro, acesso_colaboradores, acesso_obras, acesso_gm,
                        acesso_quadro_patrimonios, acesso_patrimonios,
                        acesso_dp, acesso_frotas, acesso_financeiro, acesso_contratos, acesso_crm
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $login, $senha, $email, $is_gm,
                    $acessosDb['acesso_quadro'],
                    $acessosDb['acesso_colaboradores'],
                    $acessosDb['acesso_obras'],
                    $acessosDb['acesso_gm'],
                    $acessosDb['acesso_quadro_patrimonios'],
                    $acessosDb['acesso_patrimonios'],
                    $acessosDb['acesso_dp'],
                    $acessosDb['acesso_frotas'],
                    $acessosDb['acesso_financeiro'],
                    $acessosDb['acesso_contratos'] ?? 'nenhum',
                    $acessosDb['acesso_crm'] ?? 'nenhum'
                ]);
                $novoId = (string)$conn->lastInsertId();
                if ($temColunasMatriz) {
                    $extraCols = [];
                    $extraParams = [];
                    if (isset($input['matrizPermissoes'])) {
                        $extraCols[] = "matriz_permissoes = ?";
                        $extraParams[] = json_encode($input['matrizPermissoes']);
                    }
                    if (isset($input['papeisPermissao'])) {
                        $extraCols[] = "papeis_permissao = ?";
                        $extraParams[] = json_encode($input['papeisPermissao']);
                    }
                    if (isset($acessosDb['acesso_compras'])) {
                        $extraCols[] = "acesso_compras = ?";
                        $extraParams[] = $acessosDb['acesso_compras'];
                    }
                    if (!empty($extraCols)) {
                        $extraParams[] = $novoId;
                        $stmtExtra = $conn->prepare("UPDATE usuarios SET " . implode(', ', $extraCols) . " WHERE id = ?");
                        $stmtExtra->execute($extraParams);
                    }
                }
                logAudit($conn, $authUser ?? null, 'usuarios', $novoId, 'insert', null, ['login' => $input['login'] ?? null]);
                json_response(['id' => $novoId, 'message' => 'Usuário criado']);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar usuário: " . err_detail($e)], 500);
            }
        }
        elseif ($method == 'PUT' && $id) {
            // Não-GM só passa daqui para trocar a própria senha, e nada mais:
            // qualquer outra chave no corpo (login, email, is_gm, acessos,
            // matrizPermissoes, papeisPermissao) exige GM.
            if (!$usuarioEhGmAqui) {
                $camposEnviados = array_keys(is_array($input) ? $input : []);
                $apenasSenha = count(array_diff($camposEnviados, ['senha'])) === 0
                    && in_array('senha', $camposEnviados, true);
                if ((string)$id !== $meuIdUsuarios || !$apenasSenha) {
                    json_response([
                        "error" => "Permissão negada: apenas GM pode alterar dados de usuários."
                    ], 403);
                }
            }
            try {
                $fields = [];
                $params = [];

                if (isset($input['login']))   { $fields[] = "login = ?"; $params[] = $input['login']; }
                if (isset($input['senha']) && $input['senha'] !== '') {
                    $fields[] = "senha = ?";
                    $params[] = password_hash((string)$input['senha'], PASSWORD_DEFAULT);
                }
                if (isset($input['email']))   { $fields[] = "email = ?"; $params[] = $input['email']; }
                // Frontend envia is_gm (snake_case); isGM aceito por compatibilidade.
                if (isset($input['is_gm']))   { $fields[] = "is_gm = ?"; $params[] = (int)$input['is_gm']; }
                elseif (isset($input['isGM'])) { $fields[] = "is_gm = ?"; $params[] = (int)$input['isGM']; }

                if (isset($input['acessos']) && is_array($input['acessos'])) {
                    $acessosDb = $mapFrontendToDb($input['acessos']);
                    foreach ($acessosDb as $col => $val) {
                        $fields[] = "$col = ?";
                        $params[] = $val;
                    }
                }

                if ($temColunasMatriz) {
                    if (array_key_exists('matrizPermissoes', $input)) {
                        $fields[] = "matriz_permissoes = ?";
                        $params[] = $input['matrizPermissoes'] === null ? null : json_encode($input['matrizPermissoes']);
                    }
                    if (array_key_exists('papeisPermissao', $input)) {
                        $fields[] = "papeis_permissao = ?";
                        $params[] = $input['papeisPermissao'] === null ? null : json_encode($input['papeisPermissao']);
                    }
                }

                if (empty($fields)) {
                    json_response(["error" => "Nenhum campo para atualizar"], 400);
                    break;
                }

                $sql = "UPDATE usuarios SET " . implode(', ', $fields) . " WHERE id = ?";
                $params[] = $id;
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $auditPayload = $input;
                unset($auditPayload['senha'], $auditPayload['password']);
                logAudit($conn, $authUser ?? null, 'usuarios', $id, 'update', null, $auditPayload);
                json_response(["message" => "Usuário atualizado"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar usuário: " . err_detail($e)], 500);
            }
        }
        elseif ($method == 'DELETE' && $id) {
            exigirGm($conn, $authUser, 'a remoção de usuários');
            try {
                $stmt = $conn->prepare("DELETE FROM usuarios WHERE id = ? AND login != 'Cappucceno'");
                $stmt->execute([$id]);
                logAudit($conn, $authUser ?? null, 'usuarios', $id, 'delete');
                json_response(["message" => "Usuário removido"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao remover usuário: " . err_detail($e)], 500);
            }
        }
        break;

    // -------------------- CLIENTES --------------------
    case 'clientes':
        if ($method === 'GET') {
            try {
                if ($id) {
                    $stmt = $conn->prepare("SELECT * FROM clientes WHERE id = ?");
                    $stmt->execute([$id]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($row) {
                        $row['id'] = (string)$row['id'];
                        $row['ativa'] = (bool)$row['ativa'];
                        $row['responsaveisNegociacao'] = responsaveisDoClienteFin($conn, $id);
                        json_response($row);
                    } else {
                        json_response(["error" => "Cliente não encontrado"], 404);
                    }
                } else {
                    $stmt = $conn->query("SELECT * FROM clientes ORDER BY nome");
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    // Responsáveis por negociação: uma consulta só para a lista
                    // toda, agrupada aqui (evita N+1 no cadastro de clientes).
                    $respPorCliente = [];
                    if (clienteResponsaveisDisponivel($conn)) {
                        $stmtResp = $conn->query("SELECT cliente_id, usuario_id FROM cliente_responsaveis ORDER BY usuario_id");
                        foreach ($stmtResp->fetchAll(PDO::FETCH_ASSOC) as $vinculo) {
                            $respPorCliente[(string)$vinculo['cliente_id']][] = (string)$vinculo['usuario_id'];
                        }
                    }
                    foreach ($rows as &$r) {
                        $r['id'] = (string)$r['id'];
                        $r['ativa'] = (bool)$r['ativa'];
                        $r['responsaveisNegociacao'] = $respPorCliente[$r['id']] ?? [];
                    }
                    unset($r);
                    json_response($rows);
                }
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar clientes: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $cols = ['nome', 'cnpj', 'contato', 'email', 'ativa', 'nome_fantasia', 'telefone', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf', 'prazo_pagamento_dias', 'dias_fixos_pagamento', 'prazo_emitir_nf_dias', 'percentual_material', 'aliquota_iss', 'aliquota_inss', 'aliquota_cbs', 'aliquota_ibs', 'observacoes'];
                $placeholders = [];
                $params = [];
                foreach ($cols as $col) {
                    $placeholders[] = ":$col";
                    if ($col === 'ativa') {
                        $params[$col] = isset($input[$col]) ? (int)(bool)$input[$col] : 1;
                    } elseif ($col === 'dias_fixos_pagamento') {
                        $value = $input[$col] ?? [];
                        $params[$col] = is_array($value) ? json_encode($value) : json_encode([]);
                    } elseif (in_array($col, ['prazo_pagamento_dias', 'prazo_emitir_nf_dias', 'percentual_material', 'aliquota_iss', 'aliquota_inss', 'aliquota_cbs', 'aliquota_ibs'])) {
                        $value = $input[$col] ?? null;
                        $params[$col] = ($value !== '' && $value !== null) ? (float)$value : null;
                    } else {
                        $params[$col] = $input[$col] ?? null;
                    }
                }
                // `responsaveisNegociacao` não é coluna de `clientes` — vive na
                // tabela de junção `cliente_responsaveis`, gravada na mesma
                // transação para o cliente nunca nascer com carteira parcial.
                $conn->beginTransaction();
                $stmt = $conn->prepare("INSERT INTO clientes (" . implode(',', $cols) . ") VALUES (" . implode(',', $placeholders) . ")");
                $stmt->execute($params);
                $novoId = (int)$conn->lastInsertId();
                if (array_key_exists('responsaveisNegociacao', $input)) {
                    salvarResponsaveisClienteFin($conn, $novoId, $input['responsaveisNegociacao']);
                }
                $conn->commit();
                json_response(["id" => (string)$novoId, "message" => "Cliente criado"], 201);
            } catch (PDOException $e) {
                if ($conn->inTransaction()) $conn->rollBack();
                json_response(["error" => "Erro ao criar cliente: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $fields = [];
                $params = ['id' => $id];
                $allowed = ['nome', 'cnpj', 'contato', 'email', 'ativa', 'nome_fantasia', 'telefone', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf', 'prazo_pagamento_dias', 'dias_fixos_pagamento', 'prazo_emitir_nf_dias', 'percentual_material', 'aliquota_iss', 'aliquota_inss', 'aliquota_cbs', 'aliquota_ibs', 'observacoes'];
                foreach ($allowed as $f) {
                    if (!array_key_exists($f, $input)) continue;
                    $fields[] = "$f = :$f";
                    if ($f === 'ativa') {
                        $params[$f] = (int)(bool)$input[$f];
                    } elseif ($f === 'dias_fixos_pagamento') {
                        $value = $input[$f] ?? [];
                        $params[$f] = is_array($value) ? json_encode($value) : json_encode([]);
                    } elseif (in_array($f, ['prazo_pagamento_dias', 'prazo_emitir_nf_dias', 'percentual_material', 'aliquota_iss', 'aliquota_inss', 'aliquota_cbs', 'aliquota_ibs'])) {
                        $value = $input[$f] ?? null;
                        $params[$f] = ($value !== '' && $value !== null) ? (float)$value : null;
                    } else {
                        $params[$f] = $input[$f];
                    }
                }
                // Editar SÓ os responsáveis é uma edição válida: `$fields` vazio
                // não pode devolver 400 quando `responsaveisNegociacao` veio.
                $mexeResponsaveis = array_key_exists('responsaveisNegociacao', $input);
                if (empty($fields) && !$mexeResponsaveis) { json_response(["error" => "Nenhum campo"], 400); break; }
                $conn->beginTransaction();
                if (!empty($fields)) {
                    $stmt = $conn->prepare("UPDATE clientes SET " . implode(', ', $fields) . " WHERE id = :id");
                    $stmt->execute($params);
                }
                if ($mexeResponsaveis) {
                    salvarResponsaveisClienteFin($conn, (int)$id, $input['responsaveisNegociacao']);
                }
                $conn->commit();
                json_response(["message" => "Cliente atualizado"]);
            } catch (PDOException $e) {
                if ($conn->inTransaction()) $conn->rollBack();
                json_response(["error" => "Erro ao atualizar cliente: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE' && $id) {
            try {
                $stmt = $conn->prepare("UPDATE clientes SET ativa = 0 WHERE id = ?");
                $stmt->execute([$id]);
                json_response(["message" => "Cliente inativado"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao inativar cliente: " . err_detail($e)], 500);
            }
        }
        else {
            json_response(["error" => "Método não permitido"], 405);
        }
        break;

    // ==================== CRM ====================

    // -------------------- FUNIL: ESTÁGIOS --------------------
    case 'funil_estagios':
        if ($method === 'GET') {
            try {
                $stmt = $conn->query("SELECT id, chave, rotulo, ordem, ativo FROM funil_estagios WHERE ativo = 1 ORDER BY ordem");
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['ordem'] = (int)$r['ordem'];
                    $r['ativo'] = (bool)$r['ativo'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar estágios: " . err_detail($e)], 500);
            }
        } else {
            json_response(["error" => "Método não permitido"], 405);
        }
        break;

    // -------------------- OPORTUNIDADES --------------------
    case 'oportunidades':
        // Escopo de visibilidade: GM vê tudo; os demais veem as oportunidades
        // dos clientes da sua carteira ("Responsável por negociação") mais
        // aquelas em que são o responsável do card. Ver escopoOportunidadesFin().
        $escopoOport = escopoOportunidadesFin($conn, $authUser, 'l');
        $meuId = (int)($authUser['user_id'] ?? 0);

        $prepOportunidade = function($r) {
            if (!$r) return $r;
            $r['id'] = (string)$r['id'];
            $r['clienteId']      = isset($r['cliente_id']) && $r['cliente_id'] !== null ? (string)$r['cliente_id'] : null;
            $r['responsavelId']  = isset($r['responsavel_id']) && $r['responsavel_id'] !== null ? (string)$r['responsavel_id'] : null;
            $r['dataCriacao']    = $r['data_criacao'] ?? null;
            $r['valorEstimado']  = isset($r['valor_estimado']) ? (float)$r['valor_estimado'] : 0.0;
            unset($r['cliente_id'], $r['responsavel_id'], $r['data_criacao'], $r['valor_estimado']);
            return $r;
        };

        if ($method === 'GET') {
            try {
                $base = "SELECT l.* FROM oportunidades l";
                if ($id) {
                    // O mesmo predicado da lista decide o 403: fora do escopo,
                    // a consulta não devolve linha e a resposta não distingue
                    // "não existe" de "não é sua".
                    $sqlUm = "$base WHERE l.id = ?";
                    $paramsUm = [$id];
                    if ($escopoOport['sql'] !== '') {
                        $sqlUm .= " AND " . $escopoOport['sql'];
                        $paramsUm = array_merge($paramsUm, $escopoOport['params']);
                    }
                    $stmt = $conn->prepare($sqlUm);
                    $stmt->execute($paramsUm);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$row) json_response(["error" => "Oportunidade não encontrada"], 404);
                    json_response($prepOportunidade($row));
                } else {
                    $where = [];
                    $params = [];
                    if ($escopoOport['sql'] !== '') {
                        $where[] = $escopoOport['sql'];
                        $params = array_merge($params, $escopoOport['params']);
                    }
                    if (!empty($_GET['status']))      { $where[] = "l.status = ?";          $params[] = $_GET['status']; }
                    if (!empty($_GET['responsavel'])) { $where[] = "l.responsavel_id = ?";  $params[] = (int)$_GET['responsavel']; }
                    if (!empty($_GET['de']))          { $where[] = "l.data_criacao >= ?";   $params[] = $_GET['de']; }
                    if (!empty($_GET['ate']))         { $where[] = "l.data_criacao <= ?";   $params[] = $_GET['ate']; }
                    $sql = $base . (count($where) ? " WHERE " . implode(" AND ", $where) : "") . " ORDER BY l.data_criacao DESC";
                    $stmt = $conn->prepare($sql);
                    $stmt->execute($params);
                    $rows = array_map($prepOportunidade, $stmt->fetchAll(PDO::FETCH_ASSOC));
                    json_response($rows);
                }
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar oportunidades: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $stmt = $conn->prepare("INSERT INTO oportunidades (nome, email, telefone, empresa, origem, status, estagio, observacao, responsavel_id, cliente_id, servicos, valor_estimado, data_prevista_fechamento, temperatura_temperatura, contatos, local_obra, potencial_inicio_obra, potencial_termino_obra)
                    VALUES (:nome, :email, :telefone, :empresa, :origem, :status, :estagio, :observacao, :responsavel_id, :cliente_id, :servicos, :valor_estimado, :data_prevista_fechamento, :temperatura_temperatura, :contatos, :local_obra, :potencial_inicio_obra, :potencial_termino_obra)");
                $stmt->execute([
                    'nome'                     => $input['nome'] ?? '',
                    'email'                    => $input['email'] ?? null,
                    'telefone'                 => $input['telefone'] ?? null,
                    'empresa'                  => $input['empresa'] ?? null,
                    'origem'                   => $input['origem'] ?? null,
                    'status'                   => $input['status'] ?? 'novo',
                    'estagio'                  => $input['estagio'] ?? 'prospeccao',
                    'observacao'               => $input['observacao'] ?? null,
                    'responsavel_id'           => !empty($input['responsavelId']) ? (int)$input['responsavelId'] : ($meuId ?: null),
                    'cliente_id'               => !empty($input['clienteId']) ? (int)$input['clienteId'] : null,
                    'servicos'                 => isset($input['servicos']) && $input['servicos'] !== null ? json_encode($input['servicos']) : null,
                    'valor_estimado'           => isset($input['valorEstimado']) ? (float)$input['valorEstimado'] : 0,
                    'data_prevista_fechamento' => $input['dataPrevistaFechamento'] ?? null,
                    'temperatura_temperatura'  => $input['temperatura_temperatura'] ?? null,
                    'contatos'                 => isset($input['contatos']) && $input['contatos'] !== null ? json_encode($input['contatos']) : null,
                    'local_obra'               => $input['localObra'] ?? null,
                    'potencial_inicio_obra'    => $input['potencialInicioObra'] ?? null,
                    'potencial_termino_obra'   => $input['potencialTerminoObra'] ?? null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Oportunidade criada"], 201);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar oportunidade: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $map = [
                    'nome' => 'nome', 'email' => 'email', 'telefone' => 'telefone', 'empresa' => 'empresa',
                    'origem' => 'origem', 'status' => 'status', 'estagio' => 'estagio', 'observacao' => 'observacao',
                    'responsavelId' => 'responsavel_id', 'clienteId' => 'cliente_id', 'servicos' => 'servicos',
                    'valorEstimado' => 'valor_estimado', 'dataPrevistaFechamento' => 'data_prevista_fechamento',
                    'temperatura_temperatura' => 'temperatura_temperatura', 'contatos' => 'contatos',
                    'localObra' => 'local_obra', 'potencialInicioObra' => 'potencial_inicio_obra',
                    'potencialTerminoObra' => 'potencial_termino_obra',
                ];
                $fields = []; $params = ['id' => $id];
                foreach ($map as $frontKey => $col) {
                    if (!array_key_exists($frontKey, $input)) continue;
                    $v = $input[$frontKey];
                    if ($col === 'responsavel_id' || $col === 'cliente_id') $v = !empty($v) ? (int)$v : null;
                    if ($col === 'contatos' || $col === 'servicos') $v = $v !== null ? json_encode($v) : null;
                    $fields[] = "$col = :$col"; $params[$col] = $v;
                }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }
                $stmt = $conn->prepare("UPDATE oportunidades SET " . implode(', ', $fields) . " WHERE id = :id");
                $stmt->execute($params);
                json_response(["message" => "Oportunidade atualizada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar oportunidade: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE' && $id) {
            try {
                $stmt = $conn->prepare("DELETE FROM oportunidades WHERE id = ?");
                $stmt->execute([$id]);
                json_response(["message" => "Oportunidade removida"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao remover oportunidade: " . err_detail($e)], 500);
            }
        }
        else {
            json_response(["error" => "Método não permitido"], 405);
        }
        break;

    // -------------------- OPORTUNIDADE: MOVER NO FUNIL --------------------
    // POST { oportunidadeId, estagio } — muda o estágio e registra interação automática.
    case 'oportunidadeEstagio':
        if ($method === 'POST') {
            try {
                $oportunidadeId  = $input['oportunidadeId'] ?? $id ?? null;
                $novo    = $input['estagio'] ?? null;
                if (!$oportunidadeId || !$novo) json_response(["error" => "oportunidadeId e estagio são obrigatórios"], 400);

                $stmtCur = $conn->prepare("SELECT estagio FROM oportunidades WHERE id = ?");
                $stmtCur->execute([$oportunidadeId]);
                $atual = $stmtCur->fetchColumn();
                if ($atual === false) json_response(["error" => "Oportunidade não encontrada"], 404);

                if ($atual !== $novo) {
                    $conn->beginTransaction();
                    $conn->prepare("UPDATE oportunidades SET estagio = ? WHERE id = ?")->execute([$novo, $oportunidadeId]);
                    $rotulos = [];
                    foreach ($conn->query("SELECT chave, rotulo FROM funil_estagios")->fetchAll(PDO::FETCH_ASSOC) as $e)
                        $rotulos[$e['chave']] = $e['rotulo'];
                    $de  = $rotulos[$atual] ?? $atual;
                    $para = $rotulos[$novo] ?? $novo;
                    $conn->prepare("INSERT INTO interacoes (oportunidade_id, tipo, descricao, usuario_id) VALUES (?, 'mudanca_estagio', ?, ?)")
                         ->execute([$oportunidadeId, "Estágio: $de → $para", $authUser['user_id'] ?? null]);
                    $conn->commit();
                }
                json_response(["message" => "Estágio atualizado"]);
            } catch (PDOException $e) {
                if ($conn->inTransaction()) $conn->rollBack();
                json_response(["error" => "Erro ao mover oportunidade: " . err_detail($e)], 500);
            }
        } else {
            json_response(["error" => "Método não permitido"], 405);
        }
        break;

    // -------------------- OPORTUNIDADE: CONVERTER EM CLIENTE --------------------
    // POST { oportunidadeId } — cria cliente a partir da oportunidade (sem duplicar), amarra
    // cliente_id na oportunidade e oportunidade_origem_id no cliente, fecha oportunidade como ganho.
    case 'oportunidadeConverter':
        if ($method === 'POST') {
            try {
                $oportunidadeId = $input['oportunidadeId'] ?? $id ?? null;
                if (!$oportunidadeId) json_response(["error" => "oportunidadeId é obrigatório"], 400);

                $stmtL = $conn->prepare("SELECT * FROM oportunidades WHERE id = ?");
                $stmtL->execute([$oportunidadeId]);
                $oportunidade = $stmtL->fetch(PDO::FETCH_ASSOC);
                if (!$oportunidade) json_response(["error" => "Oportunidade não encontrada"], 404);

                // Idempotência: se já convertido, retorna o cliente existente.
                if (!empty($oportunidade['cliente_id'])) {
                    json_response(["id" => (string)$oportunidade['cliente_id'], "message" => "Oportunidade já convertida", "alreadyConverted" => true]);
                }

                $conn->beginTransaction();
                // Mapeamenta oportunidade → cliente (nome da empresa quando houver, senão o nome da oportunidade).
                $nomeCliente = !empty($oportunidade['empresa']) ? $oportunidade['empresa'] : $oportunidade['nome'];
                $stmtC = $conn->prepare("INSERT INTO clientes (nome, contato, email, telefone, ativa, oportunidade_origem_id) VALUES (?, ?, ?, ?, 1, ?)");
                $stmtC->execute([$nomeCliente, $oportunidade['nome'], $oportunidade['email'] ?? null, $oportunidade['telefone'] ?? null, $oportunidadeId]);
                $clienteId = $conn->lastInsertId();

                $conn->prepare("UPDATE oportunidades SET cliente_id = ?, estagio = 'fechado_ganho', status = 'convertido' WHERE id = ?")
                     ->execute([$clienteId, $oportunidadeId]);
                $conn->prepare("INSERT INTO interacoes (oportunidade_id, cliente_id, tipo, descricao, usuario_id) VALUES (?, ?, 'nota', 'Oportunidade convertida em cliente', ?)")
                     ->execute([$oportunidadeId, $clienteId, $authUser['user_id'] ?? null]);
                $conn->commit();

                json_response(["id" => (string)$clienteId, "message" => "Oportunidade convertida em cliente"], 201);
            } catch (PDOException $e) {
                if ($conn->inTransaction()) $conn->rollBack();
                json_response(["error" => "Erro ao converter oportunidade: " . err_detail($e)], 500);
            }
        } else {
            json_response(["error" => "Método não permitido"], 405);
        }
        break;

    // -------------------- OPORTUNIDADE: COMENTÁRIOS --------------------
    // Mesmo padrão de solicitacao_comentarios (Aprovação Financeira), com
    // updated_at para rastrear edições.
    case 'oportunidadeComentarios':
        $prepComentario = function($r) {
            if (!$r) return $r;
            $r['id'] = (string)$r['id'];
            $r['oportunidadeId'] = (string)$r['oportunidade_id'];
            unset($r['oportunidade_id']);
            return $r;
        };
        if ($method === 'GET') {
            try {
                $oportunidadeId = $_GET['oportunidade_id'] ?? null;
                $sql = "SELECT * FROM oportunidade_comentarios";
                $params = [];
                if ($oportunidadeId) { $sql .= " WHERE oportunidade_id = ?"; $params[] = $oportunidadeId; }
                $sql .= " ORDER BY created_at ASC";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = array_map($prepComentario, $stmt->fetchAll(PDO::FETCH_ASSOC));
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar comentários: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $oportunidadeId = $input['oportunidadeId'] ?? null;
                if (!$oportunidadeId || empty(trim($input['texto'] ?? ''))) {
                    json_response(["error" => "oportunidadeId e texto são obrigatórios"], 400);
                }
                $stmt = $conn->prepare("INSERT INTO oportunidade_comentarios (oportunidade_id, texto, autor) VALUES (:oportunidade_id, :texto, :autor)");
                $stmt->execute([
                    'oportunidade_id' => (int)$oportunidadeId,
                    'texto'   => $input['texto'],
                    'autor'   => $input['autor'] ?? '',
                ]);
                $stmt2 = $conn->prepare("SELECT * FROM oportunidade_comentarios WHERE id = ?");
                $stmt2->execute([$conn->lastInsertId()]);
                json_response($prepComentario($stmt2->fetch(PDO::FETCH_ASSOC)), 201);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao adicionar comentário: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                if (empty(trim($input['texto'] ?? ''))) json_response(["error" => "texto é obrigatório"], 400);
                $stmt = $conn->prepare("UPDATE oportunidade_comentarios SET texto = :texto, updated_at = NOW() WHERE id = :id");
                $stmt->execute(['texto' => $input['texto'], 'id' => $id]);
                $stmt2 = $conn->prepare("SELECT * FROM oportunidade_comentarios WHERE id = ?");
                $stmt2->execute([$id]);
                json_response($prepComentario($stmt2->fetch(PDO::FETCH_ASSOC)));
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar comentário: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE' && $id) {
            try {
                $conn->prepare("DELETE FROM oportunidade_comentarios WHERE id = ?")->execute([$id]);
                json_response(["message" => "Comentário removido"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao remover comentário: " . err_detail($e)], 500);
            }
        }
        else {
            json_response(["error" => "Método não permitido"], 405);
        }
        break;

    // -------------------- COMENTÁRIOS: COLABORADOR / PATRIMÔNIO / CONTRATO --------------------
    // Mesmo padrão de oportunidadeComentarios, via handler genérico.
    case 'colaboradorComentarios':
        handleComentariosEntidade($conn, $method, $id, $input, 'colaborador_comentarios', 'colaborador_id', 'colaboradorId', $authUser ?? null);
        break;
    case 'patrimonioComentarios':
        handleComentariosEntidade($conn, $method, $id, $input, 'patrimonio_comentarios', 'patrimonio_id', 'patrimonioId', $authUser ?? null);
        break;
    case 'contratoComentarios':
        handleComentariosEntidade($conn, $method, $id, $input, 'contrato_comentarios', 'contrato_id', 'contratoId', $authUser ?? null);
        break;

    // -------------------- INTERAÇÕES (histórico) --------------------
    case 'interacoes':
        $prepInt = function($r) {
            if (!$r) return $r;
            $r['id'] = (string)$r['id'];
            $r['oportunidadeId']    = isset($r['oportunidade_id']) && $r['oportunidade_id'] !== null ? (string)$r['oportunidade_id'] : null;
            $r['clienteId'] = isset($r['cliente_id']) && $r['cliente_id'] !== null ? (string)$r['cliente_id'] : null;
            $r['usuarioId'] = isset($r['usuario_id']) && $r['usuario_id'] !== null ? (string)$r['usuario_id'] : null;
            unset($r['oportunidade_id'], $r['cliente_id'], $r['usuario_id']);
            return $r;
        };
        if ($method === 'GET') {
            try {
                $where = []; $params = [];
                if (!empty($_GET['oportunidade_id']))    { $where[] = "i.oportunidade_id = ?";    $params[] = (int)$_GET['oportunidade_id']; }
                if (!empty($_GET['cliente_id'])) { $where[] = "i.cliente_id = ?"; $params[] = (int)$_GET['cliente_id']; }
                $limit  = isset($_GET['limit'])  ? max(1, min(200, (int)$_GET['limit'])) : 100;
                $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;
                $sql = "SELECT i.*, u.login AS usuario_login FROM interacoes i
                        LEFT JOIN usuarios u ON u.id = i.usuario_id"
                        . (count($where) ? " WHERE " . implode(" AND ", $where) : "")
                        . " ORDER BY i.data DESC LIMIT $limit OFFSET $offset";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                json_response(array_map($prepInt, $stmt->fetchAll(PDO::FETCH_ASSOC)));
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar interações: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $stmt = $conn->prepare("INSERT INTO interacoes (oportunidade_id, cliente_id, tipo, descricao, usuario_id)
                    VALUES (:oportunidade_id, :cliente_id, :tipo, :descricao, :usuario_id)");
                $stmt->execute([
                    'oportunidade_id'    => !empty($input['oportunidadeId']) ? (int)$input['oportunidadeId'] : null,
                    'cliente_id' => !empty($input['clienteId']) ? (int)$input['clienteId'] : null,
                    'tipo'       => $input['tipo'] ?? 'nota',
                    'descricao'  => $input['descricao'] ?? null,
                    'usuario_id' => $authUser['user_id'] ?? null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Interação registrada"], 201);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao registrar interação: " . err_detail($e)], 500);
            }
        }
        else {
            json_response(["error" => "Método não permitido"], 405);
        }
        break;

    // -------------------- ATIVIDADES (tarefas) --------------------
    case 'atividades':
        $prepAtiv = function($r) {
            if (!$r) return $r;
            $r['id'] = (string)$r['id'];
            $r['oportunidadeId'] = isset($r['oportunidade_id']) && $r['oportunidade_id'] !== null ? (string)$r['oportunidade_id'] : null;
            $r['usuarioResponsavel'] = isset($r['usuario_responsavel']) && $r['usuario_responsavel'] !== null ? (string)$r['usuario_responsavel'] : null;
            $r['dataVencimento'] = $r['data_vencimento'] ?? null;
            $r['concluida'] = (bool)$r['concluida'];
            unset($r['oportunidade_id'], $r['usuario_responsavel'], $r['data_vencimento']);
            return $r;
        };
        if ($method === 'GET') {
            try {
                if (!empty($_GET['oportunidade_id'])) {
                    $stmt = $conn->prepare("SELECT * FROM atividades WHERE oportunidade_id = ? ORDER BY data_vencimento IS NULL, data_vencimento ASC");
                    $stmt->execute([(int)$_GET['oportunidade_id']]);
                } else {
                    $stmt = $conn->query("SELECT * FROM atividades ORDER BY data_vencimento IS NULL, data_vencimento ASC");
                }
                json_response(array_map($prepAtiv, $stmt->fetchAll(PDO::FETCH_ASSOC)));
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao buscar atividades: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $stmt = $conn->prepare("INSERT INTO atividades (oportunidade_id, tipo, descricao, data_vencimento, concluida, usuario_responsavel)
                    VALUES (:oportunidade_id, :tipo, :descricao, :data, :concluida, :usuario)");
                $stmt->execute([
                    'oportunidade_id'   => !empty($input['oportunidadeId']) ? (int)$input['oportunidadeId'] : null,
                    'tipo'      => $input['tipo'] ?? null,
                    'descricao' => $input['descricao'] ?? null,
                    'data'      => !empty($input['dataVencimento']) ? $input['dataVencimento'] : null,
                    'concluida' => !empty($input['concluida']) ? 1 : 0,
                    'usuario'   => !empty($input['usuarioResponsavel']) ? (int)$input['usuarioResponsavel'] : ($authUser['user_id'] ?? null),
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Atividade criada"], 201);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar atividade: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $map = ['tipo'=>'tipo','descricao'=>'descricao','dataVencimento'=>'data_vencimento','concluida'=>'concluida'];
                $fields = []; $params = ['id' => $id];
                foreach ($map as $fk => $col) {
                    if (!array_key_exists($fk, $input)) continue;
                    $v = $input[$fk];
                    if ($col === 'concluida') $v = !empty($v) ? 1 : 0;
                    if ($col === 'data_vencimento') $v = !empty($v) ? $v : null;
                    $fields[] = "$col = :$col"; $params[$col] = $v;
                }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }
                $conn->prepare("UPDATE atividades SET " . implode(', ', $fields) . " WHERE id = :id")->execute($params);
                json_response(["message" => "Atividade atualizada"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao atualizar atividade: " . err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE' && $id) {
            try {
                $conn->prepare("DELETE FROM atividades WHERE id = ?")->execute([$id]);
                json_response(["message" => "Atividade removida"]);
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao remover atividade: " . err_detail($e)], 500);
            }
        }
        else {
            json_response(["error" => "Método não permitido"], 405);
        }
        break;

    // -------------------- CRM: ANALYTICS --------------------
    // GET ?tipo=funil|conversao|tempo_medio|pipeline|ranking|atividades [&de=&ate=]
    case 'crmStats':
        if ($method !== 'GET') { json_response(["error" => "Método não permitido"], 405); break; }
        $tipo = $_GET['tipo'] ?? 'funil';
        $de   = !empty($_GET['de'])  ? $_GET['de']  : null;
        $ate  = !empty($_GET['ate']) ? $_GET['ate'] : null;
        // Filtro de período sobre oportunidades.data_criacao (aplicado onde fizer sentido).
        $periodoWhere = '';
        $periodoParams = [];
        if ($de)  { $periodoWhere .= " AND l.data_criacao >= ?"; $periodoParams[] = $de; }
        if ($ate) { $periodoWhere .= " AND l.data_criacao <= ?"; $periodoParams[] = $ate; }
        // Mesmo recorte de carteira da rota `oportunidades` — sem ele os KPIs do
        // Dashboard entregariam totais da empresa inteira a quem só enxerga a
        // própria carteira no funil. Sempre concatenado DEPOIS de $periodoWhere,
        // então os params seguem a mesma ordem.
        $escopoStats  = escopoOportunidadesFin($conn, $authUser, 'l');
        $escopoWhere  = $escopoStats['sql'] !== '' ? " AND " . $escopoStats['sql'] : '';
        $escopoParams = $escopoStats['params'];
        $filtroWhere  = $periodoWhere . $escopoWhere;
        $filtroParams = array_merge($periodoParams, $escopoParams);
        $meuIdCrmStats = (int)($authUser['user_id'] ?? 0);
        try {
            if ($tipo === 'funil') {
                // Quantidade e valor (oportunidades.valor_estimado) por estágio, na ordem do funil.
                $sql = "SELECT fe.chave, fe.rotulo, fe.ordem,
                               COUNT(l.id) AS quantidade,
                               COALESCE(SUM(l.valor_estimado),0) AS valor
                        FROM funil_estagios fe
                        LEFT JOIN oportunidades l ON l.estagio = fe.chave $filtroWhere
                        WHERE fe.ativo = 1
                        GROUP BY fe.chave, fe.rotulo, fe.ordem
                        ORDER BY fe.ordem";
                $stmt = $conn->prepare($sql);
                $stmt->execute($filtroParams);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) { $r['quantidade'] = (int)$r['quantidade']; $r['valor'] = (float)$r['valor']; $r['ordem'] = (int)$r['ordem']; }
                json_response($rows);
            }
            elseif ($tipo === 'conversao') {
                // Taxa de conversão e tempo médio (dias) até fechar ganho.
                $sqlTot = "SELECT COUNT(*) FROM oportunidades l WHERE 1=1 $filtroWhere";
                $stmtT = $conn->prepare($sqlTot); $stmtT->execute($filtroParams); $total = (int)$stmtT->fetchColumn();
                $sqlGanho = "SELECT COUNT(*) FROM oportunidades l WHERE l.estagio = 'fechado_ganho' $filtroWhere";
                $stmtG = $conn->prepare($sqlGanho); $stmtG->execute($filtroParams); $ganhos = (int)$stmtG->fetchColumn();
                // Tempo médio: data_criacao -> última interação de conversão (nota 'Oportunidade convertida em cliente')
                $sqlTempo = "SELECT AVG(DATEDIFF(i.data, l.data_criacao)) AS dias
                             FROM oportunidades l JOIN interacoes i ON i.oportunidade_id = l.id
                             WHERE i.descricao = 'Oportunidade convertida em cliente' $filtroWhere";
                $stmtTm = $conn->prepare($sqlTempo); $stmtTm->execute($filtroParams);
                $diasMedio = $stmtTm->fetchColumn();
                json_response([
                    'total' => $total,
                    'ganhos' => $ganhos,
                    'taxa' => $total > 0 ? round($ganhos / $total * 100, 1) : 0,
                    'tempoMedioDias' => $diasMedio !== null ? round((float)$diasMedio, 1) : null,
                ]);
            }
            elseif ($tipo === 'pipeline') {
                // Receita em pipeline sobre as oportunidades abertas. Oportunidades não têm campo de
                // probabilidade, então a ponderação usa peso fixo por estágio do funil.
                // Alias `l` para o predicado de escopo casar (não usa período).
                $stmt = $conn->prepare("SELECT COALESCE(SUM(l.valor_estimado * CASE l.estagio
                                                 WHEN 'prospeccao'   THEN 0.10
                                                 WHEN 'qualificacao' THEN 0.25
                                                 WHEN 'proposta'     THEN 0.50
                                                 WHEN 'negociacao'   THEN 0.75
                                                 ELSE 0.50 END),0) AS ponderado,
                                             COALESCE(SUM(l.valor_estimado),0) AS bruto
                                      FROM oportunidades l
                                      WHERE l.estagio NOT IN ('fechado_ganho','fechado_perdido') $escopoWhere");
                $stmt->execute($escopoParams);
                $r = $stmt->fetch(PDO::FETCH_ASSOC);
                json_response(['ponderado' => (float)$r['ponderado'], 'bruto' => (float)$r['bruto']]);
            }
            elseif ($tipo === 'ranking') {
                // Oportunidades fechadas (ganho) e valor gerado por responsável.
                $sql = "SELECT u.id, u.login,
                               SUM(CASE WHEN l.estagio = 'fechado_ganho' THEN 1 ELSE 0 END) AS ganhos,
                               COALESCE(SUM(CASE WHEN l.estagio = 'fechado_ganho'
                                    THEN l.valor_estimado ELSE 0 END),0) AS valor
                        FROM usuarios u JOIN oportunidades l ON l.responsavel_id = u.id
                        WHERE 1=1 $filtroWhere
                        GROUP BY u.id, u.login
                        HAVING ganhos > 0 OR COUNT(l.id) > 0
                        ORDER BY valor DESC, ganhos DESC";
                $stmt = $conn->prepare($sql);
                $stmt->execute($filtroParams);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) { $r['id'] = (string)$r['id']; $r['ganhos'] = (int)$r['ganhos']; $r['valor'] = (float)$r['valor']; }
                json_response($rows);
            }
            elseif ($tipo === 'atividades') {
                $hoje = date('Y-m-d H:i:s');
                // Atividade herda o escopo da oportunidade-mãe; sem mãe, fica
                // com quem responde por ela — mesma lógica de "card sem cliente".
                $ativWhere = '';
                $ativParams = [];
                if ($escopoStats['sql'] !== '') {
                    $ativWhere = " AND ((a.oportunidade_id IS NULL AND a.usuario_responsavel = ?)"
                               . " OR EXISTS (SELECT 1 FROM oportunidades l WHERE l.id = a.oportunidade_id"
                               . " AND " . $escopoStats['sql'] . "))";
                    $ativParams = array_merge([$meuIdCrmStats], $escopoStats['params']);
                }
                $stmtV = $conn->prepare("SELECT COUNT(*) FROM atividades a WHERE a.concluida = 0 AND a.data_vencimento IS NOT NULL AND a.data_vencimento < ?$ativWhere");
                $stmtV->execute(array_merge([$hoje], $ativParams)); $vencidas = (int)$stmtV->fetchColumn();
                $stmtP = $conn->prepare("SELECT COUNT(*) FROM atividades a WHERE a.concluida = 0$ativWhere");
                $stmtP->execute($ativParams); $pend = (int)$stmtP->fetchColumn();
                $stmtC = $conn->prepare("SELECT COUNT(*) FROM atividades a WHERE a.concluida = 1$ativWhere");
                $stmtC->execute($ativParams); $conc = (int)$stmtC->fetchColumn();
                json_response(['vencidas' => $vencidas, 'pendentes' => $pend, 'concluidas' => $conc]);
            }
            else {
                json_response(["error" => "tipo inválido"], 400);
            }
        } catch (PDOException $e) {
            json_response(["error" => "Erro nas estatísticas CRM: " . err_detail($e)], 500);
        }
        break;

    // -------------------- RECEBIMENTOS --------------------
    case 'recebimentos':
        if ($method === 'GET') {
            try {
                if ($id) {
                    $stmt = $conn->prepare("SELECT * FROM recebimentos WHERE id = ?");
                    $stmt->execute([$id]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    json_response($row ?: ["error" => "Não encontrado"], $row ? 200 : 404);
                } else {
                    $obra_id = $_GET['obra_id'] ?? null;
                    if ($obra_id) {
                        $stmt = $conn->prepare("SELECT * FROM recebimentos WHERE obra_id = ? ORDER BY data_prevista");
                        $stmt->execute([$obra_id]);
                    } else {
                        $stmt = $conn->query("SELECT * FROM recebimentos ORDER BY data_prevista");
                    }
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($rows as &$r) {
                        $r['id'] = (string)$r['id'];
                        $r['obra_id'] = (string)$r['obra_id'];
                        $r['congelado'] = (bool)$r['congelado'];
                        $r['valor_previsto'] = (float)$r['valor_previsto'];
                        if (isset($r['valor_recebido'])) $r['valor_recebido'] = (float)$r['valor_recebido'];
                    }
                    json_response($rows);
                }
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $stmt = $conn->prepare("INSERT INTO recebimentos (obra_id, nota_fiscal_id, data_prevista, data_recebimento, valor_previsto, valor_recebido, status, origem, congelado, observacoes) VALUES (:obra_id, :nota_fiscal_id, :data_prevista, :data_recebimento, :valor_previsto, :valor_recebido, :status, :origem, :congelado, :observacoes)");
                $stmt->execute([
                    'obra_id' => $input['obra_id'] ?? null,
                    'nota_fiscal_id' => $input['nota_fiscal_id'] ?? null,
                    'data_prevista' => $input['data_prevista'] ?? null,
                    'data_recebimento' => $input['data_recebimento'] ?? null,
                    'valor_previsto' => $input['valor_previsto'] ?? 0,
                    'valor_recebido' => $input['valor_recebido'] ?? null,
                    'status' => $input['status'] ?? 'previsto',
                    'origem' => $input['origem'] ?? 'manual',
                    'congelado' => isset($input['congelado']) ? (int)(bool)$input['congelado'] : 0,
                    'observacoes' => $input['observacoes'] ?? null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId()], 201);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $allowed = ['data_prevista','data_recebimento','valor_previsto','valor_recebido','status','congelado','observacoes'];
                $fields = []; $params = ['id' => $id];
                foreach ($allowed as $f) {
                    if (!array_key_exists($f, $input)) continue;
                    $fields[] = "$f = :$f";
                    $params[$f] = ($f === 'congelado') ? (int)(bool)$input[$f] : $input[$f];
                }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }
                $stmt = $conn->prepare("UPDATE recebimentos SET " . implode(', ', $fields) . " WHERE id = :id");
                $stmt->execute($params);
                json_response(["message" => "Atualizado"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE' && $id) {
            $conn->prepare("DELETE FROM recebimentos WHERE id = ?")->execute([$id]);
            json_response(["message" => "Removido"]);
        }
        break;

    // -------------------- NOTAS FISCAIS --------------------
    case 'notas_fiscais':
        if ($method === 'GET') {
            try {
                $obra_id = $_GET['obra_id'] ?? null;
                if ($obra_id) {
                    $stmt = $conn->prepare("SELECT * FROM notas_fiscais WHERE obra_id = ? ORDER BY data_emissao DESC");
                    $stmt->execute([$obra_id]);
                } else {
                    $stmt = $conn->query("SELECT * FROM notas_fiscais ORDER BY data_emissao DESC");
                }
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['obra_id'] = (string)$r['obra_id'];
                    $r['valor'] = (float)($r['valor'] ?? 0);
                    $r['valor_liquido'] = (float)($r['valor_liquido'] ?? 0);
                    $r['inss_retido'] = (float)($r['inss_retido'] ?? 0);
                    $r['iss_retido'] = (float)($r['iss_retido'] ?? 0);
                    $r['retencao_cbs'] = (float)($r['retencao_cbs'] ?? 0);
                    $r['retencao_ibs'] = (float)($r['retencao_ibs'] ?? 0);
                    if ($r['medicao_id']) $r['medicao_id'] = (string)$r['medicao_id'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $stmt = $conn->prepare("INSERT INTO notas_fiscais (obra_id, medicao_id, numero, data_emissao, data_vencimento, valor, valor_liquido, status, inss_retido, iss_retido, retencao_cbs, retencao_ibs) VALUES (:obra_id,:medicao_id,:numero,:data_emissao,:data_vencimento,:valor,:valor_liquido,:status,:inss_retido,:iss_retido,:retencao_cbs,:retencao_ibs)");
                $stmt->execute([
                    'obra_id' => $input['obra_id'],
                    'medicao_id' => $input['medicao_id'] ?? null,
                    'numero' => $input['numero'] ?? null,
                    'data_emissao' => $input['data_emissao'] ?? null,
                    'data_vencimento' => $input['data_vencimento'] ?? null,
                    'valor' => $input['valor'] ?? 0,
                    'valor_liquido' => $input['valor_liquido'] ?? 0,
                    'status' => $input['status'] ?? 'rascunho',
                    'inss_retido' => $input['inss_retido'] ?? 0,
                    'iss_retido' => $input['iss_retido'] ?? 0,
                    'retencao_cbs' => $input['retencao_cbs'] ?? 0,
                    'retencao_ibs' => $input['retencao_ibs'] ?? 0,
                ]);
                json_response(["id" => (string)$conn->lastInsertId()], 201);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $allowed = ['numero','data_emissao','data_vencimento','valor','valor_liquido','status','inss_retido','iss_retido','retencao_cbs','retencao_ibs'];
                $fields = []; $params = ['id' => $id];
                foreach ($allowed as $f) {
                    if (!array_key_exists($f, $input)) continue;
                    $fields[] = "$f = :$f"; $params[$f] = $input[$f];
                }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }
                $stmt = $conn->prepare("UPDATE notas_fiscais SET " . implode(', ', $fields) . " WHERE id = :id");
                $stmt->execute($params);
                json_response(["message" => "Atualizado"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- MEDICOES --------------------
    case 'medicoes':
        if ($method === 'GET') {
            try {
                $obra_id = $_GET['obra_id'] ?? null;
                if ($obra_id) {
                    $stmt = $conn->prepare("SELECT * FROM medicoes WHERE obra_id = ? ORDER BY data_corte DESC");
                    $stmt->execute([$obra_id]);
                } else {
                    $stmt = $conn->query("SELECT * FROM medicoes ORDER BY data_corte DESC");
                }
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['obra_id'] = (string)$r['obra_id'];
                    $r['valor'] = (float)($r['valor'] ?? 0);
                    if ($r['nota_fiscal_id']) $r['nota_fiscal_id'] = (string)$r['nota_fiscal_id'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $stmt = $conn->prepare("INSERT INTO medicoes (obra_id, numero, data_corte, data_aprovacao, status, valor) VALUES (:obra_id,:numero,:data_corte,:data_aprovacao,:status,:valor)");
                $stmt->execute([
                    'obra_id' => $input['obra_id'],
                    'numero' => $input['numero'] ?? null,
                    'data_corte' => $input['data_corte'] ?? null,
                    'data_aprovacao' => $input['data_aprovacao'] ?? null,
                    'status' => $input['status'] ?? 'rascunho',
                    'valor' => $input['valor'] ?? 0,
                ]);
                json_response(["id" => (string)$conn->lastInsertId()], 201);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $allowed = ['numero','data_corte','data_aprovacao','status','valor'];
                $fields = []; $params = ['id' => $id];
                foreach ($allowed as $f) {
                    if (!array_key_exists($f, $input)) continue;
                    $fields[] = "$f = :$f"; $params[$f] = $input[$f];
                }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }
                $stmt = $conn->prepare("UPDATE medicoes SET " . implode(', ', $fields) . " WHERE id = :id");
                $stmt->execute($params);
                json_response(["message" => "Atualizado"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- BMS PREVISTAS --------------------
    case 'bms_previstas':
        if ($method === 'GET') {
            try {
                $obra_id = $_GET['obra_id'] ?? null;
                if ($obra_id) {
                    $stmt = $conn->prepare("SELECT * FROM bms_previstas WHERE obra_id = ? ORDER BY data_corte");
                    $stmt->execute([$obra_id]);
                } else {
                    $stmt = $conn->query("SELECT * FROM bms_previstas ORDER BY data_corte");
                }
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['obra_id'] = (string)$r['obra_id'];
                    $r['numero'] = (int)$r['numero'];
                    $r['valor_previsto_inicial'] = (float)($r['valor_previsto_inicial'] ?? 0);
                    $r['valor_previsto_dinamico'] = (float)($r['valor_previsto_dinamico'] ?? 0);
                    if ($r['medicao_id']) $r['medicao_id'] = (string)$r['medicao_id'];
                    if ($r['nota_fiscal_id']) $r['nota_fiscal_id'] = (string)$r['nota_fiscal_id'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $stmt = $conn->prepare("INSERT INTO bms_previstas (obra_id, medicao_id, nota_fiscal_id, numero, data_corte, data_pagamento_prevista, valor_previsto_inicial, valor_previsto_dinamico, status) VALUES (:obra_id,:medicao_id,:nota_fiscal_id,:numero,:data_corte,:data_pagamento_prevista,:valor_previsto_inicial,:valor_previsto_dinamico,:status)");
                $stmt->execute([
                    'obra_id' => $input['obra_id'],
                    'medicao_id' => $input['medicao_id'] ?? null,
                    'nota_fiscal_id' => $input['nota_fiscal_id'] ?? null,
                    'numero' => $input['numero'] ?? 1,
                    'data_corte' => $input['data_corte'] ?? null,
                    'data_pagamento_prevista' => $input['data_pagamento_prevista'] ?? null,
                    'valor_previsto_inicial' => $input['valor_previsto_inicial'] ?? 0,
                    'valor_previsto_dinamico' => $input['valor_previsto_dinamico'] ?? 0,
                    'status' => $input['status'] ?? 'aberta',
                ]);
                json_response(["id" => (string)$conn->lastInsertId()], 201);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $allowed = ['data_pagamento_prevista','valor_previsto_dinamico','status'];
                $fields = []; $params = ['id' => $id];
                foreach ($allowed as $f) {
                    if (!array_key_exists($f, $input)) continue;
                    $fields[] = "$f = :$f"; $params[$f] = $input[$f];
                }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }
                $stmt = $conn->prepare("UPDATE bms_previstas SET " . implode(', ', $fields) . " WHERE id = :id");
                $stmt->execute($params);
                json_response(["message" => "Atualizado"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- CENTROS CUSTO TOTVS --------------------
    case 'centros_custo_totvs':
        if ($method === 'GET') {
            try {
                $stmt = $conn->query("SELECT c.*, o.codigo as obra_codigo, o.nome as obra_nome FROM centros_custo_totvs c LEFT JOIN obras o ON o.id = c.obra_id ORDER BY c.codigo");
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    if ($r['obra_id']) $r['obra_id'] = (string)$r['obra_id'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $stmt = $conn->prepare("INSERT INTO centros_custo_totvs (codigo, descricao, tipo, obra_id, categoria) VALUES (:codigo, :descricao, :tipo, :obra_id, :categoria) ON DUPLICATE KEY UPDATE descricao=VALUES(descricao), tipo=VALUES(tipo), obra_id=VALUES(obra_id), categoria=VALUES(categoria)");
                $stmt->execute([
                    'codigo'    => $input['codigo'],
                    'descricao' => $input['descricao'] ?? null,
                    'tipo'      => $input['tipo'] ?? 'indireto',
                    'obra_id'   => $input['obra_id'] ?? null,
                    'categoria' => $input['categoria'] ?? null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId()], 201);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $allowed = ['codigo','descricao','tipo','obra_id','categoria'];
                $fields = []; $params = ['id' => $id];
                foreach ($allowed as $f) {
                    if (!array_key_exists($f, $input)) continue;
                    $fields[] = "$f = :$f"; $params[$f] = $input[$f];
                }
                if (empty($fields)) { json_response(["error" => "Nenhum campo"], 400); break; }
                $stmt = $conn->prepare("UPDATE centros_custo_totvs SET " . implode(', ', $fields) . " WHERE id = :id");
                $stmt->execute($params);
                json_response(["message" => "Atualizado"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE' && $id) {
            $conn->prepare("DELETE FROM centros_custo_totvs WHERE id = ?")->execute([$id]);
            json_response(["message" => "Removido"]);
        }
        break;

    // -------------------- FINANCEIRO SNAPSHOTS --------------------
    case 'financeiro_snapshots':
        if ($method === 'GET') {
            try {
                if ($id) {
                    $stmt = $conn->prepare("SELECT * FROM financeiro_snapshots WHERE id = ?");
                    $stmt->execute([$id]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($row) { $row['id'] = (string)$row['id']; $row['ativo'] = (bool)$row['ativo']; json_response($row); }
                    else json_response(["error" => "Não encontrado"], 404);
                } else {
                    // retorna o snapshot ativo mais recente
                    $ativo = $_GET['ativo'] ?? null;
                    if ($ativo !== null) {
                        $stmt = $conn->query("SELECT * FROM financeiro_snapshots WHERE ativo = 1 ORDER BY importado_em DESC LIMIT 1");
                        $row = $stmt->fetch(PDO::FETCH_ASSOC);
                        if ($row) { $row['id'] = (string)$row['id']; $row['ativo'] = true; json_response($row); }
                        else json_response(null);
                    } else {
                        $stmt = $conn->query("SELECT * FROM financeiro_snapshots ORDER BY importado_em DESC");
                        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($rows as &$r) { $r['id'] = (string)$r['id']; $r['ativo'] = (bool)$r['ativo']; }
                        json_response($rows);
                    }
                }
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                // Desativa snapshots anteriores
                $conn->exec("UPDATE financeiro_snapshots SET ativo = 0");
                $stmt = $conn->prepare("INSERT INTO financeiro_snapshots (periodo_ref, total_titulos, ativo) VALUES (:periodo_ref, :total_titulos, 1)");
                $stmt->execute([
                    'periodo_ref'   => $input['periodo_ref'] ?? null,
                    'total_titulos' => $input['total_titulos'] ?? 0,
                ]);
                $snapshotId = $conn->lastInsertId();
                // Insere os lançamentos em lote se enviados
                if (!empty($input['lancamentos']) && is_array($input['lancamentos'])) {
                    $ins = $conn->prepare("INSERT INTO financeiro_lancamentos (snapshot_id, obra_id, centro_custo, desc_centro_custo, grupo, subgrupo, cod_natureza, desc_natureza, ref_lancamento, contraparte, data_vencimento, mes_competencia, status_cod, status_label, valor_rateio, valor_liquido) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
                    foreach ($input['lancamentos'] as $l) {
                        $ins->execute([
                            $snapshotId,
                            $l['obra_id'] ?? null,
                            $l['centro_custo'] ?? null,
                            $l['desc_centro_custo'] ?? null,
                            $l['grupo'] ?? null,
                            $l['subgrupo'] ?? null,
                            $l['cod_natureza'] ?? null,
                            $l['desc_natureza'] ?? null,
                            $l['ref_lancamento'] ?? null,
                            $l['contraparte'] ?? null,
                            $l['data_vencimento'] ?? null,
                            $l['mes_competencia'] ?? null,
                            $l['status_cod'] ?? null,
                            $l['status_label'] ?? null,
                            $l['valor_rateio'] ?? 0,
                            $l['valor_liquido'] ?? 0,
                        ]);
                    }
                    // Atualiza total_titulos
                    $conn->prepare("UPDATE financeiro_snapshots SET total_titulos = ? WHERE id = ?")->execute([count($input['lancamentos']), $snapshotId]);
                }
                json_response(["id" => (string)$snapshotId, "message" => "Snapshot criado"], 201);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- FINANCEIRO LANCAMENTOS --------------------
    case 'financeiro_lancamentos':
        if ($method === 'GET') {
            try {
                $snapshot_id = $_GET['snapshot_id'] ?? null;
                $obra_id = $_GET['obra_id'] ?? null;
                $sql = "SELECT fl.*, o.codigo as obra_codigo, o.nome as obra_nome FROM financeiro_lancamentos fl LEFT JOIN obras o ON o.id = fl.obra_id";
                $params = [];
                $where = [];
                if ($snapshot_id) { $where[] = "fl.snapshot_id = ?"; $params[] = $snapshot_id; }
                if ($obra_id) { $where[] = "fl.obra_id = ?"; $params[] = $obra_id; }
                // Se nem snapshot nem obra, usa o snapshot ativo
                if (empty($where)) {
                    $row = $conn->query("SELECT id FROM financeiro_snapshots WHERE ativo = 1 ORDER BY importado_em DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                    if ($row) { $where[] = "fl.snapshot_id = ?"; $params[] = $row['id']; }
                }
                if (!empty($where)) $sql .= " WHERE " . implode(' AND ', $where);
                $sql .= " ORDER BY fl.mes_competencia, fl.grupo";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['snapshot_id'] = (string)$r['snapshot_id'];
                    if ($r['obra_id']) $r['obra_id'] = (string)$r['obra_id'];
                    $r['valor_rateio'] = (float)($r['valor_rateio'] ?? 0);
                    $r['valor_liquido'] = (float)($r['valor_liquido'] ?? 0);
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // ==============================================
    // MÓDULO DP — persistência MySQL (migrada do Supabase)
    // Requer migração 2026_07_17_dp_persistencia_mysql.sql
    // ==============================================

    // -------------------- DP HOLERITES --------------------
    case 'dpHolerites':
        if ($method === 'GET') {
            try {
                if (!empty($_GET['ultima'])) {
                    // Última importação: competência mais recente por imported_at
                    $row = $conn->query("SELECT competencia, imported_at FROM dp_holerite ORDER BY imported_at DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                    if (!$row) json_response(null);
                    $stmt = $conn->prepare("SELECT COUNT(*) FROM dp_holerite WHERE competencia = ?");
                    $stmt->execute([$row['competencia']]);
                    json_response([
                        'competencia' => $row['competencia'],
                        'count'       => (int)$stmt->fetchColumn(),
                        'imported_at' => $row['imported_at'],
                    ]);
                }
                $stmt = $conn->query("SELECT * FROM dp_holerite ORDER BY competencia DESC, nome_lido ASC LIMIT 100000");
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $dec = json_decode($r['verbas'] ?? '[]', true);
                    $r['verbas'] = is_array($dec) ? $dec : [];
                    foreach (['proventos','descontos','liquido','base_inss','inss','base_irrf','irrf','base_fgts','fgts',
                              'provisao_13','inss_provisao_13','fgts_provisao_13','provisao_ferias','inss_provisao_ferias',
                              'fgts_provisao_ferias','inss_empresa','rat','inss_terceiros','salario_base',
                              'horas_extras_valor','custo_total'] as $f) {
                        $r[$f] = (float)($r[$f] ?? 0);
                    }
                    $r['fator_k'] = $r['fator_k'] === null ? null : (float)$r['fator_k'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            // Upsert em lote na chave (cpf, competencia, tipo).
            $rows = $input['rows'] ?? null;
            if (!is_array($rows) || count($rows) === 0) {
                json_response(["error" => "Payload deve conter 'rows' (array não vazio)."], 400);
            }
            $numFields = ['proventos','descontos','liquido','base_inss','inss','base_irrf','irrf','base_fgts','fgts',
                          'provisao_13','inss_provisao_13','fgts_provisao_13','provisao_ferias','inss_provisao_ferias',
                          'fgts_provisao_ferias','inss_empresa','rat','inss_terceiros','salario_base','horas_extras_valor'];
            try {
                $conn->beginTransaction();
                $cols = array_merge(
                    ['tipo','colaborador_id','cpf','competencia','nome_lido','matricula_lida','cargo_lido',
                     'centro_custo_nome_lido','admissao'],
                    $numFields,
                    ['custo_total','fator_k','verbas','origem','imported_at']
                );
                $updatable = array_diff($cols, ['cpf','competencia','tipo']);
                $sql = "INSERT INTO dp_holerite (" . implode(',', $cols) . ") VALUES ("
                     . implode(',', array_map(function($c){ return ":$c"; }, $cols)) . ")"
                     . " ON DUPLICATE KEY UPDATE "
                     . implode(',', array_map(function($c){ return "$c = VALUES($c)"; }, $updatable));
                $stmt = $conn->prepare($sql);
                $count = 0;
                foreach ($rows as $r) {
                    if (empty($r['cpf']) || empty($r['competencia'])) continue;
                    $p = [
                        'tipo'                   => $r['tipo'] ?? 'holerite',
                        'colaborador_id'         => $r['colaborador_id'] ?? null,
                        'cpf'                    => $r['cpf'],
                        'competencia'            => $r['competencia'],
                        'nome_lido'              => $r['nome_lido'] ?? null,
                        'matricula_lida'         => $r['matricula_lida'] ?? null,
                        'cargo_lido'             => $r['cargo_lido'] ?? null,
                        'centro_custo_nome_lido' => $r['centro_custo_nome_lido'] ?? null,
                        'admissao'               => ($r['admissao'] ?? '') !== '' ? $r['admissao'] : null,
                    ];
                    foreach ($numFields as $f) $p[$f] = (float)($r[$f] ?? 0);
                    // Espelha as colunas geradas do schema Supabase original
                    $custo = $p['proventos'] + $p['inss_empresa'] + $p['rat'] + $p['inss_terceiros']
                           + $p['fgts'] + $p['provisao_13'] + $p['provisao_ferias'];
                    $p['custo_total'] = $custo;
                    $p['fator_k'] = $p['salario_base'] > 0 ? $custo / $p['salario_base'] : null;
                    $p['verbas'] = json_encode(is_array($r['verbas'] ?? null) ? $r['verbas'] : [], JSON_UNESCAPED_UNICODE);
                    $p['origem'] = $r['origem'] ?? 'holerite_xls';
                    $p['imported_at'] = $r['imported_at'] ?? date('Y-m-d H:i:s');
                    // ISO 8601 → DATETIME MySQL
                    $p['imported_at'] = date('Y-m-d H:i:s', strtotime($p['imported_at']));
                    $stmt->execute($p);
                    $count++;
                }
                $conn->commit();
                json_response(["inserted" => $count]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE') {
            $competencia = $_GET['competencia'] ?? '';
            if (!preg_match('/^[0-9]{4}-(0[1-9]|1[0-2])$/', $competencia)) {
                json_response(["error" => "Competência inválida (use YYYY-MM)."], 400);
            }
            try {
                $stmt = $conn->prepare("DELETE FROM dp_holerite WHERE competencia = ?");
                $stmt->execute([$competencia]);
                json_response(["deleted" => $stmt->rowCount()]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- PONTO IMPORTAÇÕES --------------------
    case 'pontoImportacoes':
        if ($method === 'GET') {
            // Cargas que se sobrepõem ao período consultado — proveniência dos números
            // da Análise de Ponto e conteúdo da aba Sincronizações.
            $ini = $_GET['inicio'] ?? null;
            $fim = $_GET['fim'] ?? null;
            try {
                $sql = "SELECT id, arquivo_nome, periodo_inicio, periodo_fim, total_registros,
                               total_colaboradores, importado_por, importado_em
                        FROM ponto_importacoes";
                $params = [];
                if ($ini && $fim) {
                    $sql .= " WHERE periodo_inicio <= ? AND periodo_fim >= ?";
                    $params = [$fim, $ini];
                }
                $sql .= " ORDER BY importado_em DESC LIMIT 500";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    foreach (['total_registros','total_colaboradores'] as $n) $r[$n] = (int)$r[$n];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $stmt = $conn->prepare("
                    INSERT INTO ponto_importacoes
                        (arquivo_nome, periodo_inicio, periodo_fim, total_registros, total_colaboradores, importado_por, importado_em)
                    VALUES (:arquivo_nome, :periodo_inicio, :periodo_fim, :total_registros, :total_colaboradores, :importado_por, NOW())
                ");
                $stmt->execute([
                    'arquivo_nome'        => $input['arquivo_nome'] ?? '',
                    'periodo_inicio'      => $input['periodo_inicio'],
                    'periodo_fim'         => $input['periodo_fim'],
                    'total_registros'     => (int)($input['total_registros'] ?? 0),
                    'total_colaboradores' => (int)($input['total_colaboradores'] ?? 0),
                    'importado_por'       => $input['importado_por'] ?? null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId()]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE') {
            $ini = $_GET['periodo_inicio'] ?? null;
            $fim = $_GET['periodo_fim'] ?? null;
            if (!$ini || !$fim) json_response(["error" => "periodo_inicio e periodo_fim são obrigatórios."], 400);
            try {
                // FK ON DELETE CASCADE remove os ponto_registros vinculados
                $stmt = $conn->prepare("DELETE FROM ponto_importacoes WHERE periodo_inicio = ? AND periodo_fim = ?");
                $stmt->execute([$ini, $fim]);
                json_response(["deleted" => $stmt->rowCount()]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- PONTO REGISTROS --------------------
    case 'pontoRegistros':
        if ($method === 'GET') {
            $ini = $_GET['inicio'] ?? null;
            $fim = $_GET['fim'] ?? null;
            if (!$ini || !$fim) json_response(["error" => "inicio e fim são obrigatórios."], 400);
            try {
                $sql = "SELECT id, colaborador_id, nome_csv, cpf_csv, matricula_csv, departamento_csv, obra_id, centro_indireto, agregado, data,
                               horas_previstas_min, horas_trabalhadas_min, horas_falta_min, dias_falta_qtd,
                               horas_extra_50_min, horas_extra_60_min, horas_extra_100_min, horas_compensadas_min,
                               interjornada_min, banco_saldo_min, marcacao_invalida, falta, atestado, observacao
                        FROM ponto_registros WHERE data >= ? AND data <= ?";
                $params = [$ini, $fim];
                $obraIds = isset($_GET['obra_ids']) && $_GET['obra_ids'] !== ''
                    ? array_values(array_filter(explode(',', $_GET['obra_ids']), 'strlen'))
                    : [];
                if (count($obraIds) > 0) {
                    $sql .= " AND obra_id IN (" . implode(',', array_fill(0, count($obraIds), '?')) . ")";
                    $params = array_merge($params, $obraIds);
                }
                $sql .= " ORDER BY data LIMIT 100000";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    if ($r['colaborador_id'] !== null) $r['colaborador_id'] = (string)$r['colaborador_id'];
                    if ($r['obra_id'] !== null) $r['obra_id'] = (string)$r['obra_id'];
                    foreach (['centro_indireto','agregado','marcacao_invalida','falta','atestado'] as $b) $r[$b] = ((int)$r[$b]) === 1;
                    foreach (['horas_previstas_min','horas_trabalhadas_min','horas_falta_min','dias_falta_qtd',
                              'horas_extra_50_min','horas_extra_60_min','horas_extra_100_min','horas_compensadas_min',
                              'interjornada_min','banco_saldo_min'] as $n) $r[$n] = (int)$r[$n];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $rows = $input['rows'] ?? null;
            if (!is_array($rows) || count($rows) === 0) {
                json_response(["error" => "Payload deve conter 'rows' (array não vazio)."], 400);
            }
            try {
                // O JSON cru e o idPerson só existem depois de 2026_08_03_ponto_ondas.sql.
                // Sem esta checagem, publicar o api.php antes de aplicar a migração
                // quebraria toda a importação de ponto.
                $temColunasOnda1 = $conn
                    ->query("SHOW COLUMNS FROM ponto_registros LIKE 'payload'")
                    ->fetch(PDO::FETCH_ASSOC) !== false;

                $conn->beginTransaction();
                $colunasExtra = $temColunasOnda1 ? ", payload, rhid_id_person" : "";
                $valoresExtra = $temColunasOnda1 ? ", :payload, :rhid_id_person" : "";
                $stmt = $conn->prepare("
                    INSERT INTO ponto_registros
                        (importacao_id, colaborador_id, nome_csv, matricula_csv, cpf_csv, departamento_csv, obra_id,
                         centro_indireto, agregado, data, horas_previstas_min, horas_trabalhadas_min, horas_falta_min,
                         dias_falta_qtd, horas_extra_50_min, horas_extra_60_min, horas_extra_100_min,
                         horas_compensadas_min, interjornada_min, banco_saldo_min, marcacao_invalida, falta, atestado, observacao{$colunasExtra})
                    VALUES (:importacao_id, :colaborador_id, :nome_csv, :matricula_csv, :cpf_csv, :departamento_csv, :obra_id,
                            :centro_indireto, :agregado, :data, :horas_previstas_min, :horas_trabalhadas_min, :horas_falta_min,
                            :dias_falta_qtd, :horas_extra_50_min, :horas_extra_60_min, :horas_extra_100_min,
                            :horas_compensadas_min, :interjornada_min, :banco_saldo_min, :marcacao_invalida, :falta, :atestado, :observacao{$valoresExtra})
                ");
                $count = 0;
                foreach ($rows as $r) {
                    $campos = [
                        'importacao_id'         => $r['importacao_id'],
                        'colaborador_id'        => $r['colaborador_id'] ?? null,
                        'nome_csv'              => $r['nome_csv'] ?? '',
                        'matricula_csv'         => $r['matricula_csv'] ?? null,
                        'cpf_csv'               => $r['cpf_csv'] ?? null,
                        'departamento_csv'      => $r['departamento_csv'] ?? null,
                        'obra_id'               => $r['obra_id'] ?? null,
                        'centro_indireto'       => !empty($r['centro_indireto']) ? 1 : 0,
                        'agregado'              => !empty($r['agregado']) ? 1 : 0,
                        'data'                  => $r['data'],
                        'horas_previstas_min'   => (int)($r['horas_previstas_min'] ?? 0),
                        'horas_trabalhadas_min' => (int)($r['horas_trabalhadas_min'] ?? 0),
                        'horas_falta_min'       => (int)($r['horas_falta_min'] ?? 0),
                        'dias_falta_qtd'        => (int)($r['dias_falta_qtd'] ?? 0),
                        'horas_extra_50_min'    => (int)($r['horas_extra_50_min'] ?? 0),
                        'horas_extra_60_min'    => (int)($r['horas_extra_60_min'] ?? 0),
                        'horas_extra_100_min'   => (int)($r['horas_extra_100_min'] ?? 0),
                        'horas_compensadas_min' => (int)($r['horas_compensadas_min'] ?? 0),
                        'interjornada_min'      => (int)($r['interjornada_min'] ?? 0),
                        'banco_saldo_min'       => (int)($r['banco_saldo_min'] ?? 0),
                        'marcacao_invalida'     => !empty($r['marcacao_invalida']) ? 1 : 0,
                        'falta'                 => !empty($r['falta']) ? 1 : 0,
                        'atestado'              => !empty($r['atestado']) ? 1 : 0,
                        'observacao'            => $r['observacao'] ?? null,
                    ];
                    if ($temColunasOnda1) {
                        $bruto = $r['payload'] ?? null;
                        $campos['payload'] = is_string($bruto) || $bruto === null
                            ? $bruto
                            : json_encode($bruto, JSON_UNESCAPED_UNICODE);
                        $campos['rhid_id_person'] = isset($r['rhid_id_person']) && $r['rhid_id_person'] !== null
                            ? (int)$r['rhid_id_person']
                            : null;
                    }
                    $stmt->execute($campos);
                    $count++;
                }
                $conn->commit();
                json_response(["inserted" => $count]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- PONTO ESPELHO (por colaborador) --------------------
    // Dia a dia de uma pessoa, com o JSON cru da apuração. Só aqui o `payload`
    // trafega: no GET de lista ele multiplicaria o tamanho da resposta.
    case 'pontoEspelho':
        if ($method === 'GET') {
            $ini   = $_GET['inicio'] ?? null;
            $fim   = $_GET['fim'] ?? null;
            $colab = $_GET['colaborador_id'] ?? null;
            $nome  = $_GET['nome'] ?? null;
            if (!$ini || !$fim) json_response(["error" => "inicio e fim são obrigatórios."], 400);
            if (!$colab && !$nome) json_response(["error" => "Informe colaborador_id ou nome."], 400);
            try {
                $temPayload = $conn
                    ->query("SHOW COLUMNS FROM ponto_registros LIKE 'payload'")
                    ->fetch(PDO::FETCH_ASSOC) !== false;
                $extra = $temPayload ? ", payload, rhid_id_person" : "";
                $sql = "SELECT id, colaborador_id, nome_csv, cpf_csv, matricula_csv, departamento_csv, obra_id,
                               centro_indireto, agregado, data, horas_previstas_min, horas_trabalhadas_min,
                               horas_falta_min, dias_falta_qtd, horas_extra_50_min, horas_extra_60_min,
                               horas_extra_100_min, horas_compensadas_min, interjornada_min, banco_saldo_min,
                               marcacao_invalida, falta, atestado, observacao{$extra}
                        FROM ponto_registros
                        WHERE data >= ? AND data <= ? AND ";
                $params = [$ini, $fim];
                // Sem vínculo com o cadastro, o nome lido da origem é a única chave.
                if ($colab) { $sql .= "colaborador_id = ?"; $params[] = $colab; }
                else        { $sql .= "colaborador_id IS NULL AND nome_csv = ?"; $params[] = $nome; }
                $sql .= " ORDER BY data LIMIT 1000";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    if ($r['colaborador_id'] !== null) $r['colaborador_id'] = (string)$r['colaborador_id'];
                    if ($r['obra_id'] !== null) $r['obra_id'] = (string)$r['obra_id'];
                    foreach (['centro_indireto','agregado','marcacao_invalida','falta','atestado'] as $b) $r[$b] = ((int)$r[$b]) === 1;
                    foreach (['horas_previstas_min','horas_trabalhadas_min','horas_falta_min','dias_falta_qtd',
                              'horas_extra_50_min','horas_extra_60_min','horas_extra_100_min','horas_compensadas_min',
                              'interjornada_min','banco_saldo_min'] as $n) $r[$n] = (int)$r[$n];
                    if (isset($r['rhid_id_person']) && $r['rhid_id_person'] !== null) $r['rhid_id_person'] = (int)$r['rhid_id_person'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- PONTO OCORRÊNCIAS (fila de tratativas) --------------------
    case 'pontoOcorrencias':
        if ($method === 'GET') {
            $ini = $_GET['inicio'] ?? null;
            $fim = $_GET['fim'] ?? null;
            if (!$ini || !$fim) json_response(["error" => "inicio e fim são obrigatórios."], 400);
            try {
                $sql = "SELECT id, chave_pessoa, data, tipo, registro_id, colaborador_id, obra_id, nome,
                               severidade, detalhe, minutos, status, responsavel, prazo, observacao,
                               criado_em, atualizado_em, atualizado_por
                        FROM ponto_ocorrencias WHERE data >= ? AND data <= ?";
                $params = [$ini, $fim];
                if (isset($_GET['status']) && $_GET['status'] !== '') {
                    $sql .= " AND status = ?";
                    $params[] = $_GET['status'];
                }
                $sql .= " ORDER BY data DESC, minutos DESC LIMIT 5000";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    if ($r['registro_id'] !== null) $r['registro_id'] = (string)$r['registro_id'];
                    if ($r['colaborador_id'] !== null) $r['colaborador_id'] = (string)$r['colaborador_id'];
                    if ($r['obra_id'] !== null) $r['obra_id'] = (string)$r['obra_id'];
                    $r['minutos'] = (int)$r['minutos'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            // Regeneração idempotente: a UNIQUE (chave_pessoa, data, tipo) faz o
            // reprocessamento atualizar o fato SEM tocar na tratativa humana
            // (status, responsável, prazo, observação).
            $rows = $input['rows'] ?? null;
            if (!is_array($rows)) json_response(["error" => "Payload deve conter 'rows'."], 400);
            if (count($rows) === 0) json_response(["upserted" => 0]);
            try {
                $conn->beginTransaction();
                $stmt = $conn->prepare("
                    INSERT INTO ponto_ocorrencias
                        (chave_pessoa, data, tipo, registro_id, colaborador_id, obra_id, nome,
                         severidade, detalhe, minutos, status, criado_em)
                    VALUES (:chave_pessoa, :data, :tipo, :registro_id, :colaborador_id, :obra_id, :nome,
                            :severidade, :detalhe, :minutos, 'pendente', NOW())
                    ON DUPLICATE KEY UPDATE
                        registro_id = VALUES(registro_id),
                        colaborador_id = VALUES(colaborador_id),
                        obra_id = VALUES(obra_id),
                        nome = VALUES(nome),
                        severidade = VALUES(severidade),
                        detalhe = VALUES(detalhe),
                        minutos = VALUES(minutos)
                ");
                $count = 0;
                foreach ($rows as $r) {
                    $stmt->execute([
                        'chave_pessoa'   => substr((string)($r['chave_pessoa'] ?? ''), 0, 100),
                        'data'           => $r['data'],
                        'tipo'           => $r['tipo'],
                        'registro_id'    => $r['registro_id'] ?? null,
                        'colaborador_id' => $r['colaborador_id'] ?? null,
                        'obra_id'        => $r['obra_id'] ?? null,
                        'nome'           => substr((string)($r['nome'] ?? ''), 0, 255),
                        'severidade'     => $r['severidade'] ?? 'media',
                        'detalhe'        => $r['detalhe'] ?? null,
                        'minutos'        => (int)($r['minutos'] ?? 0),
                    ]);
                    $count++;
                }
                $conn->commit();
                json_response(["upserted" => $count]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PATCH' || $method === 'PUT') {
            $id = $input['id'] ?? null;
            if (!$id) json_response(["error" => "id é obrigatório."], 400);
            $permitidos = ['status', 'responsavel', 'prazo', 'observacao'];
            $sets = [];
            $params = [];
            foreach ($permitidos as $campo) {
                if (array_key_exists($campo, $input)) {
                    $sets[] = "`$campo` = ?";
                    $params[] = $input[$campo] === '' ? null : $input[$campo];
                }
            }
            if (count($sets) === 0) json_response(["error" => "Nada a atualizar."], 400);
            $sets[] = "atualizado_em = NOW()";
            $sets[] = "atualizado_por = ?";
            $params[] = $input['atualizado_por'] ?? null;
            $params[] = $id;
            try {
                $stmt = $conn->prepare("UPDATE ponto_ocorrencias SET " . implode(', ', $sets) . " WHERE id = ?");
                $stmt->execute($params);
                json_response(["updated" => $stmt->rowCount()]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- DE-PARA DEPARTAMENTO → OBRA --------------------
    case 'pontoDepartamentoObra':
        if ($method === 'GET') {
            try {
                $stmt = $conn->query("SELECT departamento, obra_id, indireto, atualizado_em, atualizado_por
                                      FROM ponto_departamento_obra ORDER BY departamento");
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    if ($r['obra_id'] !== null) $r['obra_id'] = (string)$r['obra_id'];
                    $r['indireto'] = ((int)$r['indireto']) === 1;
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' || $method === 'POST') {
            $dep = $input['departamento'] ?? null;
            if (!$dep) json_response(["error" => "departamento é obrigatório."], 400);
            try {
                $stmt = $conn->prepare("
                    INSERT INTO ponto_departamento_obra (departamento, obra_id, indireto, atualizado_em, atualizado_por)
                    VALUES (:departamento, :obra_id, :indireto, NOW(), :atualizado_por)
                    ON DUPLICATE KEY UPDATE
                        obra_id = VALUES(obra_id),
                        indireto = VALUES(indireto),
                        atualizado_em = NOW(),
                        atualizado_por = VALUES(atualizado_por)
                ");
                $stmt->execute([
                    'departamento'   => substr((string)$dep, 0, 150),
                    'obra_id'        => $input['obra_id'] ?? null,
                    'indireto'       => !empty($input['indireto']) ? 1 : 0,
                    'atualizado_por' => $input['atualizado_por'] ?? null,
                ]);
                json_response(["ok" => true]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- VÍNCULO PESSOA RHiD ↔ COLABORADOR --------------------
    case 'pontoRhidVinculos':
        if ($method === 'GET') {
            try {
                $stmt = $conn->query("SELECT id_person, colaborador_id, cpf, nome_rhid, ignorado,
                                             observacao, vinculado_em, vinculado_por
                                      FROM rhid_pessoa_vinculo ORDER BY nome_rhid");
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id_person'] = (int)$r['id_person'];
                    if ($r['colaborador_id'] !== null) $r['colaborador_id'] = (string)$r['colaborador_id'];
                    $r['ignorado'] = ((int)$r['ignorado']) === 1;
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' || $method === 'POST') {
            $idPerson = isset($input['id_person']) ? (int)$input['id_person'] : 0;
            if ($idPerson <= 0) json_response(["error" => "id_person é obrigatório."], 400);
            try {
                $stmt = $conn->prepare("
                    INSERT INTO rhid_pessoa_vinculo
                        (id_person, colaborador_id, cpf, nome_rhid, ignorado, observacao, vinculado_em, vinculado_por)
                    VALUES (:id_person, :colaborador_id, :cpf, :nome_rhid, :ignorado, :observacao, NOW(), :vinculado_por)
                    ON DUPLICATE KEY UPDATE
                        colaborador_id = VALUES(colaborador_id),
                        cpf = VALUES(cpf),
                        nome_rhid = VALUES(nome_rhid),
                        ignorado = VALUES(ignorado),
                        observacao = VALUES(observacao),
                        vinculado_em = NOW(),
                        vinculado_por = VALUES(vinculado_por)
                ");
                $stmt->execute([
                    'id_person'      => $idPerson,
                    'colaborador_id' => $input['colaborador_id'] ?? null,
                    'cpf'            => $input['cpf'] ?? null,
                    'nome_rhid'      => $input['nome_rhid'] ?? null,
                    'ignorado'       => !empty($input['ignorado']) ? 1 : 0,
                    'observacao'     => $input['observacao'] ?? null,
                    'vinculado_por'  => $input['vinculado_por'] ?? null,
                ]);
                json_response(["ok" => true]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- JUSTIFICATIVAS (espelho da RHiD) --------------------
    case 'pontoJustificativas':
        if ($method === 'GET') {
            $ini = $_GET['inicio'] ?? null;
            $fim = $_GET['fim'] ?? null;
            if (!$ini || !$fim) json_response(["error" => "inicio e fim são obrigatórios."], 400);
            try {
                // Sobreposição, não contenção: justificativa de 28/07 a 05/08
                // precisa aparecer quando o período consultado é agosto.
                $stmt = $conn->prepare("
                    SELECT id_rhid, id_person, colaborador_id, nome_rhid, cpf, data_inicio, data_fim,
                           id_tipo, tipo_nome, status_aprovacao, motivo, sincronizado_em
                    FROM ponto_justificativas
                    WHERE data_inicio <= ? AND data_fim >= ?
                    ORDER BY data_inicio DESC LIMIT 5000
                ");
                $stmt->execute([$fim, $ini]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    if ($r['id_person'] !== null) $r['id_person'] = (int)$r['id_person'];
                    if ($r['colaborador_id'] !== null) $r['colaborador_id'] = (string)$r['colaborador_id'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $rows = $input['rows'] ?? null;
            if (!is_array($rows)) json_response(["error" => "Payload deve conter 'rows'."], 400);
            if (count($rows) === 0) json_response(["upserted" => 0]);
            try {
                $conn->beginTransaction();
                $stmt = $conn->prepare("
                    INSERT INTO ponto_justificativas
                        (id_rhid, id_person, colaborador_id, nome_rhid, cpf, data_inicio, data_fim,
                         id_tipo, tipo_nome, status_aprovacao, motivo, sincronizado_em)
                    VALUES (:id_rhid, :id_person, :colaborador_id, :nome_rhid, :cpf, :data_inicio, :data_fim,
                            :id_tipo, :tipo_nome, :status_aprovacao, :motivo, NOW())
                    ON DUPLICATE KEY UPDATE
                        id_person = VALUES(id_person),
                        colaborador_id = VALUES(colaborador_id),
                        nome_rhid = VALUES(nome_rhid),
                        cpf = VALUES(cpf),
                        data_inicio = VALUES(data_inicio),
                        data_fim = VALUES(data_fim),
                        id_tipo = VALUES(id_tipo),
                        tipo_nome = VALUES(tipo_nome),
                        status_aprovacao = VALUES(status_aprovacao),
                        motivo = VALUES(motivo),
                        sincronizado_em = NOW()
                ");
                $count = 0;
                foreach ($rows as $r) {
                    $stmt->execute([
                        'id_rhid'          => substr((string)($r['id_rhid'] ?? ''), 0, 80),
                        'id_person'        => isset($r['id_person']) && $r['id_person'] !== null ? (int)$r['id_person'] : null,
                        'colaborador_id'   => $r['colaborador_id'] ?? null,
                        'nome_rhid'        => $r['nome_rhid'] ?? null,
                        'cpf'              => $r['cpf'] ?? null,
                        'data_inicio'      => $r['data_inicio'],
                        'data_fim'         => $r['data_fim'],
                        'id_tipo'          => $r['id_tipo'] ?? null,
                        'tipo_nome'        => $r['tipo_nome'] ?? null,
                        'status_aprovacao' => $r['status_aprovacao'] ?? 'desconhecido',
                        'motivo'           => $r['motivo'] ?? null,
                    ]);
                    $count++;
                }
                $conn->commit();
                json_response(["upserted" => $count]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- TIPOS DE JUSTIFICATIVA --------------------
    case 'pontoJustificativaTipos':
        if ($method === 'GET') {
            try {
                $stmt = $conn->query("SELECT id, nome, abreviacao, abonar_dia_falta, desconta_dsr,
                                             exige_cid, qtd_mensal, qtd_trimestral, qtd_semestral,
                                             qtd_anual, sincronizado_em
                                      FROM ponto_justificativa_tipos ORDER BY nome");
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    foreach (['abonar_dia_falta','desconta_dsr','exige_cid'] as $b) $r[$b] = ((int)$r[$b]) === 1;
                    foreach (['qtd_mensal','qtd_trimestral','qtd_semestral','qtd_anual'] as $n) {
                        $r[$n] = $r[$n] === null ? null : (int)$r[$n];
                    }
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $rows = $input['rows'] ?? null;
            if (!is_array($rows)) json_response(["error" => "Payload deve conter 'rows'."], 400);
            if (count($rows) === 0) json_response(["upserted" => 0]);
            try {
                $conn->beginTransaction();
                $stmt = $conn->prepare("
                    INSERT INTO ponto_justificativa_tipos
                        (id, nome, abreviacao, abonar_dia_falta, desconta_dsr, exige_cid,
                         qtd_mensal, qtd_trimestral, qtd_semestral, qtd_anual, sincronizado_em)
                    VALUES (:id, :nome, :abreviacao, :abonar_dia_falta, :desconta_dsr, :exige_cid,
                            :qtd_mensal, :qtd_trimestral, :qtd_semestral, :qtd_anual, NOW())
                    ON DUPLICATE KEY UPDATE
                        nome = VALUES(nome),
                        abreviacao = VALUES(abreviacao),
                        abonar_dia_falta = VALUES(abonar_dia_falta),
                        desconta_dsr = VALUES(desconta_dsr),
                        exige_cid = VALUES(exige_cid),
                        qtd_mensal = VALUES(qtd_mensal),
                        qtd_trimestral = VALUES(qtd_trimestral),
                        qtd_semestral = VALUES(qtd_semestral),
                        qtd_anual = VALUES(qtd_anual),
                        sincronizado_em = NOW()
                ");
                $inteiroOuNulo = function ($v) { return $v === null || $v === '' ? null : (int)$v; };
                $count = 0;
                foreach ($rows as $r) {
                    $stmt->execute([
                        'id'               => substr((string)($r['id'] ?? ''), 0, 40),
                        'nome'             => substr((string)($r['nome'] ?? ''), 0, 255),
                        'abreviacao'       => $r['abreviacao'] ?? null,
                        'abonar_dia_falta' => !empty($r['abonar_dia_falta']) ? 1 : 0,
                        'desconta_dsr'     => !empty($r['desconta_dsr']) ? 1 : 0,
                        'exige_cid'        => !empty($r['exige_cid']) ? 1 : 0,
                        'qtd_mensal'       => $inteiroOuNulo($r['qtd_mensal'] ?? null),
                        'qtd_trimestral'   => $inteiroOuNulo($r['qtd_trimestral'] ?? null),
                        'qtd_semestral'    => $inteiroOuNulo($r['qtd_semestral'] ?? null),
                        'qtd_anual'        => $inteiroOuNulo($r['qtd_anual'] ?? null),
                    ]);
                    $count++;
                }
                $conn->commit();
                json_response(["upserted" => $count]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- DISPOSITIVOS REP (snapshot) --------------------
    case 'pontoDispositivos':
        if ($method === 'GET') {
            try {
                $stmt = $conn->query("SELECT id_device, nome, serial, versao, status, status_papel,
                                             id_empresa, num_pessoas, num_digitais, ultima_conexao,
                                             ultima_sincronizacao, sincronizado_em
                                      FROM ponto_dispositivos ORDER BY nome");
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id_device'] = (int)$r['id_device'];
                    foreach (['num_pessoas','num_digitais'] as $n) {
                        $r[$n] = $r[$n] === null ? null : (int)$r[$n];
                    }
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            // Snapshot: reprocessar sobrescreve a linha do equipamento.
            $rows = $input['rows'] ?? null;
            if (!is_array($rows)) json_response(["error" => "Payload deve conter 'rows'."], 400);
            if (count($rows) === 0) json_response(["upserted" => 0]);
            try {
                $conn->beginTransaction();
                $stmt = $conn->prepare("
                    INSERT INTO ponto_dispositivos
                        (id_device, nome, serial, versao, status, status_papel, id_empresa,
                         num_pessoas, num_digitais, ultima_conexao, ultima_sincronizacao, sincronizado_em)
                    VALUES (:id_device, :nome, :serial, :versao, :status, :status_papel, :id_empresa,
                            :num_pessoas, :num_digitais, :ultima_conexao, :ultima_sincronizacao, NOW())
                    ON DUPLICATE KEY UPDATE
                        nome = VALUES(nome), serial = VALUES(serial), versao = VALUES(versao),
                        status = VALUES(status), status_papel = VALUES(status_papel),
                        id_empresa = VALUES(id_empresa), num_pessoas = VALUES(num_pessoas),
                        num_digitais = VALUES(num_digitais), ultima_conexao = VALUES(ultima_conexao),
                        ultima_sincronizacao = VALUES(ultima_sincronizacao), sincronizado_em = NOW()
                ");
                $inteiroOuNulo = function ($v) { return $v === null || $v === '' ? null : (int)$v; };
                $count = 0;
                foreach ($rows as $r) {
                    $stmt->execute([
                        'id_device'            => (int)($r['id_device'] ?? 0),
                        'nome'                 => $r['nome'] ?? null,
                        'serial'               => $r['serial'] ?? null,
                        'versao'               => $r['versao'] ?? null,
                        'status'               => $r['status'] ?? null,
                        'status_papel'         => $r['status_papel'] ?? null,
                        'id_empresa'           => $r['id_empresa'] ?? null,
                        'num_pessoas'          => $inteiroOuNulo($r['num_pessoas'] ?? null),
                        'num_digitais'         => $inteiroOuNulo($r['num_digitais'] ?? null),
                        'ultima_conexao'       => $r['ultima_conexao'] ?? null,
                        'ultima_sincronizacao' => $r['ultima_sincronizacao'] ?? null,
                    ]);
                    $count++;
                }
                $conn->commit();
                json_response(["upserted" => $count]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- AFD ARQUIVADO (metadados) --------------------
    // O conteúdo vive no bucket privado 'ponto-afd'; aqui fica a prova do que
    // foi gerado — faixa de NSR, contagem de linhas, sha256 e responsável.
    case 'pontoAfdArquivos':
        if ($method === 'GET') {
            try {
                $stmt = $conn->query("SELECT id, id_device, equipamento_nome, layout, coletor,
                                             periodo_inicio, periodo_fim, nsr_inicial, nsr_final,
                                             linhas, sha256, storage_path, truncado, gerado_por, gerado_em
                                      FROM ponto_afd_arquivos ORDER BY gerado_em DESC LIMIT 500");
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['id_device'] = (int)$r['id_device'];
                    $r['linhas'] = (int)$r['linhas'];
                    $r['coletor'] = ((int)$r['coletor']) === 1;
                    $r['truncado'] = ((int)$r['truncado']) === 1;
                    foreach (['nsr_inicial','nsr_final'] as $n) {
                        $r[$n] = $r[$n] === null ? null : (int)$r[$n];
                    }
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $stmt = $conn->prepare("
                    INSERT INTO ponto_afd_arquivos
                        (id_device, equipamento_nome, layout, coletor, periodo_inicio, periodo_fim,
                         nsr_inicial, nsr_final, linhas, sha256, storage_path, truncado, gerado_por, gerado_em)
                    VALUES (:id_device, :equipamento_nome, :layout, :coletor, :periodo_inicio, :periodo_fim,
                            :nsr_inicial, :nsr_final, :linhas, :sha256, :storage_path, :truncado, :gerado_por, NOW())
                ");
                $inteiroOuNulo = function ($v) { return $v === null || $v === '' ? null : (int)$v; };
                $stmt->execute([
                    'id_device'        => (int)($input['id_device'] ?? 0),
                    'equipamento_nome' => $input['equipamento_nome'] ?? null,
                    'layout'           => $input['layout'] ?? '1510',
                    'coletor'          => !empty($input['coletor']) ? 1 : 0,
                    'periodo_inicio'   => $input['periodo_inicio'] ?? null,
                    'periodo_fim'      => $input['periodo_fim'] ?? null,
                    'nsr_inicial'      => $inteiroOuNulo($input['nsr_inicial'] ?? null),
                    'nsr_final'        => $inteiroOuNulo($input['nsr_final'] ?? null),
                    'linhas'           => (int)($input['linhas'] ?? 0),
                    'sha256'           => $input['sha256'] ?? '',
                    'storage_path'     => $input['storage_path'] ?? null,
                    'truncado'         => !empty($input['truncado']) ? 1 : 0,
                    'gerado_por'       => $input['gerado_por'] ?? null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId()]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- ERROS DE SINCRONIZAÇÃO RHiD --------------------
    case 'pontoSyncErros':
        if ($method === 'GET') {
            $ini = $_GET['inicio'] ?? null;
            $fim = $_GET['fim'] ?? null;
            try {
                $sql = "SELECT id, importacao_id, periodo_inicio, periodo_fim, id_person,
                               nome_rhid, mensagem, ocorrido_em
                        FROM ponto_sync_erros";
                $params = [];
                if ($ini && $fim) {
                    $sql .= " WHERE periodo_inicio <= ? AND periodo_fim >= ?";
                    $params = [$fim, $ini];
                }
                $sql .= " ORDER BY ocorrido_em DESC LIMIT 1000";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['id_person'] = (int)$r['id_person'];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $rows = $input['rows'] ?? null;
            if (!is_array($rows)) json_response(["error" => "Payload deve conter 'rows'."], 400);
            if (count($rows) === 0) json_response(["inserted" => 0]);
            try {
                $conn->beginTransaction();
                $stmt = $conn->prepare("
                    INSERT INTO ponto_sync_erros
                        (importacao_id, periodo_inicio, periodo_fim, id_person, nome_rhid, mensagem, ocorrido_em)
                    VALUES (:importacao_id, :periodo_inicio, :periodo_fim, :id_person, :nome_rhid, :mensagem, NOW())
                ");
                $count = 0;
                foreach ($rows as $r) {
                    $stmt->execute([
                        'importacao_id'  => $r['importacao_id'] ?? null,
                        'periodo_inicio' => $r['periodo_inicio'],
                        'periodo_fim'    => $r['periodo_fim'],
                        'id_person'      => (int)($r['id_person'] ?? 0),
                        'nome_rhid'      => $r['nome_rhid'] ?? null,
                        'mensagem'       => $r['mensagem'] ?? null,
                    ]);
                    $count++;
                }
                $conn->commit();
                json_response(["inserted" => $count]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- HOMEM/HORA MENSAL --------------------
    case 'dpHomemHora':
        if ($method === 'GET') {
            $competencia = $_GET['competencia'] ?? '';
            if (!preg_match('/^[0-9]{4}-(0[1-9]|1[0-2])$/', $competencia)) {
                json_response(["error" => "Competência inválida (use YYYY-MM)."], 400);
            }
            try {
                $stmt = $conn->prepare("SELECT * FROM vw_homem_hora_mensal WHERE competencia = ?");
                $stmt->execute([$competencia]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    if ($r['colaborador_id'] !== null) $r['colaborador_id'] = (string)$r['colaborador_id'];
                    if ($r['obra_id'] !== null) $r['obra_id'] = (string)$r['obra_id'];
                    foreach (['dias','horas_previstas_min','horas_realizadas_min','horas_falta_min','horas_extra_total_min',
                              'horas_extra_50_min','horas_extra_60_min','horas_extra_100_min','dias_falta',
                              'dias_marcacao_invalida'] as $n) $r[$n] = (int)$r[$n];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- FECHAMENTO DE COMPETÊNCIA DP --------------------
    case 'dpFechamentoCompetencia':
        // Porta a lógica das RPCs dp_fechar_competencia / dp_reabrir_competencia
        // do Supabase, incluindo a exigência de perfil GM.
        // `escopo` separa a trava da folha da trava do ponto: os dois fecham em
        // momentos diferentes (o ponto congela a base, a folha vem depois).
        // Só existe após 2026_08_05_fechamento_escopo.sql — sem a coluna, o
        // comportamento antigo (uma trava só, de folha) é preservado.
        $temEscopo = $conn
            ->query("SHOW COLUMNS FROM dp_fechamento_competencia LIKE 'escopo'")
            ->fetch(PDO::FETCH_ASSOC) !== false;
        $escopo = ($input['escopo'] ?? $_GET['escopo'] ?? 'folha') === 'ponto' ? 'ponto' : 'folha';

        if ($method === 'GET') {
            try {
                $sql = "SELECT * FROM dp_fechamento_competencia";
                $params = [];
                if ($temEscopo && isset($_GET['escopo'])) {
                    $sql .= " WHERE escopo = ?";
                    $params[] = $escopo;
                }
                $sql .= " ORDER BY fechado_em DESC";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    if (!isset($r['escopo'])) $r['escopo'] = 'folha';
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $acao = $input['acao'] ?? '';
            $competencia = $input['competencia'] ?? '';
            if (!preg_match('/^[0-9]{4}-(0[1-9]|1[0-2])$/', $competencia)) {
                json_response(["error" => "Competência inválida (use YYYY-MM)."], 400);
            }
            if (!$temEscopo && $escopo === 'ponto') {
                json_response(["error" => "Fechamento de ponto exige a migração 2026_08_05_fechamento_escopo.sql."], 409);
            }
            // Filtro de escopo aplicado às buscas de fechamento ativo abaixo.
            $filtroEscopo = $temEscopo ? " AND escopo = " . $conn->quote($escopo) : "";
            // Espelha current_is_gm() da RPC original
            try {
                $stmt = $conn->prepare("SELECT is_gm FROM usuarios WHERE id = ?");
                $stmt->execute([$authUser['user_id'] ?? 0]);
                $u = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$u || !((int)$u['is_gm'])) {
                    json_response(["error" => "Sem permissão para " . ($acao === 'reabrir' ? 'reabrir' : 'fechar') . " competência."], 403);
                }
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
            if ($acao === 'fechar') {
                $por = trim($input['fechado_por'] ?? '');
                if ($por === '') json_response(["error" => "Responsável obrigatório."], 400);
                try {
                    $conn->beginTransaction();
                    // Trava a competência p/ evitar fechamento duplo concorrente
                    $stmt = $conn->prepare("SELECT id FROM dp_fechamento_competencia WHERE competencia = ? AND reaberto_em IS NULL{$filtroEscopo} FOR UPDATE");
                    $stmt->execute([$competencia]);
                    if ($stmt->fetch()) {
                        $conn->rollBack();
                        json_response(["error" => "Competência $competencia já está fechada para $escopo."], 409);
                    }
                    $motivo = trim($input['motivo'] ?? '');
                    $colunaEscopo = $temEscopo ? ", escopo" : "";
                    $valorEscopo = $temEscopo ? ", ?" : "";
                    $stmt = $conn->prepare("INSERT INTO dp_fechamento_competencia (competencia, fechado_em, fechado_por, motivo{$colunaEscopo}) VALUES (?, NOW(), ?, ?{$valorEscopo})");
                    $stmt->execute($temEscopo
                        ? [$competencia, $por, $motivo !== '' ? $motivo : null, $escopo]
                        : [$competencia, $por, $motivo !== '' ? $motivo : null]);
                    $id = $conn->lastInsertId();
                    $conn->commit();
                    $row = $conn->query("SELECT * FROM dp_fechamento_competencia WHERE id = " . (int)$id)->fetch(PDO::FETCH_ASSOC);
                    $row['id'] = (string)$row['id'];
                    logAudit($conn, $authUser ?? null, 'dp_fechamento_competencia', $row['id'], 'insert', null, $row);
                    json_response($row);
                } catch (PDOException $e) {
                    $conn->rollBack();
                    json_response(["error" => err_detail($e)], 500);
                }
            }
            elseif ($acao === 'reabrir') {
                $por = trim($input['reaberto_por'] ?? '');
                $motivo = trim($input['motivo_reabertura'] ?? '');
                if ($por === '') json_response(["error" => "Responsável obrigatório."], 400);
                if ($motivo === '') json_response(["error" => "Motivo da reabertura é obrigatório."], 400);
                try {
                    $conn->beginTransaction();
                    $stmt = $conn->prepare("SELECT id FROM dp_fechamento_competencia WHERE competencia = ? AND reaberto_em IS NULL{$filtroEscopo} FOR UPDATE");
                    $stmt->execute([$competencia]);
                    $ativa = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$ativa) {
                        $conn->rollBack();
                        json_response(["error" => "Competência $competencia não está fechada para $escopo."], 409);
                    }
                    $stmt = $conn->prepare("UPDATE dp_fechamento_competencia SET reaberto_em = NOW(), reaberto_por = ?, motivo_reabertura = ? WHERE id = ?");
                    $stmt->execute([$por, $motivo, $ativa['id']]);
                    $conn->commit();
                    $row = $conn->query("SELECT * FROM dp_fechamento_competencia WHERE id = " . (int)$ativa['id'])->fetch(PDO::FETCH_ASSOC);
                    $row['id'] = (string)$row['id'];
                    logAudit($conn, $authUser ?? null, 'dp_fechamento_competencia', $row['id'], 'update', null, $row);
                    json_response($row);
                } catch (PDOException $e) {
                    $conn->rollBack();
                    json_response(["error" => err_detail($e)], 500);
                }
            }
            else {
                json_response(["error" => "Ação inválida (use 'fechar' ou 'reabrir')."], 400);
            }
        }
        break;

    // ==============================================
    // MÓDULO CRM — tarefas, perdas e histórico (migrados de
    // localStorage/Supabase). Requer 2026_07_17_crm_persistencia_mysql.sql
    // ==============================================

    // -------------------- CRM TAREFAS --------------------
    case 'crmTarefas':
        if ($method === 'GET') {
            try {
                $sql = "SELECT * FROM crm_tarefas";
                $params = [];
                if (!empty($_GET['oportunidade_id'])) {
                    $sql .= " WHERE oportunidade_id = ?";
                    $params[] = $_GET['oportunidade_id'];
                }
                $sql .= " ORDER BY data ASC, criada_em ASC LIMIT 20000";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll(PDO::FETCH_ASSOC));
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            // Upsert por id (uuid do cliente) — usado na criação e na
            // reconciliação do legado localStorage.
            $rows = $input['rows'] ?? (isset($input['id']) ? [$input] : null);
            if (!is_array($rows) || count($rows) === 0) {
                json_response(["error" => "Payload deve conter a tarefa ou 'rows'."], 400);
            }
            try {
                $conn->beginTransaction();
                $stmt = $conn->prepare("
                    INSERT INTO crm_tarefas (id, oportunidade_id, titulo, data, responsavel_login, status, criada_em, concluida_em)
                    VALUES (:id, :oportunidade_id, :titulo, :data, :responsavel_login, :status, :criada_em, :concluida_em)
                    ON DUPLICATE KEY UPDATE titulo = VALUES(titulo), data = VALUES(data),
                        responsavel_login = VALUES(responsavel_login), status = VALUES(status),
                        concluida_em = VALUES(concluida_em)
                ");
                $count = 0;
                foreach ($rows as $r) {
                    if (empty($r['id']) || empty($r['oportunidade_id'])) continue;
                    $stmt->execute([
                        'id'                => $r['id'],
                        'oportunidade_id'   => $r['oportunidade_id'],
                        'titulo'            => $r['titulo'] ?? '',
                        'data'              => $r['data'],
                        'responsavel_login' => $r['responsavel_login'] ?? null,
                        'status'            => ($r['status'] ?? 'aberta') === 'concluida' ? 'concluida' : 'aberta',
                        'criada_em'         => date('Y-m-d H:i:s', strtotime($r['criada_em'] ?? 'now')),
                        'concluida_em'      => !empty($r['concluida_em']) ? date('Y-m-d H:i:s', strtotime($r['concluida_em'])) : null,
                    ]);
                    $count++;
                }
                $conn->commit();
                json_response(["saved" => $count]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT') {
            if (!$id) json_response(["error" => "id é obrigatório."], 400);
            try {
                $sets = [];
                $params = ['id' => $id];
                foreach (['titulo', 'data', 'responsavel_login', 'status'] as $f) {
                    if (array_key_exists($f, $input)) { $sets[] = "$f = :$f"; $params[$f] = $input[$f]; }
                }
                if (array_key_exists('concluida_em', $input)) {
                    $sets[] = "concluida_em = :concluida_em";
                    $params['concluida_em'] = $input['concluida_em'] ? date('Y-m-d H:i:s', strtotime($input['concluida_em'])) : null;
                }
                if (!$sets) json_response(["error" => "Nada para atualizar."], 400);
                $stmt = $conn->prepare("UPDATE crm_tarefas SET " . implode(', ', $sets) . " WHERE id = :id");
                $stmt->execute($params);
                json_response(["updated" => $stmt->rowCount()]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE') {
            if (!$id) json_response(["error" => "id é obrigatório."], 400);
            try {
                $stmt = $conn->prepare("DELETE FROM crm_tarefas WHERE id = ?");
                $stmt->execute([$id]);
                json_response(["deleted" => $stmt->rowCount()]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- CRM MOTIVOS DE PERDA --------------------
    case 'crmMotivosPerda':
        if ($method === 'GET') {
            try {
                $rows = $conn->query("SELECT * FROM crm_motivos_perda ORDER BY rotulo")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) $r['ativo'] = ((int)$r['ativo']) === 1;
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $rows = $input['rows'] ?? (isset($input['id']) ? [$input] : null);
            if (!is_array($rows) || count($rows) === 0) {
                json_response(["error" => "Payload deve conter o motivo ou 'rows'."], 400);
            }
            try {
                $stmt = $conn->prepare("
                    INSERT INTO crm_motivos_perda (id, rotulo, ativo, criado_em)
                    VALUES (:id, :rotulo, :ativo, :criado_em)
                    ON DUPLICATE KEY UPDATE rotulo = VALUES(rotulo), ativo = VALUES(ativo)
                ");
                $count = 0;
                foreach ($rows as $r) {
                    if (empty($r['id']) || empty($r['rotulo'])) continue;
                    $stmt->execute([
                        'id'        => $r['id'],
                        'rotulo'    => $r['rotulo'],
                        'ativo'     => (!isset($r['ativo']) || $r['ativo']) ? 1 : 0,
                        'criado_em' => !empty($r['criado_em']) ? date('Y-m-d H:i:s', strtotime($r['criado_em'])) : null,
                    ]);
                    $count++;
                }
                json_response(["saved" => $count]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- CRM PERDAS --------------------
    case 'crmPerdas':
        if ($method === 'GET') {
            try {
                $rows = $conn->query("SELECT * FROM crm_perdas ORDER BY registrado_em DESC LIMIT 20000")->fetchAll(PDO::FETCH_ASSOC);
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            // Upsert por oportunidade (novo registro substitui o anterior).
            $rows = $input['rows'] ?? (isset($input['oportunidade_id']) ? [$input] : null);
            if (!is_array($rows) || count($rows) === 0) {
                json_response(["error" => "Payload deve conter o registro ou 'rows'."], 400);
            }
            try {
                $stmt = $conn->prepare("
                    INSERT INTO crm_perdas (oportunidade_id, motivo_id, motivo_rotulo, observacao, registrado_em, registrado_por)
                    VALUES (:oportunidade_id, :motivo_id, :motivo_rotulo, :observacao, :registrado_em, :registrado_por)
                    ON DUPLICATE KEY UPDATE motivo_id = VALUES(motivo_id), motivo_rotulo = VALUES(motivo_rotulo),
                        observacao = VALUES(observacao), registrado_em = VALUES(registrado_em),
                        registrado_por = VALUES(registrado_por)
                ");
                $count = 0;
                foreach ($rows as $r) {
                    if (empty($r['oportunidade_id']) || empty($r['motivo_id'])) continue;
                    $stmt->execute([
                        'oportunidade_id' => $r['oportunidade_id'],
                        'motivo_id'       => $r['motivo_id'],
                        'motivo_rotulo'   => $r['motivo_rotulo'] ?? '',
                        'observacao'      => $r['observacao'] ?? null,
                        'registrado_em'   => date('Y-m-d H:i:s', strtotime($r['registrado_em'] ?? 'now')),
                        'registrado_por'  => $r['registrado_por'] ?? null,
                    ]);
                    $count++;
                }
                json_response(["saved" => $count]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- HISTÓRICO DA OPORTUNIDADE --------------------
    case 'oportunidadeHistorico':
        if ($method === 'GET') {
            try {
                $sql = "SELECT * FROM oportunidade_historico";
                $params = [];
                if (!empty($_GET['oportunidade_id'])) {
                    $sql .= " WHERE oportunidade_id = ?";
                    $params[] = $_GET['oportunidade_id'];
                }
                $sql .= " ORDER BY ocorrido_em DESC LIMIT 500";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $dec = $r['detalhes'] !== null ? json_decode($r['detalhes'], true) : null;
                    $r['detalhes'] = is_array($dec) ? $dec : null;
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $rows = $input['rows'] ?? (isset($input['id']) ? [$input] : null);
            if (!is_array($rows) || count($rows) === 0) {
                json_response(["error" => "Payload deve conter o evento ou 'rows'."], 400);
            }
            try {
                // INSERT IGNORE: eventos são imutáveis; reenvio (reconciliação) não duplica.
                $stmt = $conn->prepare("
                    INSERT IGNORE INTO oportunidade_historico
                        (id, oportunidade_id, tipo, autor_id, autor_login, descricao, detalhes, ocorrido_em)
                    VALUES (:id, :oportunidade_id, :tipo, :autor_id, :autor_login, :descricao, :detalhes, :ocorrido_em)
                ");
                $count = 0;
                foreach ($rows as $r) {
                    if (empty($r['id']) || empty($r['oportunidade_id'])) continue;
                    $stmt->execute([
                        'id'              => $r['id'],
                        'oportunidade_id' => $r['oportunidade_id'],
                        'tipo'            => $r['tipo'] ?? 'edicao',
                        'autor_id'        => $r['autor_id'] ?? null,
                        'autor_login'     => $r['autor_login'] ?? null,
                        'descricao'       => $r['descricao'] ?? '',
                        'detalhes'        => isset($r['detalhes']) && $r['detalhes'] !== null
                            ? json_encode($r['detalhes'], JSON_UNESCAPED_UNICODE) : null,
                        'ocorrido_em'     => date('Y-m-d H:i:s', strtotime($r['ocorrido_em'] ?? 'now')),
                    ]);
                    $count++;
                }
                json_response(["saved" => $count]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // ==============================================
    // MÓDULO GM — auditoria e perfis de permissão (MySQL)
    // Requer migração 2026_07_17_gm_auditoria_perfis_mysql.sql
    // ==============================================

    // -------------------- AUDITORIA DE LOGINS --------------------
    // Fora de $protectedRoutes de propósito: o POST precisa registrar
    // TENTATIVAS FALHAS (pré-token). O GET exige autenticação manualmente.
    case 'auditLogins':
        if ($method === 'GET') {
            $headers = function_exists('getallheaders') ? getallheaders() : [];
            $authHeader = $headers['Authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            $plAudit = validateToken(str_replace('Bearer ', '', $authHeader));
            if (!$plAudit) {
                json_response(["error" => "Não autorizado"], 401);
            }
            // A trilha de logins alimenta /gm/auditoria (GM-only no frontend).
            // O POST segue aberto de propósito — registra tentativas de login,
            // inclusive as que falharam, quando ainda não há token.
            exigirGm($conn, $plAudit, 'a leitura da trilha de logins');
            try {
                $rows = $conn->query("SELECT * FROM audit_logins ORDER BY created_at DESC LIMIT 5000")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['sucesso'] = ((int)$r['sucesso']) === 1;
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $rows = $input['rows'] ?? (isset($input['login']) ? [$input] : null);
            if (!is_array($rows) || count($rows) === 0) {
                json_response(["error" => "Payload deve conter o evento ou 'rows'."], 400);
            }
            // Anti-abuso do endpoint aberto: lote limitado.
            if (count($rows) > 500) json_response(["error" => "Máximo de 500 eventos por chamada."], 400);
            try {
                $stmt = $conn->prepare("
                    INSERT INTO audit_logins (user_id, login, nome, sucesso, user_agent, ip, created_at)
                    VALUES (:user_id, :login, :nome, :sucesso, :user_agent, :ip, :created_at)
                ");
                $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
                if ($ip && strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
                $count = 0;
                foreach ($rows as $r) {
                    if (empty($r['login'])) continue;
                    $stmt->execute([
                        'user_id'    => (string)($r['user_id'] ?? '-'),
                        'login'      => mb_substr($r['login'], 0, 100),
                        'nome'       => $r['nome'] ?? null,
                        'sucesso'    => !empty($r['sucesso']) ? 1 : 0,
                        'user_agent' => isset($r['user_agent']) ? mb_substr($r['user_agent'], 0, 512) : null,
                        'ip'         => $ip,
                        'created_at' => date('Y-m-d H:i:s', strtotime($r['created_at'] ?? 'now')),
                    ]);
                    $count++;
                }
                json_response(["saved" => $count]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- AUDITORIA DE ALTERAÇÕES --------------------
    case 'auditLogs':
        // Trilha de auditoria completa (before/after de cada mutação): expõe
        // dados de todos os módulos. Consumida só por /gm/auditoria (GM-only).
        exigirGm($conn, $authUser, 'a leitura da trilha de auditoria');
        if ($method === 'GET') {
            try {
                $sql = "SELECT * FROM audit_logs";
                $params = [];
                if (!empty($_GET['entidade'])) { $sql .= " WHERE entidade = ?"; $params[] = $_GET['entidade']; }
                $sql .= " ORDER BY created_at DESC LIMIT 2000";
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $b = $r['before_json'] !== null ? json_decode($r['before_json'], true) : null;
                    $a = $r['after_json'] !== null ? json_decode($r['after_json'], true) : null;
                    $r['before'] = is_array($b) ? $b : null;
                    $r['after'] = is_array($a) ? $a : null;
                    unset($r['before_json'], $r['after_json']);
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- PERFIS DE PERMISSÃO --------------------
    case 'perfisPermissao':
        // Perfis de permissão só existem dentro do Quadro de Permissões (GM).
        // Escrita sem gate deixava qualquer autenticado redefinir os perfis da
        // organização; a leitura expõe o desenho de acesso e também é privativa.
        exigirGm($conn, $authUser, 'a gestão de perfis de permissão');
        if ($method === 'GET') {
            try {
                $rows = $conn->query("SELECT * FROM perfis_permissao ORDER BY nome")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $dec = json_decode($r['acessos'] ?? '{}', true);
                    $r['acessos'] = is_array($dec) ? $dec : [];
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $rows = $input['rows'] ?? (isset($input['id']) ? [$input] : null);
            if (!is_array($rows) || count($rows) === 0) {
                json_response(["error" => "Payload deve conter o perfil ou 'rows'."], 400);
            }
            try {
                $stmt = $conn->prepare("
                    INSERT INTO perfis_permissao (id, nome, descricao, acessos, created_at, updated_at)
                    VALUES (:id, :nome, :descricao, :acessos, :created_at, :updated_at)
                    ON DUPLICATE KEY UPDATE nome = VALUES(nome), descricao = VALUES(descricao),
                        acessos = VALUES(acessos), updated_at = VALUES(updated_at)
                ");
                $count = 0;
                foreach ($rows as $r) {
                    if (empty($r['id']) || empty($r['nome'])) continue;
                    $stmt->execute([
                        'id'         => $r['id'],
                        'nome'       => mb_substr($r['nome'], 0, 120),
                        'descricao'  => $r['descricao'] ?? null,
                        'acessos'    => json_encode($r['acessos'] ?? [], JSON_UNESCAPED_UNICODE),
                        'created_at' => date('Y-m-d H:i:s', strtotime($r['created_at'] ?? 'now')),
                        'updated_at' => date('Y-m-d H:i:s', strtotime($r['updated_at'] ?? 'now')),
                    ]);
                    $count++;
                }
                logAudit($conn, $authUser ?? null, 'perfis_permissao', $rows[0]['id'] ?? null, 'upsert', null, $rows);
                json_response(["saved" => $count]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE') {
            if (!$id) json_response(["error" => "id é obrigatório."], 400);
            try {
                $stmt = $conn->prepare("DELETE FROM perfis_permissao WHERE id = ?");
                $stmt->execute([$id]);
                logAudit($conn, $authUser ?? null, 'perfis_permissao', $id, 'delete');
                json_response(["deleted" => $stmt->rowCount()]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // ==============================================
    // HISTOGRAMA — delegações, tipos de veículo e valores por semana
    // Requer migração 2026_07_19_histograma_mysql.sql
    // ==============================================

    // -------------------- DELEGAÇÕES --------------------
    case 'delegacoes':
        if ($method === 'GET') {
            try {
                $rows = $conn->query("SELECT * FROM delegacoes ORDER BY ordem, nome")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) { $r['id'] = (string)$r['id']; $r['ordem'] = (int)$r['ordem']; }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $nome = trim($input['nome'] ?? '');
            if ($nome === '') json_response(["error" => "Nome é obrigatório."], 400);
            try {
                $stmt = $conn->prepare("INSERT INTO delegacoes (nome, ordem) VALUES (?, ?)");
                $stmt->execute([$nome, (int)($input['ordem'] ?? 0)]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Delegação criada"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $fields = []; $params = [];
                if (isset($input['nome'])) { $fields[] = "nome = ?"; $params[] = trim($input['nome']); }
                if (isset($input['ordem'])) { $fields[] = "ordem = ?"; $params[] = (int)$input['ordem']; }
                if (!$fields) json_response(["error" => "Nada para atualizar."], 400);
                $params[] = $id;
                $conn->prepare("UPDATE delegacoes SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
                json_response(["message" => "Delegação atualizada"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE' && $id) {
            try {
                // Desvincula funções antes de remover (sem FK por compat).
                $conn->prepare("UPDATE funcoes SET delegacao_id = NULL WHERE delegacao_id = ?")->execute([$id]);
                $conn->prepare("DELETE FROM delegacoes WHERE id = ?")->execute([$id]);
                json_response(["message" => "Delegação removida"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- TIPOS DE VEÍCULO --------------------
    case 'veiculoTipos':
        if ($method === 'GET') {
            try {
                $rows = $conn->query("SELECT * FROM veiculo_tipos ORDER BY grupo, nome")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) { $r['id'] = (string)$r['id']; $r['ativo'] = ((int)$r['ativo']) === 1; }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $nome = trim($input['nome'] ?? '');
            $grupo = $input['grupo'] ?? 'Veículos';
            if ($nome === '') json_response(["error" => "Nome é obrigatório."], 400);
            if (!in_array($grupo, ['Veículos', 'Equipamentos'], true)) {
                json_response(["error" => "Grupo inválido (use 'Veículos' ou 'Equipamentos')."], 400);
            }
            try {
                $stmt = $conn->prepare("INSERT INTO veiculo_tipos (nome, grupo, ativo) VALUES (?, ?, 1)");
                $stmt->execute([$nome, $grupo]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Tipo criado"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $fields = []; $params = [];
                if (isset($input['nome'])) { $fields[] = "nome = ?"; $params[] = trim($input['nome']); }
                if (isset($input['grupo'])) {
                    if (!in_array($input['grupo'], ['Veículos', 'Equipamentos'], true)) {
                        json_response(["error" => "Grupo inválido."], 400);
                    }
                    $fields[] = "grupo = ?"; $params[] = $input['grupo'];
                }
                if (isset($input['ativo'])) { $fields[] = "ativo = ?"; $params[] = !empty($input['ativo']) ? 1 : 0; }
                if (!$fields) json_response(["error" => "Nada para atualizar."], 400);
                $params[] = $id;
                $conn->prepare("UPDATE veiculo_tipos SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
                json_response(["message" => "Tipo atualizado"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE' && $id) {
            try {
                $conn->prepare("DELETE FROM veiculo_tipos WHERE id = ?")->execute([$id]);
                json_response(["message" => "Tipo removido"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- HISTOGRAMA (valores por semana) --------------------
    case 'histograma':
        if ($method === 'GET') {
            $semana = $_GET['semana'] ?? '';
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $semana)) {
                json_response(["error" => "Parâmetro 'semana' (YYYY-MM-DD, segunda-feira) é obrigatório."], 400);
            }
            try {
                $stmt = $conn->prepare("SELECT obra_key, recurso_tipo, recurso_chave, valor FROM histograma_valores WHERE semana = ?");
                $stmt->execute([$semana]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) $r['valor'] = (int)$r['valor'];
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            // Upsert em lote da semana: substitui os valores enviados.
            $semana = $input['semana'] ?? '';
            $rows = $input['rows'] ?? null;
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $semana)) {
                json_response(["error" => "'semana' (YYYY-MM-DD) é obrigatória."], 400);
            }
            if (!is_array($rows)) json_response(["error" => "Payload deve conter 'rows'."], 400);
            try {
                $conn->beginTransaction();
                $stmt = $conn->prepare("
                    INSERT INTO histograma_valores (semana, obra_key, recurso_tipo, recurso_chave, valor)
                    VALUES (:semana, :obra_key, :recurso_tipo, :recurso_chave, :valor)
                    ON DUPLICATE KEY UPDATE valor = VALUES(valor)
                ");
                $count = 0;
                foreach ($rows as $r) {
                    if (!isset($r['obra_key'], $r['recurso_tipo'], $r['recurso_chave'])) continue;
                    $stmt->execute([
                        'semana'        => $semana,
                        'obra_key'      => (string)$r['obra_key'],
                        'recurso_tipo'  => (string)$r['recurso_tipo'],
                        'recurso_chave' => mb_substr((string)$r['recurso_chave'], 0, 120),
                        'valor'         => (int)($r['valor'] ?? 0),
                    ]);
                    $count++;
                }
                $conn->commit();
                logAudit($conn, $authUser ?? null, 'histograma_valores', $semana, 'upsert', null, ['semana' => $semana, 'celulas' => $count]);
                json_response(["saved" => $count]);
            } catch (PDOException $e) {
                $conn->rollBack();
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- FEATURE FLAGS --------------------
    case 'featureFlags':
        // Leitura liberada a qualquer autenticado: `useFeatureFlag`/`FeatureGate`
        // consultam as flags em telas comuns. Escrita é GM — ligar/desligar flag
        // altera comportamento de produção e a tela (/gm/feature-flags) é GM-only.
        if ($method !== 'GET') {
            exigirGm($conn, $authUser, 'a alteração de feature flags');
        }
        if ($method === 'GET') {
            try {
                $rows = $conn->query("SELECT id, flag_key, obra_id, enabled, description, updated_by, updated_at FROM feature_flags ORDER BY flag_key")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['enabled'] = ((int)$r['enabled']) === 1;
                }
                json_response($rows);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            $flag_key = trim($input['flag_key'] ?? '');
            $obra_id = $input['obra_id'] ?? null;
            $enabled = !empty($input['enabled']) ? 1 : 0;
            $description = $input['description'] ?? null;

            if (!$flag_key) json_response(["error" => "flag_key é obrigatório."], 400);

            try {
                $stmt = $conn->prepare("
                    INSERT INTO feature_flags (flag_key, obra_id, enabled, description, updated_by)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE enabled = ?, updated_by = ?
                ");
                $updated_by = $authUser['login'] ?? 'system';
                $stmt->execute([$flag_key, $obra_id, $enabled, $description, $updated_by, $enabled, $updated_by]);
                json_response(["message" => "Flag salva"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $fields = []; $params = [];
                if (isset($input['enabled'])) {
                    $fields[] = "enabled = ?";
                    $params[] = !empty($input['enabled']) ? 1 : 0;
                }
                if (isset($input['description'])) {
                    $fields[] = "description = ?";
                    $params[] = $input['description'];
                }
                if ($fields) {
                    $fields[] = "updated_by = ?";
                    $params[] = $authUser['login'] ?? 'system';
                    $params[] = $id;
                    $conn->prepare("UPDATE feature_flags SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
                }
                json_response(["message" => "Flag atualizada"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'DELETE' && $id) {
            try {
                $conn->prepare("DELETE FROM feature_flags WHERE id = ?")->execute([$id]);
                json_response(["message" => "Flag removida"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- NOTIFICAÇÕES --------------------
    case 'notificacoes':
        if ($method === 'GET') {
            try {
                $role_scopes = $_GET['role_scopes'] ?? '';
                if (!$role_scopes) json_response(["error" => "role_scopes é obrigatório."], 400);

                $scopes = array_filter(explode(',', $role_scopes));
                // Gate fino: além do módulo (exigido acima), o usuário só lê os
                // escopos que de fato possui. Pedir `financeiro` sem o módulo
                // Financeiro deixa de retornar linhas.
                $escoposPermitidos = [];
                if (nivelAcessoModulo($conn, $authUser, 'financeiro') >= NIVEL_VISUALIZAR) {
                    $escoposPermitidos[] = 'financeiro';
                }
                if (nivelAcessoModulo($conn, $authUser, 'almoxarifado') >= NIVEL_VISUALIZAR) {
                    $escoposPermitidos[] = 'compras';
                }
                $scopes = array_values(array_intersect($scopes, $escoposPermitidos));
                if (!$scopes) json_response([]);


                $placeholders = implode(',', array_fill(0, count($scopes), '?'));
                $rows = $conn->prepare(
                    "SELECT id, tipo, role_scope, target_id, titulo, mensagem, autor_login, autor_id, lida_por, created_at
                     FROM notificacoes
                     WHERE role_scope IN ($placeholders)
                     ORDER BY created_at DESC
                     LIMIT 100"
                );
                $rows->execute($scopes);
                $data = $rows->fetchAll(PDO::FETCH_ASSOC);
                foreach ($data as &$r) {
                    $r['id'] = (string)$r['id'];
                    $r['lida_por'] = $r['lida_por'] ? json_decode($r['lida_por'], true) : [];
                }
                json_response($data);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            try {
                $tipo = $input['tipo'] ?? '';
                $role_scope = $input['role_scope'] ?? '';
                $titulo = $input['titulo'] ?? '';

                if (!$tipo || !$role_scope || !$titulo) {
                    json_response(["error" => "tipo, role_scope e titulo são obrigatórios."], 400);
                }

                $stmt = $conn->prepare("
                    INSERT INTO notificacoes (tipo, role_scope, target_id, titulo, mensagem, autor_login, autor_id, user_id, card_id, texto, lida_por)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $tipo,
                    $role_scope,
                    $input['target_id'] ?? null,
                    $titulo,
                    $input['mensagem'] ?? null,
                    // Autoria vem do TOKEN, nunca do corpo: aceitar
                    // autor_login/autor_id do cliente permitia forjar quem
                    // assinou a notificação.
                    $authUser['login'] ?? null,
                    $authUser['user_id'] ?? null,
                    $input['user_id'] ?? null,
                    $input['card_id'] ?? null,
                    $input['texto'] ?? null,
                    isset($input['lida_por']) ? json_encode($input['lida_por']) : null,
                ]);
                json_response(["id" => (string)$conn->lastInsertId(), "message" => "Notificação criada"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'PUT' && $id) {
            try {
                $lida_por = $input['lida_por'] ?? [];
                $stmt = $conn->prepare("UPDATE notificacoes SET lida_por = ? WHERE id = ?");
                $stmt->execute([json_encode($lida_por), $id]);
                json_response(["message" => "Notificação atualizada"]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        break;

    // -------------------- DIAGNÓSTICO DE PERMISSÕES (DEBUG) --------------------
    case 'diagnostico-permissoes':
        // Expõe schema e estatísticas de usuários, e o POST executa DDL: é
        // ferramenta de GM inteira. O gate antigo lia $authUser['is_gm'], campo
        // que o token nunca carrega (só user_id/login/exp) — nunca autorizava
        // ninguém e dava falsa impressão de estar protegido, enquanto o GET
        // sequer exigia token.
        exigirGm($conn, $authUser, 'o diagnóstico de permissões');
        if ($method === 'GET') {
            try {
                // Verifica se as colunas de matriz de permissões existem
                $stmt = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'matriz_permissoes'");
                $temMatriz = $stmt && $stmt->fetch() !== false;

                $stmt = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'papeis_permissao'");
                $temPapeis = $stmt && $stmt->fetch() !== false;

                $stmt = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'acesso_compras'");
                $temCompras = $stmt && $stmt->fetch() !== false;

                // Verifica quantos usuários têm permissões salvas
                $stmt = $conn->query("SELECT COUNT(*) as total,
                                            SUM(CASE WHEN matriz_permissoes IS NOT NULL THEN 1 ELSE 0 END) as com_matriz,
                                            SUM(CASE WHEN papeis_permissao IS NOT NULL THEN 1 ELSE 0 END) as com_papeis
                                     FROM usuarios");
                $stats = $stmt->fetch(PDO::FETCH_ASSOC);

                json_response([
                    'colunas' => [
                        'matriz_permissoes' => $temMatriz,
                        'papeis_permissao' => $temPapeis,
                        'acesso_compras' => $temCompras
                    ],
                    'stats' => [
                        'total_usuarios' => (int)$stats['total'],
                        'usuarios_com_matriz' => (int)($stats['com_matriz'] ?? 0),
                        'usuarios_com_papeis' => (int)($stats['com_papeis'] ?? 0)
                    ],
                    'migracao_executada' => $temMatriz && $temPapeis && $temCompras
                ]);
            } catch (PDOException $e) {
                json_response(["error" => err_detail($e)], 500);
            }
        }
        elseif ($method === 'POST') {
            // Cria as colunas faltantes (DDL). O gate de GM já foi aplicado no
            // topo do case, via exigirGm() — que consulta usuarios.is_gm.
            try {
                $aplicadas = [];

                // Criar matriz_permissoes se não existir
                $stmt = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'matriz_permissoes'");
                if (!($stmt && $stmt->fetch() !== false)) {
                    $conn->exec("ALTER TABLE usuarios ADD COLUMN matriz_permissoes LONGTEXT NULL");
                    $aplicadas[] = "matriz_permissoes";
                }

                // Criar papeis_permissao se não existir
                $stmt = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'papeis_permissao'");
                if (!($stmt && $stmt->fetch() !== false)) {
                    $conn->exec("ALTER TABLE usuarios ADD COLUMN papeis_permissao LONGTEXT NULL");
                    $aplicadas[] = "papeis_permissao";
                }

                // Criar acesso_compras se não existir
                $stmt = $conn->query("SHOW COLUMNS FROM usuarios LIKE 'acesso_compras'");
                if (!($stmt && $stmt->fetch() !== false)) {
                    $conn->exec("ALTER TABLE usuarios ADD COLUMN acesso_compras VARCHAR(20) NOT NULL DEFAULT 'nenhum'");
                    $aplicadas[] = "acesso_compras";
                }

                if (empty($aplicadas)) {
                    json_response(["message" => "Todas as colunas já existem. Nenhuma alteração necessária."]);
                } else {
                    json_response([
                        "message" => "Colunas criadas com sucesso.",
                        "colunas_criadas" => $aplicadas
                    ]);
                }
            } catch (PDOException $e) {
                json_response(["error" => "Erro ao criar colunas: " . err_detail($e)], 500);
            }
        }
        break;

    // -------------------- APLICAR INATIVAÇÕES PROGRAMADAS --------------------
    // Aplica no SERVIDOR as inativações de colaboradores cuja data_inativacao já
    // venceu (idempotente). Torna a "programação de inativação" independente de
    // alguém abrir a tela de RH. Pode ser chamada de dois jeitos:
    //   - autenticada (Bearer token) — usada no bootstrap do app; ou
    //   - por cron, enviando o segredo em ?secret= ou no header X-Cron-Secret,
    //     comparado a getenv('CRON_SECRET'). Sem CRON_SECRET definido, só o
    //     modo autenticado funciona.
    // Reusa a mesma lógica de encerramento de responsabilidades do DELETE
    // ?colaborador_id da rota 'responsabilidades'.
    case 'aplicarInativacoesProgramadas':
        if ($method !== 'POST' && $method !== 'GET') {
            json_response(["error" => "Método não permitido"], 405);
        }
        $cronSecret = getenv('CRON_SECRET') ?: '';
        $secretRecebido = $_GET['secret'] ?? ($_SERVER['HTTP_X_CRON_SECRET'] ?? '');
        $viaCron = $cronSecret !== '' && is_string($secretRecebido) && hash_equals($cronSecret, $secretRecebido);
        $ator = ['user_id' => null, 'login' => 'cron'];
        if (!$viaCron) {
            $hdrs = function_exists('getallheaders') ? getallheaders() : [];
            $ah = $hdrs['Authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
            $pl = validateToken(trim(str_replace('Bearer ', '', $ah)));
            if (!$pl) {
                json_response(["error" => "Não autorizado"], 401);
            }
            $ator = $pl;
        }
        try {
            $conn->beginTransaction();
            $sel = $conn->query("
                SELECT id FROM colaboradores
                WHERE ativo = 1 AND data_inativacao IS NOT NULL AND data_inativacao <= CURDATE()
            ");
            $idsVencidos = $sel->fetchAll(PDO::FETCH_COLUMN);
            $hojeAplic = date('Y-m-d');
            $aplicados = [];
            foreach ($idsVencidos as $cid) {
                // Inativar encerra o vínculo com a obra: sem limpar obraAtualId,
                // status_especial e a mobilização agendada, o colaborador
                // continuava contando na obra e podia ficar, por exemplo,
                // "rescindido e de férias" ao mesmo tempo.
                $conn->prepare("
                    UPDATE colaboradores
                       SET ativo = 0, obraAtualId = NULL, status_especial = NULL,
                           mobilizacao_pendente = NULL
                     WHERE id = ?
                ")->execute([$cid]);
                // Encerra períodos de responsabilidade abertos do colaborador...
                $conn->prepare("
                    UPDATE responsabilidades_patrimonios SET data_fim = :fim
                    WHERE colaborador_id = :cid AND data_fim IS NULL
                ")->execute([':fim' => $hojeAplic, ':cid' => $cid]);
                // ...e libera os patrimônios sob responsabilidade dele.
                $conn->prepare("
                    UPDATE patrimonios p
                    LEFT JOIN responsabilidades_patrimonios r ON p.id = r.patrimonio_id AND r.data_fim IS NULL
                    SET p.responsavel_id = NULL
                    WHERE p.responsavel_id = :cid
                ")->execute([':cid' => $cid]);
                registrarEventoColaborador($conn, [
                    'colaborador_id' => $cid,
                    'tipo'           => 'inativacao',
                    'data_efetiva'   => $hojeAplic,
                    'usuario_id'     => $ator['user_id'] ?? null,
                    'observacao'     => 'Inativação programada aplicada',
                ]);
                logAudit($conn, $ator, 'colaboradores', $cid, 'update', null, [
                    'ativo' => 0,
                    'inativacao_programada_aplicada' => true,
                ]);
                $aplicados[] = (string)$cid;
            }

            // --- Mobilizações agendadas vencidas ---
            // Antes isto só acontecia num setInterval de 60s do navegador: se
            // ninguém abrisse o app na data, a mobilização simplesmente não era
            // aplicada. Entra aqui, na rota que o cron já chama, para não
            // exigir mudança no agendamento do host.
            $mobAplicadas = [];
            $pend = $conn->query("
                SELECT id, obraAtualId, status_especial, mobilizacao_pendente
                  FROM colaboradores
                 WHERE ativo = 1
                   AND mobilizacao_pendente IS NOT NULL
                   AND mobilizacao_pendente <> ''
                   AND mobilizacao_pendente <> '[]'
            ")->fetchAll(PDO::FETCH_ASSOC);

            foreach ($pend as $p) {
                $mp = json_decode($p['mobilizacao_pendente'], true);
                if (!is_array($mp) || empty($mp['dataMobilizacao'])) continue;

                // O front grava a data como dd/mm/yyyy.
                $partes = explode('/', (string)$mp['dataMobilizacao']);
                if (count($partes) !== 3) continue;
                $alvo = sprintf('%04d-%02d-%02d', (int)$partes[2], (int)$partes[1], (int)$partes[0]);
                if ($alvo > $hojeAplic) continue;

                $destino       = $mp['obraDestinoId'] ?? null;
                $statusDestino = normalizaStatusColaborador($destino);
                $obraDestino   = ($statusDestino === null && is_numeric($destino)) ? (int)$destino : null;
                if ($statusDestino === null && $obraDestino === null) $statusDestino = 'sem_alocacao';

                $conn->prepare("
                    UPDATE colaboradores
                       SET obraAtualId = :obra, status_especial = :status, mobilizacao_pendente = NULL
                     WHERE id = :id
                ")->execute([
                    ':obra'   => $obraDestino,
                    ':status' => in_array($statusDestino, ['folga', 'afastamento', 'ferias'], true)
                                 ? $statusDestino : null,
                    ':id'     => $p['id'],
                ]);

                // O evento normalmente já foi registrado no agendamento; a
                // guarda de idempotência evita a segunda linha.
                registrarEventoColaborador($conn, [
                    'colaborador_id'  => $p['id'],
                    'tipo'            => $obraDestino !== null ? 'mobilizacao' : 'status',
                    'obra_origem_id'  => $p['obraAtualId'] ?: null,
                    'obra_destino_id' => $obraDestino,
                    'status_origem'   => normalizaStatusColaborador($p['status_especial']),
                    'status_destino'  => $obraDestino !== null ? null : $statusDestino,
                    'data_efetiva'    => $alvo,
                    'usuario_id'      => $ator['user_id'] ?? null,
                ]);

                logAudit($conn, $ator, 'colaboradores', $p['id'], 'update', null, [
                    'mobilizacao_programada_aplicada' => true,
                    'obraAtualId' => $obraDestino,
                    'status_especial' => $statusDestino,
                ]);
                $mobAplicadas[] = (string)$p['id'];
            }

            $conn->commit();
            json_response([
                "aplicados"            => count($aplicados),
                "ids"                  => $aplicados,
                "mobilizacoesAplicadas" => count($mobAplicadas),
                "idsMobilizacoes"      => $mobAplicadas,
            ]);
        } catch (PDOException $e) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }
            json_response(["error" => "Erro ao aplicar inativações: " . err_detail($e)], 500);
        }
        break;

    // -------------------- ROTA PADRÃO --------------------
    default:
        json_response(["message" => "Bem-vindo à API GestãObra. Recurso não encontrado."]);
        break;
}
?>
#!/usr/bin/env node
/**
 * Script de migração: Feature Flags e Notificações do Supabase → MySQL
 *
 * Uso:
 *   node scripts/db/migrar-feature-flags-notificacoes-supabase-mysql.mjs
 *
 * Pré-requisitos:
 *   - Supabase CLI configurado (SUPABASE_URL e SUPABASE_KEY)
 *   - MySQL rodando com as tabelas criadas pela migração 2026_07_20
 *   - Credenciais MySQL em .env ou variáveis de ambiente
 */

import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const mysqlHost = process.env.MYSQL_HOST || "localhost";
const mysqlUser = process.env.MYSQL_USER || "jogabcom_cappucceno";
const mysqlPassword = process.env.MYSQL_PASSWORD || "LUG6Uh9He4gwK4m";
const mysqlDb = process.env.MYSQL_DB || "jogabcom_gestao_obras";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Erro: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configurados.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateFeatureFlags(conn) {
  console.log("📋 Migrando Feature Flags...");
  const { data, error } = await supabase.from("feature_flags").select("*");

  if (error) {
    console.error("❌ Erro ao ler feature_flags do Supabase:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.log("ℹ️  Nenhuma feature flag para migrar.");
    return;
  }

  for (const flag of data) {
    try {
      await conn.execute(
        `INSERT INTO feature_flags (id, flag_key, obra_id, enabled, description, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE enabled = ?, description = ?, updated_by = ?, updated_at = NOW()`,
        [
          flag.id,
          flag.flag_key,
          flag.obra_id,
          flag.enabled ? 1 : 0,
          flag.description,
          flag.updated_by || "migration",
          flag.created_at,
          flag.updated_at,
          flag.enabled ? 1 : 0,
          flag.description,
          flag.updated_by || "migration",
        ],
      );
    } catch (err) {
      console.error(`❌ Erro ao inserir flag ${flag.id}:`, err.message);
    }
  }

  console.log(`✅ ${data.length} feature flags migradas.`);
}

async function migrateNotificacoes(conn) {
  console.log("📋 Migrando Notificações...");
  const { data, error } = await supabase.from("notificacoes").select("*").limit(10000);

  if (error) {
    console.error("❌ Erro ao ler notificacoes do Supabase:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.log("ℹ️  Nenhuma notificação para migrar.");
    return;
  }

  for (const notif of data) {
    try {
      const lida_por = notif.lida_por ? JSON.stringify(notif.lida_por) : null;
      await conn.execute(
        `INSERT INTO notificacoes (id, tipo, role_scope, target_id, titulo, mensagem, autor_login, autor_id, user_id, card_id, texto, lida_por, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE lida_por = ?, updated_at = NOW()`,
        [
          notif.id,
          notif.tipo,
          notif.role_scope,
          notif.target_id,
          notif.titulo,
          notif.mensagem,
          notif.autor_login,
          notif.autor_id,
          notif.user_id,
          notif.card_id,
          notif.texto,
          lida_por,
          notif.created_at,
          notif.updated_at,
          lida_por,
        ],
      );
    } catch (err) {
      console.error(`❌ Erro ao inserir notificação ${notif.id}:`, err.message);
    }
  }

  console.log(`✅ ${data.length} notificações migradas.`);
}

async function main() {
  let conn;
  try {
    console.log("🔌 Conectando ao MySQL...");
    conn = await mysql.createConnection({
      host: mysqlHost,
      user: mysqlUser,
      password: mysqlPassword,
      database: mysqlDb,
      charset: "utf8mb4",
    });

    console.log("✅ Conectado ao MySQL.");
    console.log("🔄 Iniciando migração...");

    await migrateFeatureFlags(conn);
    await migrateNotificacoes(conn);

    console.log("\n✨ Migração concluída com sucesso!");
  } catch (err) {
    console.error("❌ Erro fatal:", err.message);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
      console.log("🔌 Conexão fechada.");
    }
  }
}

main();

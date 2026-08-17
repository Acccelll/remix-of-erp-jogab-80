export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aditivos_contrato: {
        Row: {
          baseline_id: string | null
          created_at: string
          data_aprovacao: string | null
          dias_prazo: number
          documento_url: string | null
          id: string
          numero: string
          obra_id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["aditivo_status"]
          tipo: Database["public"]["Enums"]["aditivo_tipo"]
          updated_at: string
          valor_financeiro: number
          versao_otimista: number
        }
        Insert: {
          baseline_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          dias_prazo?: number
          documento_url?: string | null
          id?: string
          numero: string
          obra_id: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["aditivo_status"]
          tipo: Database["public"]["Enums"]["aditivo_tipo"]
          updated_at?: string
          valor_financeiro?: number
          versao_otimista?: number
        }
        Update: {
          baseline_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          dias_prazo?: number
          documento_url?: string | null
          id?: string
          numero?: string
          obra_id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["aditivo_status"]
          tipo?: Database["public"]["Enums"]["aditivo_tipo"]
          updated_at?: string
          valor_financeiro?: number
          versao_otimista?: number
        }
        Relationships: [
          {
            foreignKeyName: "aditivos_contrato_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "cronograma_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aditivos_contrato_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aditivos_contrato_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      antecipacao_liquidacoes: {
        Row: {
          comprovante_url: string | null
          created_at: string
          data: string
          id: string
          observacoes: string | null
          operacao_id: string
          tipo: string
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string
          data: string
          id?: string
          observacoes?: string | null
          operacao_id: string
          tipo: string
          valor?: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          operacao_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "antecipacao_liquidacoes_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "antecipacao_operacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      antecipacao_operacoes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          com_coobrigacao: boolean
          created_at: string
          criado_por: string | null
          data_operacao: string
          data_vencimento_repasse: string | null
          desagio_total: number
          id: string
          iof: number
          numero_interno: string | null
          observacoes: string | null
          operador_id: string
          solicitacao_id: string | null
          status: Database["public"]["Enums"]["antecipacao_status"]
          tarifas: number
          tipo: Database["public"]["Enums"]["antecipacao_tipo"]
          updated_at: string
          valor_face_total: number
          valor_liquido_recebido: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          com_coobrigacao?: boolean
          created_at?: string
          criado_por?: string | null
          data_operacao: string
          data_vencimento_repasse?: string | null
          desagio_total?: number
          id?: string
          iof?: number
          numero_interno?: string | null
          observacoes?: string | null
          operador_id: string
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["antecipacao_status"]
          tarifas?: number
          tipo?: Database["public"]["Enums"]["antecipacao_tipo"]
          updated_at?: string
          valor_face_total?: number
          valor_liquido_recebido?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          com_coobrigacao?: boolean
          created_at?: string
          criado_por?: string | null
          data_operacao?: string
          data_vencimento_repasse?: string | null
          desagio_total?: number
          id?: string
          iof?: number
          numero_interno?: string | null
          observacoes?: string | null
          operador_id?: string
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["antecipacao_status"]
          tarifas?: number
          tipo?: Database["public"]["Enums"]["antecipacao_tipo"]
          updated_at?: string
          valor_face_total?: number
          valor_liquido_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "antecipacao_operacoes_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores_credito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antecipacao_operacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      antecipacao_titulos: {
        Row: {
          created_at: string
          data_vencimento_original: string | null
          desagio_rateado: number
          dias_exposicao: number | null
          faturamento_nfse_id: string
          id: string
          iof_rateado: number
          nota_fiscal_id: string | null
          obra_id: string | null
          operacao_id: string
          updated_at: string
          valor_antecipado: number
          valor_face: number
        }
        Insert: {
          created_at?: string
          data_vencimento_original?: string | null
          desagio_rateado?: number
          dias_exposicao?: number | null
          faturamento_nfse_id: string
          id?: string
          iof_rateado?: number
          nota_fiscal_id?: string | null
          obra_id?: string | null
          operacao_id: string
          updated_at?: string
          valor_antecipado?: number
          valor_face?: number
        }
        Update: {
          created_at?: string
          data_vencimento_original?: string | null
          desagio_rateado?: number
          dias_exposicao?: number | null
          faturamento_nfse_id?: string
          id?: string
          iof_rateado?: number
          nota_fiscal_id?: string | null
          obra_id?: string | null
          operacao_id?: string
          updated_at?: string
          valor_antecipado?: number
          valor_face?: number
        }
        Relationships: [
          {
            foreignKeyName: "antecipacao_titulos_faturamento_nfse_id_fkey"
            columns: ["faturamento_nfse_id"]
            isOneToOne: false
            referencedRelation: "faturamento_nfse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antecipacao_titulos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antecipacao_titulos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "vw_nf_saldo"
            referencedColumns: ["nota_fiscal_id"]
          },
          {
            foreignKeyName: "antecipacao_titulos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antecipacao_titulos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "antecipacao_titulos_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "antecipacao_operacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          after: Json | null
          before: Json | null
          created_at: string
          entidade: string
          entidade_id: string
          id: string
          obra_id: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entidade: string
          entidade_id: string
          id?: string
          obra_id?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entidade?: string
          entidade_id?: string
          id?: string
          obra_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bms_previstas: {
        Row: {
          created_at: string
          data_corte: string
          data_emissao_nfs_prevista: string | null
          data_inicio_janela: string
          data_pagamento_prevista: string | null
          editado_em: string | null
          id: string
          medicao_id: string | null
          nota_fiscal_id: string | null
          numero: number
          obra_id: string
          observacoes: string | null
          origem: string | null
          status: string
          updated_at: string
          valor_previsto_dinamico: number
          valor_previsto_dinamico_pre_faturamento: number | null
          valor_previsto_inicial: number
          valor_realizado: number | null
          versao_otimista: number
        }
        Insert: {
          created_at?: string
          data_corte: string
          data_emissao_nfs_prevista?: string | null
          data_inicio_janela: string
          data_pagamento_prevista?: string | null
          editado_em?: string | null
          id?: string
          medicao_id?: string | null
          nota_fiscal_id?: string | null
          numero: number
          obra_id: string
          observacoes?: string | null
          origem?: string | null
          status?: string
          updated_at?: string
          valor_previsto_dinamico?: number
          valor_previsto_dinamico_pre_faturamento?: number | null
          valor_previsto_inicial?: number
          valor_realizado?: number | null
          versao_otimista?: number
        }
        Update: {
          created_at?: string
          data_corte?: string
          data_emissao_nfs_prevista?: string | null
          data_inicio_janela?: string
          data_pagamento_prevista?: string | null
          editado_em?: string | null
          id?: string
          medicao_id?: string | null
          nota_fiscal_id?: string | null
          numero?: number
          obra_id?: string
          observacoes?: string | null
          origem?: string | null
          status?: string
          updated_at?: string
          valor_previsto_dinamico?: number
          valor_previsto_dinamico_pre_faturamento?: number | null
          valor_previsto_inicial?: number
          valor_realizado?: number | null
          versao_otimista?: number
        }
        Relationships: [
          {
            foreignKeyName: "bms_previstas_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bms_previstas_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bms_previstas_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "vw_nf_saldo"
            referencedColumns: ["nota_fiscal_id"]
          },
          {
            foreignKeyName: "bms_previstas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bms_previstas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      bms_redistribuicao: {
        Row: {
          bms_destino_numero: number
          bms_origem_numero: number
          created_at: string
          cronograma_item_id: string | null
          descricao_item: string | null
          id: string
          motivo: string
          obra_id: string
          valor_absorvido: number
          valor_atrasado: number
        }
        Insert: {
          bms_destino_numero: number
          bms_origem_numero: number
          created_at?: string
          cronograma_item_id?: string | null
          descricao_item?: string | null
          id?: string
          motivo?: string
          obra_id: string
          valor_absorvido?: number
          valor_atrasado?: number
        }
        Update: {
          bms_destino_numero?: number
          bms_origem_numero?: number
          created_at?: string
          cronograma_item_id?: string | null
          descricao_item?: string | null
          id?: string
          motivo?: string
          obra_id?: string
          valor_absorvido?: number
          valor_atrasado?: number
        }
        Relationships: [
          {
            foreignKeyName: "bms_redistribuicao_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bms_redistribuicao_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      board_automacoes: {
        Row: {
          acoes: Json
          ativa: boolean
          board_id: string
          created_at: string
          criado_por: string | null
          gatilho: Json
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          acoes?: Json
          ativa?: boolean
          board_id: string
          created_at?: string
          criado_por?: string | null
          gatilho: Json
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          acoes?: Json
          ativa?: boolean
          board_id?: string
          created_at?: string
          criado_por?: string | null
          gatilho?: Json
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_automacoes_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_campos: {
        Row: {
          board_id: string
          created_at: string
          id: string
          mostrar_frente: boolean
          nome: string
          obrigatorio: boolean
          opcoes: Json | null
          ordem: number
          tipo: string
          valor_padrao: string | null
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          mostrar_frente?: boolean
          nome: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          tipo?: string
          valor_padrao?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          mostrar_frente?: boolean
          nome?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          tipo?: string
          valor_padrao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_campos_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_extensoes: {
        Row: {
          ativado_por: string | null
          ativo: boolean
          board_id: string
          config: Json
          created_at: string
          extensao_codigo: string
          id: string
          mostrar_resumo: boolean
          ordem: number
          updated_at: string
        }
        Insert: {
          ativado_por?: string | null
          ativo?: boolean
          board_id: string
          config?: Json
          created_at?: string
          extensao_codigo: string
          id?: string
          mostrar_resumo?: boolean
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativado_por?: string | null
          ativo?: boolean
          board_id?: string
          config?: Json
          created_at?: string
          extensao_codigo?: string
          id?: string
          mostrar_resumo?: boolean
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_extensoes_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_extensoes_extensao_codigo_fkey"
            columns: ["extensao_codigo"]
            isOneToOne: false
            referencedRelation: "kanban_extensoes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      board_favoritos: {
        Row: {
          board_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_favoritos_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_listas: {
        Row: {
          arquivada: boolean
          board_id: string
          cor: string | null
          created_at: string
          estado_operacional: string | null
          id: string
          nome: string
          ordenacao: string
          origem_externa: string | null
          origem_id: string | null
          posicao: number
          updated_at: string
          wip_limite: number | null
        }
        Insert: {
          arquivada?: boolean
          board_id: string
          cor?: string | null
          created_at?: string
          estado_operacional?: string | null
          id?: string
          nome: string
          ordenacao?: string
          origem_externa?: string | null
          origem_id?: string | null
          posicao?: number
          updated_at?: string
          wip_limite?: number | null
        }
        Update: {
          arquivada?: boolean
          board_id?: string
          cor?: string | null
          created_at?: string
          estado_operacional?: string | null
          id?: string
          nome?: string
          ordenacao?: string
          origem_externa?: string | null
          origem_id?: string | null
          posicao?: number
          updated_at?: string
          wip_limite?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "board_listas_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_membros: {
        Row: {
          board_id: string
          created_at: string
          id: string
          papel: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          papel?: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_membros_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_membros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          arquivado: boolean
          created_at: string
          descricao: string | null
          fundo_cor: string | null
          fundo_url: string | null
          id: string
          is_template: boolean
          nome: string
          obra_id: string | null
          owner_id: string | null
          setor: string | null
          tipo: string
          updated_at: string
          visibilidade: string
        }
        Insert: {
          arquivado?: boolean
          created_at?: string
          descricao?: string | null
          fundo_cor?: string | null
          fundo_url?: string | null
          id?: string
          is_template?: boolean
          nome: string
          obra_id?: string | null
          owner_id?: string | null
          setor?: string | null
          tipo?: string
          updated_at?: string
          visibilidade?: string
        }
        Update: {
          arquivado?: boolean
          created_at?: string
          descricao?: string | null
          fundo_cor?: string | null
          fundo_url?: string | null
          id?: string
          is_template?: boolean
          nome?: string
          obra_id?: string | null
          owner_id?: string | null
          setor?: string | null
          tipo?: string
          updated_at?: string
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boards_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      card_anexos: {
        Row: {
          card_id: string
          created_at: string
          enviado_por: string | null
          id: string
          mime: string | null
          nome: string
          storage_path: string
          tamanho: number | null
        }
        Insert: {
          card_id: string
          created_at?: string
          enviado_por?: string | null
          id?: string
          mime?: string | null
          nome: string
          storage_path: string
          tamanho?: number | null
        }
        Update: {
          card_id?: string
          created_at?: string
          enviado_por?: string | null
          id?: string
          mime?: string | null
          nome?: string
          storage_path?: string
          tamanho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_anexos_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_atividades: {
        Row: {
          ator_id: string | null
          ator_nome: string | null
          card_id: string
          created_at: string
          detalhe: Json | null
          evento: string
          id: string
        }
        Insert: {
          ator_id?: string | null
          ator_nome?: string | null
          card_id: string
          created_at?: string
          detalhe?: Json | null
          evento: string
          id?: string
        }
        Update: {
          ator_id?: string | null
          ator_nome?: string | null
          card_id?: string
          created_at?: string
          detalhe?: Json | null
          evento?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_atividades_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_board_posicao: {
        Row: {
          arquivada: boolean
          board_id: string
          card_id: string
          lista_id: string
          posicao: number
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          board_id: string
          card_id: string
          lista_id: string
          posicao?: number
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          board_id?: string
          card_id?: string
          lista_id?: string
          posicao?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_board_posicao_board_fk"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_board_posicao_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_board_posicao_lista_fk"
            columns: ["lista_id", "board_id"]
            isOneToOne: false
            referencedRelation: "board_listas"
            referencedColumns: ["id", "board_id"]
          },
        ]
      }
      card_campos_valores: {
        Row: {
          campo_id: string
          card_id: string
          updated_at: string
          valor: Json | null
        }
        Insert: {
          campo_id: string
          card_id: string
          updated_at?: string
          valor?: Json | null
        }
        Update: {
          campo_id?: string
          card_id?: string
          updated_at?: string
          valor?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "card_campos_valores_campo_id_fkey"
            columns: ["campo_id"]
            isOneToOne: false
            referencedRelation: "board_campos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_campos_valores_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_checklist_itens: {
        Row: {
          card_id: string
          concluido: boolean
          created_at: string
          grupo: string | null
          id: string
          ordem: number
          prazo: string | null
          responsavel_id: string | null
          texto: string
          updated_at: string
        }
        Insert: {
          card_id: string
          concluido?: boolean
          created_at?: string
          grupo?: string | null
          id?: string
          ordem?: number
          prazo?: string | null
          responsavel_id?: string | null
          texto: string
          updated_at?: string
        }
        Update: {
          card_id?: string
          concluido?: boolean
          created_at?: string
          grupo?: string | null
          id?: string
          ordem?: number
          prazo?: string | null
          responsavel_id?: string | null
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_checklist_itens_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_comentarios: {
        Row: {
          autor: string | null
          autor_id: string | null
          autor_nome: string | null
          card_id: string
          created_at: string
          id: string
          parent_id: string | null
          reply_to: string | null
          texto: string
          updated_at: string
        }
        Insert: {
          autor?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          card_id: string
          created_at?: string
          id?: string
          parent_id?: string | null
          reply_to?: string | null
          texto: string
          updated_at?: string
        }
        Update: {
          autor?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          card_id?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          reply_to?: string | null
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_comentarios_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_custom_field_valores: {
        Row: {
          campo_id: string
          card_id: string
          created_at: string
          id: string
          valor: Json | null
        }
        Insert: {
          campo_id: string
          card_id: string
          created_at?: string
          id?: string
          valor?: Json | null
        }
        Update: {
          campo_id?: string
          card_id?: string
          created_at?: string
          id?: string
          valor?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "card_custom_field_valores_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_custom_fields: {
        Row: {
          created_at: string
          external_id: string | null
          fonte: string
          id: string
          nome: string
          options: Json
          tipo: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          fonte?: string
          id?: string
          nome: string
          options?: Json
          tipo: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          fonte?: string
          id?: string
          nome?: string
          options?: Json
          tipo?: string
        }
        Relationships: []
      }
      card_entity_links: {
        Row: {
          archived_at: string | null
          card_id: string
          created_at: string
          created_by: string | null
          display_order: number
          empresa_id: string | null
          entity_id: string
          entity_type: string
          extensao_codigo: string
          id: string
          is_primary: boolean
          metadata: Json
          origem: string
          relationship_type: string
          situacao: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          card_id: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          empresa_id?: string | null
          entity_id: string
          entity_type: string
          extensao_codigo: string
          id?: string
          is_primary?: boolean
          metadata?: Json
          origem?: string
          relationship_type?: string
          situacao?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          card_id?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          empresa_id?: string | null
          entity_id?: string
          entity_type?: string
          extensao_codigo?: string
          id?: string
          is_primary?: boolean
          metadata?: Json
          origem?: string
          relationship_type?: string
          situacao?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_entity_links_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_entity_links_extensao_codigo_fkey"
            columns: ["extensao_codigo"]
            isOneToOne: false
            referencedRelation: "kanban_extensoes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      card_grupos_negociacao: {
        Row: {
          created_at: string
          id: string
          rotulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          rotulo: string
        }
        Update: {
          created_at?: string
          id?: string
          rotulo?: string
        }
        Relationships: []
      }
      card_label_links: {
        Row: {
          card_id: string
          created_at: string
          label_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          label_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_label_links_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_label_links_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "card_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      card_labels: {
        Row: {
          board_id: string | null
          cor: string | null
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          board_id?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          board_id?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_labels_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_local: {
        Row: {
          card_id: string
          endereco: string | null
          lat: number | null
          lng: number | null
          updated_at: string
        }
        Insert: {
          card_id: string
          endereco?: string | null
          lat?: number | null
          lng?: number | null
          updated_at?: string
        }
        Update: {
          card_id?: string
          endereco?: string | null
          lat?: number | null
          lng?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_local_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_membros: {
        Row: {
          card_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_membros_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_membros_user_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_membros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      card_membros_externos: {
        Row: {
          avatar_url: string | null
          card_id: string
          created_at: string
          external_id: string | null
          fonte: string
          id: string
          nome: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          card_id: string
          created_at?: string
          external_id?: string | null
          fonte?: string
          id?: string
          nome: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          card_id?: string
          created_at?: string
          external_id?: string | null
          fonte?: string
          id?: string
          nome?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_membros_externos_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_recursos: {
        Row: {
          card_id: string
          created_at: string
          data_necessidade_obra: string | null
          id: string
          prazo_notif_compras: string | null
          prazo_notif_producao: string | null
          prazo_pedido: string | null
          prazo_prod_iniciar: string | null
          tipo_recurso: string | null
          updated_at: string
          valor_estimado: number | null
          valor_oc: number | null
        }
        Insert: {
          card_id: string
          created_at?: string
          data_necessidade_obra?: string | null
          id?: string
          prazo_notif_compras?: string | null
          prazo_notif_producao?: string | null
          prazo_pedido?: string | null
          prazo_prod_iniciar?: string | null
          tipo_recurso?: string | null
          updated_at?: string
          valor_estimado?: number | null
          valor_oc?: number | null
        }
        Update: {
          card_id?: string
          created_at?: string
          data_necessidade_obra?: string | null
          id?: string
          prazo_notif_compras?: string | null
          prazo_notif_producao?: string | null
          prazo_pedido?: string | null
          prazo_prod_iniciar?: string | null
          tipo_recurso?: string | null
          updated_at?: string
          valor_estimado?: number | null
          valor_oc?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_recursos_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_secoes_visiveis: {
        Row: {
          card_id: string
          created_at: string
          criado_por: string | null
          secao: string
        }
        Insert: {
          card_id: string
          created_at?: string
          criado_por?: string | null
          secao: string
        }
        Update: {
          card_id?: string
          created_at?: string
          criado_por?: string | null
          secao?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_secoes_visiveis_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_setores: {
        Row: {
          card_id: string
          created_at: string
          setor: string
          status_setor: string | null
          subsetor: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          setor: string
          status_setor?: string | null
          subsetor?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          setor?: string
          status_setor?: string | null
          subsetor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_setores_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_tipos: {
        Row: {
          ativo: boolean
          codigo: string
          cor: string | null
          created_at: string
          descricao: string | null
          extensoes_padrao: string[]
          icone: string | null
          id: string
          nome: string
          ordem: number
          sistema: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          cor?: string | null
          created_at?: string
          descricao?: string | null
          extensoes_padrao?: string[]
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
          sistema?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          cor?: string | null
          created_at?: string
          descricao?: string | null
          extensoes_padrao?: string[]
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
          sistema?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      card_views_salvas: {
        Row: {
          created_at: string
          criado_por: string | null
          filtros: Json | null
          id: string
          nome: string
          setor: string | null
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          filtros?: Json | null
          id?: string
          nome: string
          setor?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          filtros?: Json | null
          id?: string
          nome?: string
          setor?: string | null
        }
        Relationships: []
      }
      cards: {
        Row: {
          arquivado: boolean
          capa_cor: string | null
          capa_url: string | null
          card_tipo_id: string | null
          cover_color: string | null
          cover_url: string | null
          created_at: string
          criado_por: string | null
          cronograma_item_id: string | null
          data_inicio: string | null
          descricao: string | null
          due_complete: boolean | null
          grupo_negociacao_id: string | null
          id: string
          lembrete: string | null
          numero: number
          obra_id: string | null
          origem_externa: string | null
          origem_id: string | null
          origem_url: string | null
          posicao: number | null
          prazo: string | null
          responsavel_id: string | null
          status: string | null
          tipo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivado?: boolean
          capa_cor?: string | null
          capa_url?: string | null
          card_tipo_id?: string | null
          cover_color?: string | null
          cover_url?: string | null
          created_at?: string
          criado_por?: string | null
          cronograma_item_id?: string | null
          data_inicio?: string | null
          descricao?: string | null
          due_complete?: boolean | null
          grupo_negociacao_id?: string | null
          id?: string
          lembrete?: string | null
          numero?: number
          obra_id?: string | null
          origem_externa?: string | null
          origem_id?: string | null
          origem_url?: string | null
          posicao?: number | null
          prazo?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivado?: boolean
          capa_cor?: string | null
          capa_url?: string | null
          card_tipo_id?: string | null
          cover_color?: string | null
          cover_url?: string | null
          created_at?: string
          criado_por?: string | null
          cronograma_item_id?: string | null
          data_inicio?: string | null
          descricao?: string | null
          due_complete?: boolean | null
          grupo_negociacao_id?: string | null
          id?: string
          lembrete?: string | null
          numero?: number
          obra_id?: string | null
          origem_externa?: string | null
          origem_id?: string | null
          origem_url?: string | null
          posicao?: number | null
          prazo?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_card_tipo_id_fkey"
            columns: ["card_tipo_id"]
            isOneToOne: false
            referencedRelation: "card_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_criado_por_fk"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_obra_id_fk"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_obra_id_fk"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "cards_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "cards_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      causas_nao_conclusao: {
        Row: {
          ativa: boolean
          ativo: boolean
          categoria: string | null
          chave: string
          created_at: string
          label: string
          ordem: number | null
        }
        Insert: {
          ativa?: boolean
          ativo?: boolean
          categoria?: string | null
          chave: string
          created_at?: string
          label: string
          ordem?: number | null
        }
        Update: {
          ativa?: boolean
          ativo?: boolean
          categoria?: string | null
          chave?: string
          created_at?: string
          label?: string
          ordem?: number | null
        }
        Relationships: []
      }
      centros_custo_totvs: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          obra_id: string | null
          owner_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          obra_id?: string | null
          owner_id?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          obra_id?: string | null
          owner_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_totvs_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "centros_custo_totvs_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      clientes: {
        Row: {
          aliquota_cbs: number | null
          aliquota_ibs: number | null
          aliquota_inss: number | null
          aliquota_iss: number | null
          cnpj: string | null
          created_at: string
          dia_fixo_pagamento: number | null
          dias_fixos_pagamento: number[]
          grupo_economico: string | null
          id: string
          nome: string
          observacoes: string | null
          owner_id: string | null
          percentual_material: number | null
          prazo_emitir_nf_dias: number | null
          prazo_pagamento_dias: number | null
          updated_at: string
        }
        Insert: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_inss?: number | null
          aliquota_iss?: number | null
          cnpj?: string | null
          created_at?: string
          dia_fixo_pagamento?: number | null
          dias_fixos_pagamento?: number[]
          grupo_economico?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          owner_id?: string | null
          percentual_material?: number | null
          prazo_emitir_nf_dias?: number | null
          prazo_pagamento_dias?: number | null
          updated_at?: string
        }
        Update: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_inss?: number | null
          aliquota_iss?: number | null
          cnpj?: string | null
          created_at?: string
          dia_fixo_pagamento?: number | null
          dias_fixos_pagamento?: number[]
          grupo_economico?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          owner_id?: string | null
          percentual_material?: number | null
          prazo_emitir_nf_dias?: number | null
          prazo_pagamento_dias?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          cep: string
          chave_pix: string | null
          cpf: string
          created_at: string
          data_admissao: string
          data_emissao_cpf: string
          data_emissao_pis: string
          data_emissao_rg: string
          data_inativacao: string | null
          data_nascimento: string
          data_rescisao: string | null
          documentos: Json
          endereco: string
          estado_civil: string
          etnia: string
          ferias: Json
          forma_salario: string
          funcao: string
          genero: string
          historico: Json
          id: string
          integracoes: Json
          local_nascimento: string
          matricula: string
          mobilizacao_pendente: Json | null
          motivo_inativacao: string | null
          nacionalidade: string
          nome: string
          nome_conjuge: string
          nome_mae: string
          nome_pai: string
          numero_banco: string | null
          numero_conta: string | null
          obra_atual_id: string | null
          orgao_emissor_rg: string
          pis: string
          responsabilidades: Json | null
          rg: string
          salario: string
          status_especial: string | null
          tipo_chave_pix: string | null
          tipo_conta: string | null
          uf_emissor_rg: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          cep?: string
          chave_pix?: string | null
          cpf?: string
          created_at?: string
          data_admissao?: string
          data_emissao_cpf?: string
          data_emissao_pis?: string
          data_emissao_rg?: string
          data_inativacao?: string | null
          data_nascimento?: string
          data_rescisao?: string | null
          documentos?: Json
          endereco?: string
          estado_civil?: string
          etnia?: string
          ferias?: Json
          forma_salario?: string
          funcao?: string
          genero?: string
          historico?: Json
          id?: string
          integracoes?: Json
          local_nascimento?: string
          matricula: string
          mobilizacao_pendente?: Json | null
          motivo_inativacao?: string | null
          nacionalidade?: string
          nome: string
          nome_conjuge?: string
          nome_mae?: string
          nome_pai?: string
          numero_banco?: string | null
          numero_conta?: string | null
          obra_atual_id?: string | null
          orgao_emissor_rg?: string
          pis?: string
          responsabilidades?: Json | null
          rg?: string
          salario?: string
          status_especial?: string | null
          tipo_chave_pix?: string | null
          tipo_conta?: string | null
          uf_emissor_rg?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          cep?: string
          chave_pix?: string | null
          cpf?: string
          created_at?: string
          data_admissao?: string
          data_emissao_cpf?: string
          data_emissao_pis?: string
          data_emissao_rg?: string
          data_inativacao?: string | null
          data_nascimento?: string
          data_rescisao?: string | null
          documentos?: Json
          endereco?: string
          estado_civil?: string
          etnia?: string
          ferias?: Json
          forma_salario?: string
          funcao?: string
          genero?: string
          historico?: Json
          id?: string
          integracoes?: Json
          local_nascimento?: string
          matricula?: string
          mobilizacao_pendente?: Json | null
          motivo_inativacao?: string | null
          nacionalidade?: string
          nome?: string
          nome_conjuge?: string
          nome_mae?: string
          nome_pai?: string
          numero_banco?: string | null
          numero_conta?: string | null
          obra_atual_id?: string | null
          orgao_emissor_rg?: string
          pis?: string
          responsabilidades?: Json | null
          rg?: string
          salario?: string
          status_especial?: string | null
          tipo_chave_pix?: string | null
          tipo_conta?: string | null
          uf_emissor_rg?: string
        }
        Relationships: []
      }
      compromissos_semanais: {
        Row: {
          causa_chave: string | null
          causa_detalhe: string | null
          causa_nao_conclusao: string | null
          concluido: boolean
          concluido_em: string | null
          created_at: string
          id: string
          obra_id: string
          observacao: string | null
          owner_id: string | null
          pacote_id: string | null
          ppc: number | null
          responsavel_id: string | null
          semana_inicio: string | null
          semana_ref: string
          status: string | null
        }
        Insert: {
          causa_chave?: string | null
          causa_detalhe?: string | null
          causa_nao_conclusao?: string | null
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          id?: string
          obra_id: string
          observacao?: string | null
          owner_id?: string | null
          pacote_id?: string | null
          ppc?: number | null
          responsavel_id?: string | null
          semana_inicio?: string | null
          semana_ref: string
          status?: string | null
        }
        Update: {
          causa_chave?: string | null
          causa_detalhe?: string | null
          causa_nao_conclusao?: string | null
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          id?: string
          obra_id?: string
          observacao?: string | null
          owner_id?: string | null
          pacote_id?: string | null
          ppc?: number | null
          responsavel_id?: string | null
          semana_inicio?: string | null
          semana_ref?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compromissos_semanais_pacote_id_fkey"
            columns: ["pacote_id"]
            isOneToOne: false
            referencedRelation: "pacotes_trabalho"
            referencedColumns: ["id"]
          },
        ]
      }
      controle_despesas: {
        Row: {
          cartao: string | null
          centro_custo_id: string | null
          created_at: string
          data_compra: string | null
          descricao: string
          fornecedor: string | null
          id: string
          log_alteracoes: Json
          parcelas: number
          responsavel: string
          solicitacao_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          cartao?: string | null
          centro_custo_id?: string | null
          created_at?: string
          data_compra?: string | null
          descricao?: string
          fornecedor?: string | null
          id?: string
          log_alteracoes?: Json
          parcelas?: number
          responsavel?: string
          solicitacao_id?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          cartao?: string | null
          centro_custo_id?: string | null
          created_at?: string
          data_compra?: string | null
          descricao?: string
          fornecedor?: string | null
          id?: string
          log_alteracoes?: Json
          parcelas?: number
          responsavel?: string
          solicitacao_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "controle_despesas_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_baselines: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          motivo: string
          obra_id: string
          observacoes: string | null
          versao: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          motivo: string
          obra_id: string
          observacoes?: string | null
          versao: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          motivo?: string
          obra_id?: string
          observacoes?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_baselines_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_baselines_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      cronograma_calendario_excecoes: {
        Row: {
          calendario_id: string
          confirmada: boolean
          created_at: string
          data_fim: string
          data_inicio: string
          horas_disponiveis: number | null
          id: string
          trabalha: boolean
        }
        Insert: {
          calendario_id: string
          confirmada?: boolean
          created_at?: string
          data_fim: string
          data_inicio: string
          horas_disponiveis?: number | null
          id?: string
          trabalha?: boolean
        }
        Update: {
          calendario_id?: string
          confirmada?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          horas_disponiveis?: number | null
          id?: string
          trabalha?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_calendario_excecoes_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "cronograma_calendarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_calendarios: {
        Row: {
          created_at: string
          dias_uteis: Json | null
          horas_por_dia: number | null
          id: string
          is_padrao: boolean
          nome: string | null
          obra_id: string
          uid_mpp: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dias_uteis?: Json | null
          horas_por_dia?: number | null
          id?: string
          is_padrao?: boolean
          nome?: string | null
          obra_id: string
          uid_mpp?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dias_uteis?: Json | null
          horas_por_dia?: number | null
          id?: string
          is_padrao?: boolean
          nome?: string | null
          obra_id?: string
          uid_mpp?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cronograma_cenario_itens: {
        Row: {
          cenario_id: string
          created_at: string
          cronograma_item_id: string | null
          custo: number | null
          data_fim: string | null
          data_fim_origem: string | null
          data_fim_sim: string | null
          data_inicio: string | null
          data_inicio_origem: string | null
          data_inicio_sim: string | null
          id: string
          item_id: string | null
          observacao: string | null
          percentual_previsto: number | null
          updated_at: string
        }
        Insert: {
          cenario_id: string
          created_at?: string
          cronograma_item_id?: string | null
          custo?: number | null
          data_fim?: string | null
          data_fim_origem?: string | null
          data_fim_sim?: string | null
          data_inicio?: string | null
          data_inicio_origem?: string | null
          data_inicio_sim?: string | null
          id?: string
          item_id?: string | null
          observacao?: string | null
          percentual_previsto?: number | null
          updated_at?: string
        }
        Update: {
          cenario_id?: string
          created_at?: string
          cronograma_item_id?: string | null
          custo?: number | null
          data_fim?: string | null
          data_fim_origem?: string | null
          data_fim_sim?: string | null
          data_inicio?: string | null
          data_inicio_origem?: string | null
          data_inicio_sim?: string | null
          id?: string
          item_id?: string | null
          observacao?: string | null
          percentual_previsto?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_cenario_itens_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cronograma_cenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_cenarios: {
        Row: {
          aplicado_em: string | null
          aplicado_por: string | null
          created_at: string
          created_by: string | null
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          obra_id: string
          status: string
          updated_at: string
        }
        Insert: {
          aplicado_em?: string | null
          aplicado_por?: string | null
          created_at?: string
          created_by?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          obra_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          aplicado_em?: string | null
          aplicado_por?: string | null
          created_at?: string
          created_by?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          obra_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cronograma_dependencias: {
        Row: {
          created_at: string
          id: string
          item_id: string
          lag_dias: number
          lag_minutos: number | null
          obra_id: string
          predecessor_item_id: string | null
          predecessor_uid_mpp: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          lag_dias?: number
          lag_minutos?: number | null
          obra_id: string
          predecessor_item_id?: string | null
          predecessor_uid_mpp?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          lag_dias?: number
          lag_minutos?: number | null
          obra_id?: string
          predecessor_item_id?: string | null
          predecessor_uid_mpp?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_dependencias_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_dependencias_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      cronograma_item_baseline: {
        Row: {
          baseline_id: string
          created_at: string
          cronograma_item_id: string
          custo: number
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          percentual_previsto: number
          uid_mpp: string | null
        }
        Insert: {
          baseline_id: string
          created_at?: string
          cronograma_item_id: string
          custo?: number
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          percentual_previsto?: number
          uid_mpp?: string | null
        }
        Update: {
          baseline_id?: string
          created_at?: string
          cronograma_item_id?: string
          custo?: number
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          percentual_previsto?: number
          uid_mpp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_item_baseline_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "cronograma_baselines"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_item_revisoes: {
        Row: {
          created_at: string
          cronograma_item_id: string
          custo_anterior: number | null
          custo_novo: number | null
          data_fim_anterior: string | null
          data_fim_novo: string | null
          data_inicio_anterior: string | null
          data_inicio_novo: string | null
          descricao_item: string | null
          id: string
          percentual_realizado_anterior: number | null
          percentual_realizado_novo: number | null
          revisao_id: string
          tipo_mudanca: string
        }
        Insert: {
          created_at?: string
          cronograma_item_id: string
          custo_anterior?: number | null
          custo_novo?: number | null
          data_fim_anterior?: string | null
          data_fim_novo?: string | null
          data_inicio_anterior?: string | null
          data_inicio_novo?: string | null
          descricao_item?: string | null
          id?: string
          percentual_realizado_anterior?: number | null
          percentual_realizado_novo?: number | null
          revisao_id: string
          tipo_mudanca: string
        }
        Update: {
          created_at?: string
          cronograma_item_id?: string
          custo_anterior?: number | null
          custo_novo?: number | null
          data_fim_anterior?: string | null
          data_fim_novo?: string | null
          data_inicio_anterior?: string | null
          data_inicio_novo?: string | null
          descricao_item?: string | null
          id?: string
          percentual_realizado_anterior?: number | null
          percentual_realizado_novo?: number | null
          revisao_id?: string
          tipo_mudanca?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_item_revisoes_revisao_id_fkey"
            columns: ["revisao_id"]
            isOneToOne: false
            referencedRelation: "cronograma_revisoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_itens: {
        Row: {
          ativo: boolean
          calendario_uid_mpp: string | null
          caminho_critico: boolean | null
          constraint_data: string | null
          constraint_tipo: number | null
          created_at: string
          critico: boolean
          custo: number | null
          custo_baseline: number | null
          data_fim: string
          data_fim_baseline: string | null
          data_fim_cpm: string | null
          data_fim_real: string | null
          data_fim_reprog: string | null
          data_inicio: string
          data_inicio_baseline: string | null
          data_inicio_cpm: string | null
          data_inicio_real: string | null
          data_inicio_reprog: string | null
          deadline: string | null
          descricao: string | null
          duracao_horas: number | null
          fanout_sucessoras: number | null
          folga_dias: number | null
          folga_livre_dias: number | null
          folga_total: number | null
          id: string
          importancia_classe: string | null
          importancia_score: number | null
          localizacao_id: string | null
          marco: boolean | null
          notas: string | null
          obra_id: string
          ordem: number
          percentual_previsto: number
          percentual_realizado: number
          prioridade: number | null
          recursos_count: number | null
          recursos_status: string | null
          servico_lob: string | null
          uid_mpp: string | null
          updated_at: string
          versao_otimista: number
        }
        Insert: {
          ativo?: boolean
          calendario_uid_mpp?: string | null
          caminho_critico?: boolean | null
          constraint_data?: string | null
          constraint_tipo?: number | null
          created_at?: string
          critico?: boolean
          custo?: number | null
          custo_baseline?: number | null
          data_fim: string
          data_fim_baseline?: string | null
          data_fim_cpm?: string | null
          data_fim_real?: string | null
          data_fim_reprog?: string | null
          data_inicio: string
          data_inicio_baseline?: string | null
          data_inicio_cpm?: string | null
          data_inicio_real?: string | null
          data_inicio_reprog?: string | null
          deadline?: string | null
          descricao?: string | null
          duracao_horas?: number | null
          fanout_sucessoras?: number | null
          folga_dias?: number | null
          folga_livre_dias?: number | null
          folga_total?: number | null
          id?: string
          importancia_classe?: string | null
          importancia_score?: number | null
          localizacao_id?: string | null
          marco?: boolean | null
          notas?: string | null
          obra_id: string
          ordem?: number
          percentual_previsto?: number
          percentual_realizado?: number
          prioridade?: number | null
          recursos_count?: number | null
          recursos_status?: string | null
          servico_lob?: string | null
          uid_mpp?: string | null
          updated_at?: string
          versao_otimista?: number
        }
        Update: {
          ativo?: boolean
          calendario_uid_mpp?: string | null
          caminho_critico?: boolean | null
          constraint_data?: string | null
          constraint_tipo?: number | null
          created_at?: string
          critico?: boolean
          custo?: number | null
          custo_baseline?: number | null
          data_fim?: string
          data_fim_baseline?: string | null
          data_fim_cpm?: string | null
          data_fim_real?: string | null
          data_fim_reprog?: string | null
          data_inicio?: string
          data_inicio_baseline?: string | null
          data_inicio_cpm?: string | null
          data_inicio_real?: string | null
          data_inicio_reprog?: string | null
          deadline?: string | null
          descricao?: string | null
          duracao_horas?: number | null
          fanout_sucessoras?: number | null
          folga_dias?: number | null
          folga_livre_dias?: number | null
          folga_total?: number | null
          id?: string
          importancia_classe?: string | null
          importancia_score?: number | null
          localizacao_id?: string | null
          marco?: boolean | null
          notas?: string | null
          obra_id?: string
          ordem?: number
          percentual_previsto?: number
          percentual_realizado?: number
          prioridade?: number | null
          recursos_count?: number | null
          recursos_status?: string | null
          servico_lob?: string | null
          uid_mpp?: string | null
          updated_at?: string
          versao_otimista?: number
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_itens_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_itens_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      cronograma_marcos: {
        Row: {
          created_at: string
          critico: boolean
          data_baseline: string | null
          data_prevista: string
          data_realizado: string | null
          id: string
          nome: string
          obra_id: string
          observacoes: string | null
          ordem: number
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          critico?: boolean
          data_baseline?: string | null
          data_prevista: string
          data_realizado?: string | null
          id?: string
          nome: string
          obra_id: string
          observacoes?: string | null
          ordem?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          critico?: boolean
          data_baseline?: string | null
          data_prevista?: string
          data_realizado?: string | null
          id?: string
          nome?: string
          obra_id?: string
          observacoes?: string | null
          ordem?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_marcos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_marcos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      cronograma_revisoes: {
        Row: {
          arquivo_nome: string | null
          baseline_id: string | null
          created_at: string
          data_corte: string
          id: string
          numero: number
          obra_id: string
          observacoes: string | null
          totais: Json
        }
        Insert: {
          arquivo_nome?: string | null
          baseline_id?: string | null
          created_at?: string
          data_corte: string
          id?: string
          numero: number
          obra_id: string
          observacoes?: string | null
          totais?: Json
        }
        Update: {
          arquivo_nome?: string | null
          baseline_id?: string | null
          created_at?: string
          data_corte?: string
          id?: string
          numero?: number
          obra_id?: string
          observacoes?: string | null
          totais?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_revisoes_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "cronograma_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_revisoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_revisoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      custo_colaborador_competencia: {
        Row: {
          cargo_lido: string | null
          centro_custo_id: string | null
          centro_custo_nome: string | null
          centro_custo_totvs_id: string | null
          colaborador_id: string
          competencia: string
          cpf: string
          created_at: string
          custo_total: number | null
          fgts: number
          fgts_provisao_13: number
          fgts_provisao_ferias: number
          horas_extras: number
          id: string
          inss_empresa: number
          inss_provisao_13: number
          inss_provisao_ferias: number
          inss_terceiros: number
          matricula_lida: string | null
          proventos: number
          provisao_13: number
          provisao_ferias: number
          rat: number
          updated_at: string
        }
        Insert: {
          cargo_lido?: string | null
          centro_custo_id?: string | null
          centro_custo_nome?: string | null
          centro_custo_totvs_id?: string | null
          colaborador_id: string
          competencia: string
          cpf: string
          created_at?: string
          custo_total?: number | null
          fgts?: number
          fgts_provisao_13?: number
          fgts_provisao_ferias?: number
          horas_extras?: number
          id?: string
          inss_empresa?: number
          inss_provisao_13?: number
          inss_provisao_ferias?: number
          inss_terceiros?: number
          matricula_lida?: string | null
          proventos?: number
          provisao_13?: number
          provisao_ferias?: number
          rat?: number
          updated_at?: string
        }
        Update: {
          cargo_lido?: string | null
          centro_custo_id?: string | null
          centro_custo_nome?: string | null
          centro_custo_totvs_id?: string | null
          colaborador_id?: string
          competencia?: string
          cpf?: string
          created_at?: string
          custo_total?: number | null
          fgts?: number
          fgts_provisao_13?: number
          fgts_provisao_ferias?: number
          horas_extras?: number
          id?: string
          inss_empresa?: number
          inss_provisao_13?: number
          inss_provisao_ferias?: number
          inss_terceiros?: number
          matricula_lida?: string | null
          proventos?: number
          provisao_13?: number
          provisao_ferias?: number
          rat?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custo_colaborador_competencia_centro_custo_totvs_id_fkey"
            columns: ["centro_custo_totvs_id"]
            isOneToOne: false
            referencedRelation: "centros_custo_totvs"
            referencedColumns: ["id"]
          },
        ]
      }
      decimo_terceiro: {
        Row: {
          colaborador_id: string
          competencia: string
          created_at: string
          etapa: string
          id: string
          origem: string
          status: string
          valor: number
        }
        Insert: {
          colaborador_id: string
          competencia: string
          created_at?: string
          etapa?: string
          id?: string
          origem?: string
          status?: string
          valor?: number
        }
        Update: {
          colaborador_id?: string
          competencia?: string
          created_at?: string
          etapa?: string
          id?: string
          origem?: string
          status?: string
          valor?: number
        }
        Relationships: []
      }
      documento_tipos: {
        Row: {
          aviso_dias: number
          created_at: string
          id: string
          nome: string
          vencimento_meses: number
        }
        Insert: {
          aviso_dias?: number
          created_at?: string
          id?: string
          nome: string
          vencimento_meses?: number
        }
        Update: {
          aviso_dias?: number
          created_at?: string
          id?: string
          nome?: string
          vencimento_meses?: number
        }
        Relationships: []
      }
      dp_holerite: {
        Row: {
          admissao: string | null
          base_fgts: number
          base_inss: number
          base_irrf: number
          cargo_lido: string | null
          centro_custo_nome_lido: string | null
          colaborador_id: string | null
          competencia: string
          cpf: string
          created_at: string
          custo_total: number | null
          descontos: number
          fator_k: number | null
          fgts: number
          fgts_provisao_13: number
          fgts_provisao_ferias: number
          horas_extras_valor: number
          id: string
          imported_at: string
          inss: number
          inss_empresa: number
          inss_provisao_13: number
          inss_provisao_ferias: number
          inss_terceiros: number
          irrf: number
          liquido: number
          matricula_lida: string | null
          nome_lido: string | null
          origem: string
          proventos: number
          provisao_13: number
          provisao_ferias: number
          rat: number
          salario_base: number
          tipo: string
          updated_at: string
          verbas: Json
        }
        Insert: {
          admissao?: string | null
          base_fgts?: number
          base_inss?: number
          base_irrf?: number
          cargo_lido?: string | null
          centro_custo_nome_lido?: string | null
          colaborador_id?: string | null
          competencia: string
          cpf: string
          created_at?: string
          custo_total?: number | null
          descontos?: number
          fator_k?: number | null
          fgts?: number
          fgts_provisao_13?: number
          fgts_provisao_ferias?: number
          horas_extras_valor?: number
          id?: string
          imported_at?: string
          inss?: number
          inss_empresa?: number
          inss_provisao_13?: number
          inss_provisao_ferias?: number
          inss_terceiros?: number
          irrf?: number
          liquido?: number
          matricula_lida?: string | null
          nome_lido?: string | null
          origem?: string
          proventos?: number
          provisao_13?: number
          provisao_ferias?: number
          rat?: number
          salario_base?: number
          tipo?: string
          updated_at?: string
          verbas?: Json
        }
        Update: {
          admissao?: string | null
          base_fgts?: number
          base_inss?: number
          base_irrf?: number
          cargo_lido?: string | null
          centro_custo_nome_lido?: string | null
          colaborador_id?: string | null
          competencia?: string
          cpf?: string
          created_at?: string
          custo_total?: number | null
          descontos?: number
          fator_k?: number | null
          fgts?: number
          fgts_provisao_13?: number
          fgts_provisao_ferias?: number
          horas_extras_valor?: number
          id?: string
          imported_at?: string
          inss?: number
          inss_empresa?: number
          inss_provisao_13?: number
          inss_provisao_ferias?: number
          inss_terceiros?: number
          irrf?: number
          liquido?: number
          matricula_lida?: string | null
          nome_lido?: string | null
          origem?: string
          proventos?: number
          provisao_13?: number
          provisao_ferias?: number
          rat?: number
          salario_base?: number
          tipo?: string
          updated_at?: string
          verbas?: Json
        }
        Relationships: []
      }
      empresas: {
        Row: {
          ativa: boolean
          cnpj: string | null
          cor: string | null
          created_at: string
          id: string
          nome_fantasia: string | null
          razao_social: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          cnpj?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          nome_fantasia?: string | null
          razao_social: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          cnpj?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          nome_fantasia?: string | null
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
      }
      faturamento_nfse: {
        Row: {
          aliquota_iss: number
          arquivo_origem: string | null
          base_calculo: number
          codigo_obra: string | null
          codigo_obra_interno: string | null
          codigo_servico: string | null
          codigo_verificacao: string | null
          competencia: string | null
          created_at: string
          data_emissao: string | null
          data_vencimento: string | null
          deducoes: number
          discriminacao: string | null
          id: string
          iss_retido: boolean
          item_lista_servico: string | null
          municipio_prestacao: string | null
          natureza_operacao: string | null
          numero_bms: string | null
          numero_nfse: string
          obra_id: string | null
          origem: string
          outras_retencoes: number
          pedido: string | null
          prestador_cnpj: string | null
          prestador_razao: string | null
          status: string | null
          tomador_cnpj: string | null
          tomador_municipio: string | null
          tomador_razao: string | null
          tomador_uf: string | null
          updated_at: string
          valor_cofins: number
          valor_csll: number
          valor_inss: number
          valor_ir: number
          valor_iss: number
          valor_liquido: number
          valor_pis: number
          valor_servicos: number
          vencimento_origem: string
        }
        Insert: {
          aliquota_iss?: number
          arquivo_origem?: string | null
          base_calculo?: number
          codigo_obra?: string | null
          codigo_obra_interno?: string | null
          codigo_servico?: string | null
          codigo_verificacao?: string | null
          competencia?: string | null
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          deducoes?: number
          discriminacao?: string | null
          id?: string
          iss_retido?: boolean
          item_lista_servico?: string | null
          municipio_prestacao?: string | null
          natureza_operacao?: string | null
          numero_bms?: string | null
          numero_nfse: string
          obra_id?: string | null
          origem?: string
          outras_retencoes?: number
          pedido?: string | null
          prestador_cnpj?: string | null
          prestador_razao?: string | null
          status?: string | null
          tomador_cnpj?: string | null
          tomador_municipio?: string | null
          tomador_razao?: string | null
          tomador_uf?: string | null
          updated_at?: string
          valor_cofins?: number
          valor_csll?: number
          valor_inss?: number
          valor_ir?: number
          valor_iss?: number
          valor_liquido?: number
          valor_pis?: number
          valor_servicos?: number
          vencimento_origem?: string
        }
        Update: {
          aliquota_iss?: number
          arquivo_origem?: string | null
          base_calculo?: number
          codigo_obra?: string | null
          codigo_obra_interno?: string | null
          codigo_servico?: string | null
          codigo_verificacao?: string | null
          competencia?: string | null
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          deducoes?: number
          discriminacao?: string | null
          id?: string
          iss_retido?: boolean
          item_lista_servico?: string | null
          municipio_prestacao?: string | null
          natureza_operacao?: string | null
          numero_bms?: string | null
          numero_nfse?: string
          obra_id?: string | null
          origem?: string
          outras_retencoes?: number
          pedido?: string | null
          prestador_cnpj?: string | null
          prestador_razao?: string | null
          status?: string | null
          tomador_cnpj?: string | null
          tomador_municipio?: string | null
          tomador_razao?: string | null
          tomador_uf?: string | null
          updated_at?: string
          valor_cofins?: number
          valor_csll?: number
          valor_inss?: number
          valor_ir?: number
          valor_iss?: number
          valor_liquido?: number
          valor_pis?: number
          valor_servicos?: number
          vencimento_origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturamento_nfse_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamento_nfse_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      financeiro_divergencias_matriz: {
        Row: {
          campo: string
          detectado_em: string
          id: string
          ref_lancamento: number
          valor_matriz: string | null
          valor_relatorio: string | null
        }
        Insert: {
          campo: string
          detectado_em?: string
          id?: string
          ref_lancamento: number
          valor_matriz?: string | null
          valor_relatorio?: string | null
        }
        Update: {
          campo?: string
          detectado_em?: string
          id?: string
          ref_lancamento?: number
          valor_matriz?: string | null
          valor_relatorio?: string | null
        }
        Relationships: []
      }
      financeiro_evolucao_rollup: {
        Row: {
          cod_natureza: string | null
          created_at: string
          data_snapshot: string
          desc_natureza: string | null
          grupo: string | null
          id: string
          obra_id: string | null
          qtd_titulos: number
          snapshot_id: string | null
          status_cod: number | null
          status_label: string | null
          valor_aberto: number
          valor_pago: number
        }
        Insert: {
          cod_natureza?: string | null
          created_at?: string
          data_snapshot: string
          desc_natureza?: string | null
          grupo?: string | null
          id?: string
          obra_id?: string | null
          qtd_titulos?: number
          snapshot_id?: string | null
          status_cod?: number | null
          status_label?: string | null
          valor_aberto?: number
          valor_pago?: number
        }
        Update: {
          cod_natureza?: string | null
          created_at?: string
          data_snapshot?: string
          desc_natureza?: string | null
          grupo?: string | null
          id?: string
          obra_id?: string | null
          qtd_titulos?: number
          snapshot_id?: string | null
          status_cod?: number | null
          status_label?: string | null
          valor_aberto?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_evolucao_rollup_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_evolucao_rollup_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "financeiro_evolucao_rollup_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "financeiro_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_lancamentos: {
        Row: {
          categoria_indireta: string | null
          centro_custo: string | null
          centro_custo_tipo: string | null
          cliente_fornecedor: string | null
          cnpj_cpf: string | null
          conciliado: boolean
          data_baixa: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          desc_centro_custo: string | null
          dias_atraso: number | null
          dias_atraso_estimado: boolean
          filial: number | null
          historico: string | null
          id: string
          mes_competencia: string | null
          mes_competencia_estimado: boolean
          natureza_tipo: number | null
          nome: string | null
          nome_fantasia: string | null
          numero_documento: string | null
          obra_id: string | null
          origem: string
          pendente_natureza: boolean
          ref_lancamento: number
          snapshot_id: string
          solicitacao_id: string | null
          status_cod: number | null
          status_label: string | null
          superseded_by: string | null
          tipo_documento: string | null
          valor_baixado: number
          valor_desconto: number
          valor_liquido: number
          valor_original: number
        }
        Insert: {
          categoria_indireta?: string | null
          centro_custo?: string | null
          centro_custo_tipo?: string | null
          cliente_fornecedor?: string | null
          cnpj_cpf?: string | null
          conciliado?: boolean
          data_baixa?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          desc_centro_custo?: string | null
          dias_atraso?: number | null
          dias_atraso_estimado?: boolean
          filial?: number | null
          historico?: string | null
          id?: string
          mes_competencia?: string | null
          mes_competencia_estimado?: boolean
          natureza_tipo?: number | null
          nome?: string | null
          nome_fantasia?: string | null
          numero_documento?: string | null
          obra_id?: string | null
          origem?: string
          pendente_natureza?: boolean
          ref_lancamento: number
          snapshot_id: string
          solicitacao_id?: string | null
          status_cod?: number | null
          status_label?: string | null
          superseded_by?: string | null
          tipo_documento?: string | null
          valor_baixado?: number
          valor_desconto?: number
          valor_liquido?: number
          valor_original?: number
        }
        Update: {
          categoria_indireta?: string | null
          centro_custo?: string | null
          centro_custo_tipo?: string | null
          cliente_fornecedor?: string | null
          cnpj_cpf?: string | null
          conciliado?: boolean
          data_baixa?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          desc_centro_custo?: string | null
          dias_atraso?: number | null
          dias_atraso_estimado?: boolean
          filial?: number | null
          historico?: string | null
          id?: string
          mes_competencia?: string | null
          mes_competencia_estimado?: boolean
          natureza_tipo?: number | null
          nome?: string | null
          nome_fantasia?: string | null
          numero_documento?: string | null
          obra_id?: string | null
          origem?: string
          pendente_natureza?: boolean
          ref_lancamento?: number
          snapshot_id?: string
          solicitacao_id?: string | null
          status_cod?: number | null
          status_label?: string | null
          superseded_by?: string | null
          tipo_documento?: string | null
          valor_baixado?: number
          valor_desconto?: number
          valor_liquido?: number
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "financeiro_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_matriz_rateios: {
        Row: {
          atualizado_em: string
          cnpj_cpf: string | null
          cod_ccusto: string | null
          cod_natureza: string | null
          data_baixa: string | null
          data_emissao: string | null
          data_vencimento: string | null
          desc_ccusto: string | null
          desc_natureza: string | null
          filial: number | null
          grupo: string | null
          historico: string | null
          id: string
          natureza_tipo_matriz: number | null
          nome: string | null
          nome_fantasia: string | null
          numero_documento: string | null
          owner_id: string | null
          ref_lancamento: number
          situacao_presumida: string | null
          status_cod_matriz: number | null
          subgrupo: string | null
          tipo_documento: string | null
          valor_baixado: number
          valor_liquido: number
          valor_original: number
          valor_rateio: number
        }
        Insert: {
          atualizado_em?: string
          cnpj_cpf?: string | null
          cod_ccusto?: string | null
          cod_natureza?: string | null
          data_baixa?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          desc_ccusto?: string | null
          desc_natureza?: string | null
          filial?: number | null
          grupo?: string | null
          historico?: string | null
          id?: string
          natureza_tipo_matriz?: number | null
          nome?: string | null
          nome_fantasia?: string | null
          numero_documento?: string | null
          owner_id?: string | null
          ref_lancamento: number
          situacao_presumida?: string | null
          status_cod_matriz?: number | null
          subgrupo?: string | null
          tipo_documento?: string | null
          valor_baixado?: number
          valor_liquido?: number
          valor_original?: number
          valor_rateio?: number
        }
        Update: {
          atualizado_em?: string
          cnpj_cpf?: string | null
          cod_ccusto?: string | null
          cod_natureza?: string | null
          data_baixa?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          desc_ccusto?: string | null
          desc_natureza?: string | null
          filial?: number | null
          grupo?: string | null
          historico?: string | null
          id?: string
          natureza_tipo_matriz?: number | null
          nome?: string | null
          nome_fantasia?: string | null
          numero_documento?: string | null
          owner_id?: string | null
          ref_lancamento?: number
          situacao_presumida?: string | null
          status_cod_matriz?: number | null
          subgrupo?: string | null
          tipo_documento?: string | null
          valor_baixado?: number
          valor_liquido?: number
          valor_original?: number
          valor_rateio?: number
        }
        Relationships: []
      }
      financeiro_previsao_carrinho: {
        Row: {
          criado_em: string
          fechado_em: string | null
          id: string
          status: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          fechado_em?: string | null
          id?: string
          status?: string
          titulo?: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          fechado_em?: string | null
          id?: string
          status?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      financeiro_previsao_carrinho_fechado_itens: {
        Row: {
          carrinho_id: string
          centro_custo: string | null
          centro_nome: string | null
          id: string
          natureza_cod: string | null
          natureza_desc: string | null
          nome: string | null
          previsto: boolean
          ref_lancamento: number | null
          solicitacao_id: string | null
          status_label: string | null
          valor_congelado: number
        }
        Insert: {
          carrinho_id: string
          centro_custo?: string | null
          centro_nome?: string | null
          id?: string
          natureza_cod?: string | null
          natureza_desc?: string | null
          nome?: string | null
          previsto?: boolean
          ref_lancamento?: number | null
          solicitacao_id?: string | null
          status_label?: string | null
          valor_congelado: number
        }
        Update: {
          carrinho_id?: string
          centro_custo?: string | null
          centro_nome?: string | null
          id?: string
          natureza_cod?: string | null
          natureza_desc?: string | null
          nome?: string | null
          previsto?: boolean
          ref_lancamento?: number | null
          solicitacao_id?: string | null
          status_label?: string | null
          valor_congelado?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_previsao_carrinho_fechado_itens_carrinho_id_fkey"
            columns: ["carrinho_id"]
            isOneToOne: false
            referencedRelation: "financeiro_previsao_carrinho"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_previsao_carrinho_itens: {
        Row: {
          adicionado_em: string
          carrinho_id: string
          id: string
          ref_lancamento: number | null
          solicitacao_id: string | null
        }
        Insert: {
          adicionado_em?: string
          carrinho_id: string
          id?: string
          ref_lancamento?: number | null
          solicitacao_id?: string | null
        }
        Update: {
          adicionado_em?: string
          carrinho_id?: string
          id?: string
          ref_lancamento?: number | null
          solicitacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_previsao_carrinho_itens_carrinho_id_fkey"
            columns: ["carrinho_id"]
            isOneToOne: false
            referencedRelation: "financeiro_previsao_carrinho"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_rateios: {
        Row: {
          cod_natureza: string | null
          desc_natureza: string | null
          grupo: string | null
          id: string
          lancamento_id: string
          status_lancamento: string | null
          subgrupo: string | null
          valor_rateio: number
        }
        Insert: {
          cod_natureza?: string | null
          desc_natureza?: string | null
          grupo?: string | null
          id?: string
          lancamento_id: string
          status_lancamento?: string | null
          subgrupo?: string | null
          valor_rateio?: number
        }
        Update: {
          cod_natureza?: string | null
          desc_natureza?: string | null
          grupo?: string | null
          id?: string
          lancamento_id?: string
          status_lancamento?: string | null
          subgrupo?: string | null
          valor_rateio?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_rateios_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_relatorio_status_atual: {
        Row: {
          atualizado_em: string
          categoria_indireta: string | null
          centro_custo: string | null
          centro_custo_tipo: string | null
          cliente_fornecedor: string | null
          cnpj_cpf: string | null
          data_baixa: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          desc_centro_custo: string | null
          dias_atraso: number | null
          filial: number | null
          historico: string | null
          mes_competencia: string | null
          natureza_tipo: number | null
          nome: string | null
          nome_fantasia: string | null
          numero_documento: string | null
          obra_id: string | null
          ref_lancamento: number
          status_cod: number | null
          status_label: string | null
          tipo_documento: string | null
          ultimo_arquivo: string | null
          ultimo_periodo_ref: string | null
          valor_baixado: number
          valor_desconto: number
          valor_liquido: number
          valor_original: number
        }
        Insert: {
          atualizado_em?: string
          categoria_indireta?: string | null
          centro_custo?: string | null
          centro_custo_tipo?: string | null
          cliente_fornecedor?: string | null
          cnpj_cpf?: string | null
          data_baixa?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          desc_centro_custo?: string | null
          dias_atraso?: number | null
          filial?: number | null
          historico?: string | null
          mes_competencia?: string | null
          natureza_tipo?: number | null
          nome?: string | null
          nome_fantasia?: string | null
          numero_documento?: string | null
          obra_id?: string | null
          ref_lancamento: number
          status_cod?: number | null
          status_label?: string | null
          tipo_documento?: string | null
          ultimo_arquivo?: string | null
          ultimo_periodo_ref?: string | null
          valor_baixado?: number
          valor_desconto?: number
          valor_liquido?: number
          valor_original?: number
        }
        Update: {
          atualizado_em?: string
          categoria_indireta?: string | null
          centro_custo?: string | null
          centro_custo_tipo?: string | null
          cliente_fornecedor?: string | null
          cnpj_cpf?: string | null
          data_baixa?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          desc_centro_custo?: string | null
          dias_atraso?: number | null
          filial?: number | null
          historico?: string | null
          mes_competencia?: string | null
          natureza_tipo?: number | null
          nome?: string | null
          nome_fantasia?: string | null
          numero_documento?: string | null
          obra_id?: string | null
          ref_lancamento?: number
          status_cod?: number | null
          status_label?: string | null
          tipo_documento?: string | null
          ultimo_arquivo?: string | null
          ultimo_periodo_ref?: string | null
          valor_baixado?: number
          valor_desconto?: number
          valor_liquido?: number
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_relatorio_status_atual_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_relatorio_status_atual_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      financeiro_relatorio_status_historico: {
        Row: {
          data_baixa: string | null
          data_pagamento: string | null
          id: string
          importado_em: string
          nome_arquivo: string | null
          periodo_ref: string | null
          ref_lancamento: number
          status_cod: number | null
          status_label: string | null
          valor_baixado: number | null
        }
        Insert: {
          data_baixa?: string | null
          data_pagamento?: string | null
          id?: string
          importado_em?: string
          nome_arquivo?: string | null
          periodo_ref?: string | null
          ref_lancamento: number
          status_cod?: number | null
          status_label?: string | null
          valor_baixado?: number | null
        }
        Update: {
          data_baixa?: string | null
          data_pagamento?: string | null
          id?: string
          importado_em?: string
          nome_arquivo?: string | null
          periodo_ref?: string | null
          ref_lancamento?: number
          status_cod?: number | null
          status_label?: string | null
          valor_baixado?: number | null
        }
        Relationships: []
      }
      financeiro_snapshots: {
        Row: {
          data_ref: string | null
          hash_arquivo: string | null
          id: string
          importado_em: string
          importado_por: string | null
          matriz_atualizada_em: string | null
          nome_arquivo_rateios: string | null
          nome_arquivo_titulos: string | null
          novos_sem_natureza: number | null
          owner_id: string | null
          periodo_ref: string | null
          titulos_sem_obra: number
          total_rateios: number
          total_titulos: number
          total_valor: number
        }
        Insert: {
          data_ref?: string | null
          hash_arquivo?: string | null
          id?: string
          importado_em?: string
          importado_por?: string | null
          matriz_atualizada_em?: string | null
          nome_arquivo_rateios?: string | null
          nome_arquivo_titulos?: string | null
          novos_sem_natureza?: number | null
          owner_id?: string | null
          periodo_ref?: string | null
          titulos_sem_obra?: number
          total_rateios?: number
          total_titulos?: number
          total_valor?: number
        }
        Update: {
          data_ref?: string | null
          hash_arquivo?: string | null
          id?: string
          importado_em?: string
          importado_por?: string | null
          matriz_atualizada_em?: string | null
          nome_arquivo_rateios?: string | null
          nome_arquivo_titulos?: string | null
          novos_sem_natureza?: number | null
          owner_id?: string | null
          periodo_ref?: string | null
          titulos_sem_obra?: number
          total_rateios?: number
          total_titulos?: number
          total_valor?: number
        }
        Relationships: []
      }
      fopag_entries: {
        Row: {
          colaborador_id: string
          competencia: string
          created_at: string
          evento: string
          id: string
          origem: string
          status: string
          tipo: string
          valor: number
        }
        Insert: {
          colaborador_id: string
          competencia: string
          created_at?: string
          evento: string
          id?: string
          origem?: string
          status?: string
          tipo?: string
          valor?: number
        }
        Update: {
          colaborador_id?: string
          competencia?: string
          created_at?: string
          evento?: string
          id?: string
          origem?: string
          status?: string
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          nome_cartao: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          nome_cartao?: string | null
          tipo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          nome_cartao?: string | null
          tipo?: string
        }
        Relationships: []
      }
      frota_abastecimentos: {
        Row: {
          combustivel: string | null
          created_at: string
          created_by: string | null
          data: string
          horimetro: number | null
          id: string
          litros: number | null
          obra_id: string | null
          observacao: string | null
          odometro: number | null
          patrimonio_id: string | null
          posto: string | null
          updated_at: string
          valor: number | null
          veiculo_id: string | null
        }
        Insert: {
          combustivel?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          horimetro?: number | null
          id?: string
          litros?: number | null
          obra_id?: string | null
          observacao?: string | null
          odometro?: number | null
          patrimonio_id?: string | null
          posto?: string | null
          updated_at?: string
          valor?: number | null
          veiculo_id?: string | null
        }
        Update: {
          combustivel?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          horimetro?: number | null
          id?: string
          litros?: number | null
          obra_id?: string | null
          observacao?: string | null
          odometro?: number | null
          patrimonio_id?: string | null
          posto?: string | null
          updated_at?: string
          valor?: number | null
          veiculo_id?: string | null
        }
        Relationships: []
      }
      frota_manutencoes: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          fornecedor: string | null
          horimetro: number | null
          id: string
          obra_id: string | null
          odometro: number | null
          patrimonio_id: string | null
          proxima_preventiva_data: string | null
          proxima_preventiva_horimetro: number | null
          tipo: string | null
          updated_at: string
          valor: number | null
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          descricao?: string | null
          fornecedor?: string | null
          horimetro?: number | null
          id?: string
          obra_id?: string | null
          odometro?: number | null
          patrimonio_id?: string | null
          proxima_preventiva_data?: string | null
          proxima_preventiva_horimetro?: number | null
          tipo?: string | null
          updated_at?: string
          valor?: number | null
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          fornecedor?: string | null
          horimetro?: number | null
          id?: string
          obra_id?: string | null
          odometro?: number | null
          patrimonio_id?: string | null
          proxima_preventiva_data?: string | null
          proxima_preventiva_horimetro?: number | null
          tipo?: string | null
          updated_at?: string
          valor?: number | null
          veiculo_id?: string | null
        }
        Relationships: []
      }
      funcoes: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          nome: string
          nrs: Json
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome: string
          nrs?: Json
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome?: string
          nrs?: Json
        }
        Relationships: []
      }
      historico_salarial: {
        Row: {
          cargo: string
          colaborador_id: string
          created_at: string
          id: string
          motivo: string
          observacao: string | null
          responsavel: string
          salario_anterior: number
          salario_novo: number
          vigencia: string
        }
        Insert: {
          cargo?: string
          colaborador_id: string
          created_at?: string
          id?: string
          motivo?: string
          observacao?: string | null
          responsavel?: string
          salario_anterior?: number
          salario_novo: number
          vigencia: string
        }
        Update: {
          cargo?: string
          colaborador_id?: string
          created_at?: string
          id?: string
          motivo?: string
          observacao?: string | null
          responsavel?: string
          salario_anterior?: number
          salario_novo?: number
          vigencia?: string
        }
        Relationships: []
      }
      horas_extras: {
        Row: {
          colaborador_id: string
          competencia: string
          created_at: string
          data: string
          id: string
          obra_id: string | null
          obra_nome: string | null
          observacao: string | null
          quantidade_horas: number
          status: string
          tipo: string
          valor_hora: number
          valor_total: number
        }
        Insert: {
          colaborador_id: string
          competencia: string
          created_at?: string
          data: string
          id?: string
          obra_id?: string | null
          obra_nome?: string | null
          observacao?: string | null
          quantidade_horas?: number
          status?: string
          tipo?: string
          valor_hora?: number
          valor_total?: number
        }
        Update: {
          colaborador_id?: string
          competencia?: string
          created_at?: string
          data?: string
          id?: string
          obra_id?: string | null
          obra_nome?: string | null
          observacao?: string | null
          quantidade_horas?: number
          status?: string
          tipo?: string
          valor_hora?: number
          valor_total?: number
        }
        Relationships: []
      }
      itens_medicao: {
        Row: {
          bms_descricao: string | null
          bms_item_codigo: string | null
          created_at: string
          cronograma_item_id: string | null
          id: string
          medicao_id: string
          percentual_anterior: number | null
          percentual_atual: number | null
          valor_anterior: number | null
          valor_atual: number | null
        }
        Insert: {
          bms_descricao?: string | null
          bms_item_codigo?: string | null
          created_at?: string
          cronograma_item_id?: string | null
          id?: string
          medicao_id: string
          percentual_anterior?: number | null
          percentual_atual?: number | null
          valor_anterior?: number | null
          valor_atual?: number | null
        }
        Update: {
          bms_descricao?: string | null
          bms_item_codigo?: string | null
          created_at?: string
          cronograma_item_id?: string | null
          id?: string
          medicao_id?: string
          percentual_anterior?: number | null
          percentual_atual?: number | null
          valor_anterior?: number | null
          valor_atual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_medicao_cronograma_item_id_fkey"
            columns: ["cronograma_item_id"]
            isOneToOne: false
            referencedRelation: "cronograma_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_medicao_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_extensao_log: {
        Row: {
          acao: string
          ator_id: string | null
          board_id: string | null
          card_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          extensao_codigo: string | null
          id: string
          metadata: Json
          origem: string
          resultado: string
        }
        Insert: {
          acao: string
          ator_id?: string | null
          board_id?: string | null
          card_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          extensao_codigo?: string | null
          id?: string
          metadata?: Json
          origem?: string
          resultado?: string
        }
        Update: {
          acao?: string
          ator_id?: string | null
          board_id?: string | null
          card_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          extensao_codigo?: string | null
          id?: string
          metadata?: Json
          origem?: string
          resultado?: string
        }
        Relationships: []
      }
      kanban_extensoes: {
        Row: {
          ativo: boolean
          card_tipos_compat: string[]
          codigo: string
          config_padrao: Json
          created_at: string
          descricao: string | null
          entity_types: string[]
          icone: string | null
          id: string
          modulo: string | null
          nome: string
          ordem: number
          permissao_requerida: string | null
          updated_at: string
          versao: string
        }
        Insert: {
          ativo?: boolean
          card_tipos_compat?: string[]
          codigo: string
          config_padrao?: Json
          created_at?: string
          descricao?: string | null
          entity_types?: string[]
          icone?: string | null
          id?: string
          modulo?: string | null
          nome: string
          ordem?: number
          permissao_requerida?: string | null
          updated_at?: string
          versao?: string
        }
        Update: {
          ativo?: boolean
          card_tipos_compat?: string[]
          codigo?: string
          config_padrao?: Json
          created_at?: string
          descricao?: string | null
          entity_types?: string[]
          icone?: string | null
          id?: string
          modulo?: string | null
          nome?: string
          ordem?: number
          permissao_requerida?: string | null
          updated_at?: string
          versao?: string
        }
        Relationships: []
      }
      lead_time_templates: {
        Row: {
          created_at: string
          dias_necessidade: number | null
          dias_notif_compras: number | null
          dias_notif_producao: number | null
          dias_pedido: number | null
          dias_prod_iniciar: number | null
          id: string
          obra_id: string | null
          tipo_recurso: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dias_necessidade?: number | null
          dias_notif_compras?: number | null
          dias_notif_producao?: number | null
          dias_pedido?: number | null
          dias_prod_iniciar?: number | null
          id?: string
          obra_id?: string | null
          tipo_recurso: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dias_necessidade?: number | null
          dias_notif_compras?: number | null
          dias_notif_producao?: number | null
          dias_pedido?: number | null
          dias_prod_iniciar?: number | null
          id?: string
          obra_id?: string | null
          tipo_recurso?: string
          updated_at?: string
        }
        Relationships: []
      }
      licoes_aprendidas: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          impacto: string | null
          obra_id: string
          recomendacao: string
          situacao: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          impacto?: string | null
          obra_id: string
          recomendacao: string
          situacao: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          impacto?: string | null
          obra_id?: string
          recomendacao?: string
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "licoes_aprendidas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licoes_aprendidas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      medicoes: {
        Row: {
          aprovada_em: string | null
          aprovada_por: string | null
          arquivo_origem: string | null
          baseline_id: string | null
          created_at: string
          data_aprovacao: string | null
          data_corte: string
          data_inicio: string | null
          enviada_em: string | null
          enviada_por: string | null
          id: string
          numero: string
          obra_id: string
          observacoes: string | null
          percentual: number | null
          rejeicao_motivo: string | null
          rejeitada_em: string | null
          rejeitada_por: string | null
          sheet_origem: string | null
          status: Database["public"]["Enums"]["medicao_status"]
          updated_at: string
          valor: number
          versao_otimista: number
        }
        Insert: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          arquivo_origem?: string | null
          baseline_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_corte: string
          data_inicio?: string | null
          enviada_em?: string | null
          enviada_por?: string | null
          id?: string
          numero: string
          obra_id: string
          observacoes?: string | null
          percentual?: number | null
          rejeicao_motivo?: string | null
          rejeitada_em?: string | null
          rejeitada_por?: string | null
          sheet_origem?: string | null
          status?: Database["public"]["Enums"]["medicao_status"]
          updated_at?: string
          valor?: number
          versao_otimista?: number
        }
        Update: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          arquivo_origem?: string | null
          baseline_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_corte?: string
          data_inicio?: string | null
          enviada_em?: string | null
          enviada_por?: string | null
          id?: string
          numero?: string
          obra_id?: string
          observacoes?: string | null
          percentual?: number | null
          rejeicao_motivo?: string | null
          rejeitada_em?: string | null
          rejeitada_por?: string | null
          sheet_origem?: string | null
          status?: Database["public"]["Enums"]["medicao_status"]
          updated_at?: string
          valor?: number
          versao_otimista?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "cronograma_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      mobilizacoes_periodos: {
        Row: {
          colaborador_id: string
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          id: string
          obra_id: string
          obra_nome: string | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string | null
          data_fim?: string | null
          data_inicio: string
          id?: string
          obra_id: string
          obra_nome?: string | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          id?: string
          obra_id?: string
          obra_nome?: string | null
        }
        Relationships: []
      }
      mobilizacoes_veiculos: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          obra_id: string
          obra_nome: string | null
          veiculo_id: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          id?: string
          obra_id: string
          obra_nome?: string | null
          veiculo_id: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          obra_id?: string
          obra_nome?: string | null
          veiculo_id?: string
        }
        Relationships: []
      }
      nao_conformidades: {
        Row: {
          aguardando_reinspecao: boolean | null
          codigo: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          obra_id: string | null
          prazo: string | null
          quando_planejado: string | null
          severidade: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          aguardando_reinspecao?: boolean | null
          codigo?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          obra_id?: string | null
          prazo?: string | null
          quando_planejado?: string | null
          severidade?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          aguardando_reinspecao?: boolean | null
          codigo?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          obra_id?: string | null
          prazo?: string | null
          quando_planejado?: string | null
          severidade?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          codigo_art: string | null
          codigo_cno: string | null
          codigo_verificacao: string | null
          competencia: string | null
          created_at: string
          data_emissao: string | null
          data_vencimento: string | null
          id: string
          inss_retido: number
          iss_retido: number
          medicao_id: string | null
          numero: string | null
          obra_id: string
          observacoes: string | null
          outras_retencoes: number
          pdf_url: string | null
          percentual_material: number | null
          retencao_cbs: number
          retencao_ibs: number
          status: Database["public"]["Enums"]["nf_status"]
          updated_at: string
          valor: number
          valor_liquido: number | null
          valor_material: number | null
          valor_servicos: number | null
          versao_otimista: number
        }
        Insert: {
          codigo_art?: string | null
          codigo_cno?: string | null
          codigo_verificacao?: string | null
          competencia?: string | null
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          id?: string
          inss_retido?: number
          iss_retido?: number
          medicao_id?: string | null
          numero?: string | null
          obra_id: string
          observacoes?: string | null
          outras_retencoes?: number
          pdf_url?: string | null
          percentual_material?: number | null
          retencao_cbs?: number
          retencao_ibs?: number
          status?: Database["public"]["Enums"]["nf_status"]
          updated_at?: string
          valor?: number
          valor_liquido?: number | null
          valor_material?: number | null
          valor_servicos?: number | null
          versao_otimista?: number
        }
        Update: {
          codigo_art?: string | null
          codigo_cno?: string | null
          codigo_verificacao?: string | null
          competencia?: string | null
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          id?: string
          inss_retido?: number
          iss_retido?: number
          medicao_id?: string | null
          numero?: string | null
          obra_id?: string
          observacoes?: string | null
          outras_retencoes?: number
          pdf_url?: string | null
          percentual_material?: number | null
          retencao_cbs?: number
          retencao_ibs?: number
          status?: Database["public"]["Enums"]["nf_status"]
          updated_at?: string
          valor?: number
          valor_liquido?: number | null
          valor_material?: number | null
          valor_servicos?: number | null
          versao_otimista?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          autor_id: string | null
          autor_login: string | null
          created_at: string
          destinatario_id: string | null
          id: string
          lida_por: string[]
          mensagem: string | null
          role_scope: string
          setor: string | null
          target_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          autor_id?: string | null
          autor_login?: string | null
          created_at?: string
          destinatario_id?: string | null
          id?: string
          lida_por?: string[]
          mensagem?: string | null
          role_scope: string
          setor?: string | null
          target_id?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          autor_id?: string | null
          autor_login?: string | null
          created_at?: string
          destinatario_id?: string | null
          id?: string
          lida_por?: string[]
          mensagem?: string | null
          role_scope?: string
          setor?: string | null
          target_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      obra_membros: {
        Row: {
          created_at: string
          id: string
          obra_id: string
          papel: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          obra_id: string
          papel?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          obra_id?: string
          papel?: string | null
          user_id?: string
        }
        Relationships: []
      }
      obras: {
        Row: {
          aliquota_cbs: number
          aliquota_ibs: number
          aliquota_inss: number
          aliquota_iss: number
          ativa: boolean
          centro_custo_totvs: string | null
          cliente: string | null
          cliente_id: string | null
          cnpj: string | null
          codigo: string | null
          codigo_totvs: string | null
          created_at: string
          data_corte_medicao_1: string | null
          data_corte_medicao_2: string | null
          data_desmobilizacao: string | null
          data_fim: string | null
          data_inicio: string | null
          data_mobilizacao: string | null
          data_previsao_termino: string | null
          dia_fixo_pagamento: number | null
          dia_fixo_pagamento_1: string | null
          dia_fixo_pagamento_2: string | null
          dias_ate_emissao_nf: number | null
          dias_corte_bms: number[] | null
          dias_fixos_pagamento: number[] | null
          empresa_id: string | null
          flowcast_id: string | null
          id: string
          integracao_info: string
          local: string | null
          nome: string
          observacao: string | null
          observacoes: string | null
          owner_id: string | null
          pedido_contrato: string | null
          percentual_antecipacao: number | null
          percentual_material: number
          prazo_emitir_nf_dias: number | null
          prazo_padrao_pagamento: string | null
          prazo_pagamento_dias: number | null
          regra_medicao: string | null
          requer_integracao: boolean
          status: Database["public"]["Enums"]["obra_status"]
          updated_at: string
          valor_antecipacao: number | null
          valor_contrato: number
        }
        Insert: {
          aliquota_cbs?: number
          aliquota_ibs?: number
          aliquota_inss?: number
          aliquota_iss?: number
          ativa?: boolean
          centro_custo_totvs?: string | null
          cliente?: string | null
          cliente_id?: string | null
          cnpj?: string | null
          codigo?: string | null
          codigo_totvs?: string | null
          created_at?: string
          data_corte_medicao_1?: string | null
          data_corte_medicao_2?: string | null
          data_desmobilizacao?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_mobilizacao?: string | null
          data_previsao_termino?: string | null
          dia_fixo_pagamento?: number | null
          dia_fixo_pagamento_1?: string | null
          dia_fixo_pagamento_2?: string | null
          dias_ate_emissao_nf?: number | null
          dias_corte_bms?: number[] | null
          dias_fixos_pagamento?: number[] | null
          empresa_id?: string | null
          flowcast_id?: string | null
          id?: string
          integracao_info?: string
          local?: string | null
          nome: string
          observacao?: string | null
          observacoes?: string | null
          owner_id?: string | null
          pedido_contrato?: string | null
          percentual_antecipacao?: number | null
          percentual_material?: number
          prazo_emitir_nf_dias?: number | null
          prazo_padrao_pagamento?: string | null
          prazo_pagamento_dias?: number | null
          regra_medicao?: string | null
          requer_integracao?: boolean
          status?: Database["public"]["Enums"]["obra_status"]
          updated_at?: string
          valor_antecipacao?: number | null
          valor_contrato?: number
        }
        Update: {
          aliquota_cbs?: number
          aliquota_ibs?: number
          aliquota_inss?: number
          aliquota_iss?: number
          ativa?: boolean
          centro_custo_totvs?: string | null
          cliente?: string | null
          cliente_id?: string | null
          cnpj?: string | null
          codigo?: string | null
          codigo_totvs?: string | null
          created_at?: string
          data_corte_medicao_1?: string | null
          data_corte_medicao_2?: string | null
          data_desmobilizacao?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_mobilizacao?: string | null
          data_previsao_termino?: string | null
          dia_fixo_pagamento?: number | null
          dia_fixo_pagamento_1?: string | null
          dia_fixo_pagamento_2?: string | null
          dias_ate_emissao_nf?: number | null
          dias_corte_bms?: number[] | null
          dias_fixos_pagamento?: number[] | null
          empresa_id?: string | null
          flowcast_id?: string | null
          id?: string
          integracao_info?: string
          local?: string | null
          nome?: string
          observacao?: string | null
          observacoes?: string | null
          owner_id?: string | null
          pedido_contrato?: string | null
          percentual_antecipacao?: number | null
          percentual_material?: number
          prazo_emitir_nf_dias?: number | null
          prazo_padrao_pagamento?: string | null
          prazo_pagamento_dias?: number | null
          regra_medicao?: string | null
          requer_integracao?: boolean
          status?: Database["public"]["Enums"]["obra_status"]
          updated_at?: string
          valor_antecipacao?: number | null
          valor_contrato?: number
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          acao_corretiva: string | null
          created_at: string
          data_abertura: string
          data_resolucao: string | null
          descricao: string | null
          id: string
          obra_id: string
          prioridade: string
          responsavel: string | null
          risco_id: string | null
          status: Database["public"]["Enums"]["ocorrencia_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          acao_corretiva?: string | null
          created_at?: string
          data_abertura?: string
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          obra_id: string
          prioridade?: string
          responsavel?: string | null
          risco_id?: string | null
          status?: Database["public"]["Enums"]["ocorrencia_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          acao_corretiva?: string | null
          created_at?: string
          data_abertura?: string
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          obra_id?: string
          prioridade?: string
          responsavel?: string | null
          risco_id?: string | null
          status?: Database["public"]["Enums"]["ocorrencia_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "ocorrencias_risco_id_fkey"
            columns: ["risco_id"]
            isOneToOne: false
            referencedRelation: "riscos"
            referencedColumns: ["id"]
          },
        ]
      }
      operadores_credito: {
        Row: {
          apelido: string | null
          ativo: boolean
          cnpj: string | null
          contato: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          taxa_referencia_am: number | null
          tipo: Database["public"]["Enums"]["operador_tipo"]
          updated_at: string
        }
        Insert: {
          apelido?: string | null
          ativo?: boolean
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          taxa_referencia_am?: number | null
          tipo?: Database["public"]["Enums"]["operador_tipo"]
          updated_at?: string
        }
        Update: {
          apelido?: string | null
          ativo?: boolean
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          taxa_referencia_am?: number | null
          tipo?: Database["public"]["Enums"]["operador_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      pacote_restricoes: {
        Row: {
          created_at: string
          pacote_id: string
          restricao_id: string
        }
        Insert: {
          created_at?: string
          pacote_id: string
          restricao_id: string
        }
        Update: {
          created_at?: string
          pacote_id?: string
          restricao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacote_restricoes_pacote_id_fkey"
            columns: ["pacote_id"]
            isOneToOne: false
            referencedRelation: "pacotes_trabalho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacote_restricoes_restricao_id_fkey"
            columns: ["restricao_id"]
            isOneToOne: false
            referencedRelation: "restricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pacotes_trabalho: {
        Row: {
          created_at: string
          criterio_conclusao: string | null
          cronograma_item_id: string | null
          descricao: string
          id: string
          obra_id: string
          owner_id: string | null
          responsavel_id: string | null
          semana_fim: string | null
          semana_inicio: string | null
          status: string
          tamanho_estimado: number | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          criterio_conclusao?: string | null
          cronograma_item_id?: string | null
          descricao: string
          id?: string
          obra_id: string
          owner_id?: string | null
          responsavel_id?: string | null
          semana_fim?: string | null
          semana_inicio?: string | null
          status?: string
          tamanho_estimado?: number | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          criterio_conclusao?: string | null
          cronograma_item_id?: string | null
          descricao?: string
          id?: string
          obra_id?: string
          owner_id?: string | null
          responsavel_id?: string | null
          semana_fim?: string | null
          semana_inicio?: string | null
          status?: string
          tamanho_estimado?: number | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patrimonios: {
        Row: {
          alugado: boolean
          ativo: boolean
          codigo: string
          created_at: string
          em_manutencao: boolean
          historico: Json
          id: string
          mobilizacao_pendente: Json | null
          nome: string
          obra_atual_id: string | null
          quebrado: boolean
          responsavel_id: string | null
          riscado: boolean
          sujo: boolean
        }
        Insert: {
          alugado?: boolean
          ativo?: boolean
          codigo: string
          created_at?: string
          em_manutencao?: boolean
          historico?: Json
          id?: string
          mobilizacao_pendente?: Json | null
          nome: string
          obra_atual_id?: string | null
          quebrado?: boolean
          responsavel_id?: string | null
          riscado?: boolean
          sujo?: boolean
        }
        Update: {
          alugado?: boolean
          ativo?: boolean
          codigo?: string
          created_at?: string
          em_manutencao?: boolean
          historico?: Json
          id?: string
          mobilizacao_pendente?: Json | null
          nome?: string
          obra_atual_id?: string | null
          quebrado?: boolean
          responsavel_id?: string | null
          riscado?: boolean
          sujo?: boolean
        }
        Relationships: []
      }
      plano_contas: {
        Row: {
          ativo: boolean
          cod_natureza: string
          cod_pai: string | null
          descricao: string
          grupo: string
          nivel: number
          subgrupo: string | null
        }
        Insert: {
          ativo?: boolean
          cod_natureza: string
          cod_pai?: string | null
          descricao: string
          grupo: string
          nivel: number
          subgrupo?: string | null
        }
        Update: {
          ativo?: boolean
          cod_natureza?: string
          cod_pai?: string | null
          descricao?: string
          grupo?: string
          nivel?: number
          subgrupo?: string | null
        }
        Relationships: []
      }
      players: {
        Row: {
          acessos: Json
          created_at: string
          email: string
          id: string
          is_gm: boolean
          login: string
          senha: string
        }
        Insert: {
          acessos?: Json
          created_at?: string
          email?: string
          id?: string
          is_gm?: boolean
          login: string
          senha: string
        }
        Update: {
          acessos?: Json
          created_at?: string
          email?: string
          id?: string
          is_gm?: boolean
          login?: string
          senha?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          login: string | null
          nome: string | null
          player_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id: string
          login?: string | null
          nome?: string | null
          player_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          login?: string | null
          nome?: string | null
          player_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provisoes: {
        Row: {
          categoria: string
          colaborador_id: string
          competencia: string
          created_at: string
          id: string
          observacao: string | null
          status: string
          valor: number
        }
        Insert: {
          categoria?: string
          colaborador_id: string
          competencia: string
          created_at?: string
          id?: string
          observacao?: string | null
          status?: string
          valor?: number
        }
        Update: {
          categoria?: string
          colaborador_id?: string
          competencia?: string
          created_at?: string
          id?: string
          observacao?: string | null
          status?: string
          valor?: number
        }
        Relationships: []
      }
      recebimentos: {
        Row: {
          congelado: boolean
          created_at: string
          cronograma_item_id: string | null
          data_prevista: string
          data_recebimento: string | null
          id: string
          nota_fiscal_id: string | null
          obra_id: string
          observacoes: string | null
          origem: string
          status: Database["public"]["Enums"]["recebimento_status"]
          updated_at: string
          valor_previsto: number
          valor_previsto_inicial: number | null
          valor_recebido: number | null
          versao_otimista: number
        }
        Insert: {
          congelado?: boolean
          created_at?: string
          cronograma_item_id?: string | null
          data_prevista: string
          data_recebimento?: string | null
          id?: string
          nota_fiscal_id?: string | null
          obra_id: string
          observacoes?: string | null
          origem?: string
          status?: Database["public"]["Enums"]["recebimento_status"]
          updated_at?: string
          valor_previsto?: number
          valor_previsto_inicial?: number | null
          valor_recebido?: number | null
          versao_otimista?: number
        }
        Update: {
          congelado?: boolean
          created_at?: string
          cronograma_item_id?: string | null
          data_prevista?: string
          data_recebimento?: string | null
          id?: string
          nota_fiscal_id?: string | null
          obra_id?: string
          observacoes?: string | null
          origem?: string
          status?: Database["public"]["Enums"]["recebimento_status"]
          updated_at?: string
          valor_previsto?: number
          valor_previsto_inicial?: number | null
          valor_recebido?: number | null
          versao_otimista?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "vw_nf_saldo"
            referencedColumns: ["nota_fiscal_id"]
          },
          {
            foreignKeyName: "recebimentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      responsabilidades_patrimonios: {
        Row: {
          colaborador_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          patrimonio_id: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          id?: string
          patrimonio_id: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          patrimonio_id?: string
        }
        Relationships: []
      }
      restricoes: {
        Row: {
          card_id: string | null
          created_at: string
          descricao: string
          id: string
          obra_id: string
          observacao: string | null
          owner_id: string | null
          prazo: string | null
          requisicao_id: string | null
          resolvida_em: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          obra_id: string
          observacao?: string | null
          owner_id?: string | null
          prazo?: string | null
          requisicao_id?: string | null
          resolvida_em?: string | null
          responsavel_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          obra_id?: string
          observacao?: string | null
          owner_id?: string | null
          prazo?: string | null
          requisicao_id?: string | null
          resolvida_em?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      riscos: {
        Row: {
          categoria: string | null
          codigo: string | null
          created_at: string
          data_revisao: string | null
          descricao: string
          id: string
          impacto: number | null
          impacto_financeiro: number | null
          obra_id: string
          observacoes: string | null
          plano_resposta: string | null
          probabilidade: number | null
          responsavel: string | null
          resposta: string | null
          status: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          data_revisao?: string | null
          descricao: string
          id?: string
          impacto?: number | null
          impacto_financeiro?: number | null
          obra_id: string
          observacoes?: string | null
          plano_resposta?: string | null
          probabilidade?: number | null
          responsavel?: string | null
          resposta?: string | null
          status?: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          data_revisao?: string | null
          descricao?: string
          id?: string
          impacto?: number | null
          impacto_financeiro?: number | null
          obra_id?: string
          observacoes?: string | null
          plano_resposta?: string | null
          probabilidade?: number | null
          responsavel?: string | null
          resposta?: string | null
          status?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "riscos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riscos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string | null
          metadata: Json | null
          origem: string | null
          sucesso: boolean
          tipo: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          origem?: string | null
          sucesso?: boolean
          tipo: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          origem?: string | null
          sucesso?: boolean
          tipo?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      solicitacao_comentarios: {
        Row: {
          autor: string
          campo: string
          created_at: string
          id: string
          solicitacao_id: string
          texto: string
        }
        Insert: {
          autor?: string
          campo: string
          created_at?: string
          id?: string
          solicitacao_id: string
          texto: string
        }
        Update: {
          autor?: string
          campo?: string
          created_at?: string
          id?: string
          solicitacao_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacao_comentarios_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_financeiras: {
        Row: {
          aprovado_por: string | null
          cancelado_por: string | null
          centro_custo_id: string | null
          comentario_aprovacao: string | null
          condicao_pagamento: string | null
          created_at: string
          criado_por: string
          data_aprovacao: string | null
          data_cancelamento: string | null
          data_pagamento: string | null
          data_recusa: string | null
          forma_pagamento_id: string | null
          fornecedor: string | null
          id: string
          nivel_prioridade: string
          observacao: string | null
          pagamento_pendente: boolean
          prazo_estimado: string | null
          recusado_por: string | null
          referencia: string | null
          setor: string
          solicitante: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          aprovado_por?: string | null
          cancelado_por?: string | null
          centro_custo_id?: string | null
          comentario_aprovacao?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          criado_por?: string
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_pagamento?: string | null
          data_recusa?: string | null
          forma_pagamento_id?: string | null
          fornecedor?: string | null
          id?: string
          nivel_prioridade?: string
          observacao?: string | null
          pagamento_pendente?: boolean
          prazo_estimado?: string | null
          recusado_por?: string | null
          referencia?: string | null
          setor?: string
          solicitante?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          aprovado_por?: string | null
          cancelado_por?: string | null
          centro_custo_id?: string | null
          comentario_aprovacao?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          criado_por?: string
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_pagamento?: string | null
          data_recusa?: string | null
          forma_pagamento_id?: string | null
          fornecedor?: string | null
          id?: string
          nivel_prioridade?: string
          observacao?: string | null
          pagamento_pendente?: boolean
          prazo_estimado?: string | null
          recusado_por?: string | null
          referencia?: string | null
          setor?: string
          solicitante?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_financeiras_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      user_empresas: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          papel: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          papel?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          nivel: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nivel?: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nivel?: number
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          alugado: boolean
          ativo: boolean
          codigo: string
          created_at: string
          historico: Json
          id: string
          manutencao: boolean
          mobilizacao_pendente: Json | null
          nome: string
          obra_atual_id: string | null
          quebrado: boolean
          riscado: boolean
          sujo: boolean
          tipo: string
        }
        Insert: {
          alugado?: boolean
          ativo?: boolean
          codigo: string
          created_at?: string
          historico?: Json
          id?: string
          manutencao?: boolean
          mobilizacao_pendente?: Json | null
          nome: string
          obra_atual_id?: string | null
          quebrado?: boolean
          riscado?: boolean
          sujo?: boolean
          tipo?: string
        }
        Update: {
          alugado?: boolean
          ativo?: boolean
          codigo?: string
          created_at?: string
          historico?: Json
          id?: string
          manutencao?: boolean
          mobilizacao_pendente?: Json | null
          nome?: string
          obra_atual_id?: string | null
          quebrado?: boolean
          riscado?: boolean
          sujo?: boolean
          tipo?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_db001_fronteira_orfaos: {
        Row: {
          coluna: string | null
          tabela: string | null
          tabela_referencia: string | null
          total: number | null
          valor: string | null
        }
        Relationships: []
      }
      vw_financeiro_obra: {
        Row: {
          categoria_indireta: string | null
          centro_custo: string | null
          centro_custo_tipo: string | null
          cliente_fornecedor: string | null
          cod_natureza: string | null
          contraparte: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          desc_centro_custo: string | null
          desc_natureza: string | null
          dias_atraso: number | null
          dias_atraso_estimado: boolean | null
          grupo: string | null
          lancamento_id: string | null
          mes_competencia: string | null
          mes_competencia_estimado: boolean | null
          natureza_tipo: number | null
          obra_codigo: string | null
          obra_id: string | null
          obra_nome: string | null
          origem: string | null
          pendente_natureza: boolean | null
          previsto: boolean | null
          ref_lancamento: number | null
          sem_atualizacao_recente: boolean | null
          solicitacao_id: string | null
          status_cod: number | null
          status_label: string | null
          status_lancamento: string | null
          subgrupo: string | null
          ultima_atualizacao: string | null
          valor_baixado: number | null
          valor_liquido: number | null
          valor_rateio: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_nf_saldo: {
        Row: {
          nota_fiscal_id: string | null
          numero: string | null
          obra_id: string | null
          saldo_aberto: number | null
          total_recebido: number | null
          valor_liquido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_obra_valores"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      vw_obra_valores: {
        Row: {
          dias_aditivos: number | null
          obra_id: string | null
          valor_contrato_atual: number | null
          valor_contrato_original: number | null
          valor_executado: number | null
          valor_planejado_baseline: number | null
        }
        Insert: {
          dias_aditivos?: never
          obra_id?: string | null
          valor_contrato_atual?: never
          valor_contrato_original?: number | null
          valor_executado?: never
          valor_planejado_baseline?: never
        }
        Update: {
          dias_aditivos?: never
          obra_id?: string | null
          valor_contrato_atual?: never
          valor_contrato_original?: number | null
          valor_executado?: never
          valor_planejado_baseline?: never
        }
        Relationships: []
      }
    }
    Functions: {
      _fin_matriz_calcular_delta: { Args: never; Returns: Json }
      _fin_matriz_contar_stage: { Args: never; Returns: Json }
      _fin_matriz_preparar_stage: {
        Args: { p_rateios: Json }
        Returns: undefined
      }
      _fin_matriz_remover_ausentes: { Args: never; Returns: number }
      _fin_matriz_upsert_stage: { Args: never; Returns: undefined }
      _fin_snapshot_criar_legacy: {
        Args: {
          p_nome_rateios: string
          p_nome_titulos: string
          p_periodo_ref: string
        }
        Returns: string
      }
      _fin_snapshot_criar_totvs: {
        Args: { p_nome_titulos: string; p_periodo_ref: string }
        Returns: {
          matriz_atualizada_em: string
          snapshot_id: string
        }[]
      }
      _fin_snapshot_importar_lancamentos: {
        Args: { p_lancamentos: Json; p_snapshot_id: string }
        Returns: Json
      }
      _fin_snapshot_importar_rateios_matriz: {
        Args: { p_snapshot_id: string }
        Returns: number
      }
      _fin_snapshot_importar_rateios_payload: {
        Args: { p_rateios: Json; p_snapshot_id: string }
        Returns: number
      }
      _fin_snapshot_marcar_pendentes_matriz: {
        Args: { p_snapshot_id: string }
        Returns: number
      }
      _fin_snapshot_popular_rollup: {
        Args: { p_data_snapshot: string; p_snapshot_id: string }
        Returns: number
      }
      _fin_snapshot_purgar_antigos: {
        Args: { p_manter?: number }
        Returns: number
      }
      board_atividades_recentes: {
        Args: { p_board_id: string; p_limit?: number }
        Returns: {
          ator_id: string
          ator_nome: string
          card_id: string
          card_titulo: string
          created_at: string
          detalhe: string
          evento: string
          id: string
        }[]
      }
      board_items_resumo: {
        Args: { p_board_id: string }
        Returns: {
          capa_cor: string
          capa_url: string
          card_id: string
          checklist_concluido: number
          checklist_total: number
          id: string
          labels: Json
          lista_id: string
          numero: number
          obra_id: string
          posicao: number
          prazo: string
          responsavel_id: string
          responsavel_login: string
          setores: string[]
          titulo: string
        }[]
      }
      board_papel: {
        Args: { _board_id: string; _user_id: string }
        Returns: string
      }
      board_reordenar: {
        Args: { p_board_id: string; p_card_ids: string[]; p_lista_id: string }
        Returns: undefined
      }
      card_entity_link_criar: {
        Args: {
          p_card_id: string
          p_entity_id: string
          p_entity_type: string
          p_extensao: string
          p_is_primary?: boolean
          p_metadata?: Json
          p_relationship_type?: string
        }
        Returns: string
      }
      card_entity_link_definir_principal: {
        Args: { p_link_id: string }
        Returns: undefined
      }
      card_entity_link_remover: {
        Args: { p_arquivar?: boolean; p_link_id: string }
        Returns: undefined
      }
      card_entity_link_reordenar: {
        Args: { p_link_id: string; p_ordem: number }
        Returns: undefined
      }
      card_entity_links_listar: {
        Args: { p_card_id: string }
        Returns: {
          acesso_permitido: boolean
          archived_at: string
          created_at: string
          created_by: string
          created_by_nome: string
          display_order: number
          empresa_id: string
          entidade_arquivada: boolean
          entidade_disponivel: boolean
          entidade_nome: string
          entity_id: string
          entity_type: string
          extensao_codigo: string
          id: string
          is_primary: boolean
          relationship_type: string
          situacao: string
        }[]
      }
      card_entity_links_verificar_integridade: { Args: never; Returns: number }
      card_pode_editar: { Args: { p_card_id: string }; Returns: boolean }
      card_pode_ver: { Args: { p_card_id: string }; Returns: boolean }
      cards_por_entidade: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          arquivado: boolean
          board_id: string
          board_nome: string
          card_id: string
          numero: number
          status: string
          titulo: string
        }[]
      }
      criar_card_board_atomico: {
        Args: {
          p_board_id: string
          p_criado_por?: string
          p_lista_id: string
          p_titulo: string
        }
        Returns: {
          card_id: string
          numero: number
        }[]
      }
      current_login: { Args: never; Returns: string }
      current_player_has_access: { Args: { _module: string }; Returns: boolean }
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      db001_legacy_id_is_valid: { Args: { _value: string }; Returns: boolean }
      fn_atualizar_cpm: {
        Args: { p_obra_id: string; p_resultados: Json }
        Returns: undefined
      }
      fn_backfill_cronograma_dep_item_id: {
        Args: { p_obra_id: string }
        Returns: number
      }
      fn_financeiro_status_label: {
        Args: { p_status: number }
        Returns: string
      }
      fn_financeiro_status_matriz: {
        Args: {
          p_data_snapshot?: string
          p_data_vencimento: string
          p_situacao: string
        }
        Returns: number
      }
      fn_importar_faturamento_lote: { Args: { p_faturas: Json }; Returns: Json }
      fn_importar_financeiro_snapshot: {
        Args: {
          p_lancamentos: Json
          p_nome_rateios: string
          p_nome_titulos: string
          p_periodo_ref: string
          p_rateios: Json
        }
        Returns: Json
      }
      fn_importar_financeiro_snapshot_impl: {
        Args: {
          p_lancamentos: Json
          p_nome_rateios: string
          p_nome_titulos: string
          p_periodo_ref: string
          p_rateios: Json
        }
        Returns: Json
      }
      fn_importar_matriz: {
        Args: { p_data_ref?: string; p_rateios: Json }
        Returns: Json
      }
      fn_importar_matriz_impl: { Args: { p_rateios: Json }; Returns: Json }
      fn_importar_matriz_pode: { Args: never; Returns: boolean }
      fn_importar_pacote_totvs: {
        Args: {
          p_hash_arquivo?: string
          p_importado_por?: string
          p_lancamentos: Json
          p_nome_titulos: string
          p_periodo_ref: string
          p_rateios: Json
        }
        Returns: Json
      }
      fn_importar_relatorio_totvs: {
        Args: {
          p_hash_arquivo?: string
          p_importado_por?: string
          p_lancamentos: Json
          p_nome_titulos: string
          p_periodo_ref: string
        }
        Returns: Json
      }
      fn_importar_relatorio_totvs_impl: {
        Args: {
          p_lancamentos: Json
          p_nome_titulos: string
          p_periodo_ref: string
        }
        Returns: Json
      }
      fn_lancamento_solicitacao_aprovada: {
        Args: {
          p_centro_custo: string
          p_data_prevista: string
          p_descricao: string
          p_obra_id: string
          p_solicitacao_id: string
          p_valor: number
        }
        Returns: string
      }
      fn_materializar_financeiro_evolucao_rollup: {
        Args: { p_snapshot_id: string }
        Returns: number
      }
      fn_recalcular_apos_faturamento: {
        Args: { p_nf_id: string; p_obra_id: string; p_valor_contrato: number }
        Returns: Json
      }
      fn_recalcular_previsao_nf: {
        Args: { p_obra_id: string; p_valor_contrato: number }
        Returns: undefined
      }
      fn_reconciliar_previsto: {
        Args: { p_sistema_id: string; p_totvs_id: string }
        Returns: undefined
      }
      fn_reconstruir_snapshot_matriz_central: {
        Args: { p_snapshot_id: string }
        Returns: Json
      }
      fn_reverter_faturamento_bms: {
        Args: { p_bms_id: string; p_obra_id: string; p_valor_contrato: number }
        Returns: undefined
      }
      fn_reverter_revisao_cronograma: {
        Args: { p_revisao_id: string }
        Returns: number
      }
      fn_seed_plano_contas: { Args: never; Returns: number }
      fn_sugerir_reconciliacoes_previsto: {
        Args: { p_janela_dias?: number; p_tolerancia_pct?: number }
        Returns: {
          centro_custo: string
          contraparte_totvs: string
          data_prevista: string
          data_vencimento_totvs: string
          diff_dias: number
          obra_id: string
          ref_lancamento_totvs: number
          sistema_id: string
          solicitacao_id: string
          totvs_id: string
          valor_sistema: number
          valor_totvs: number
        }[]
      }
      get_folha_rateada: {
        Args: { p_colaborador_id: string; p_obra_id: string }
        Returns: {
          competencia: string
          desconto_total: number
          provento_total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_current_player_gm: { Args: never; Returns: boolean }
      kanban_entidade_info: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          arquivada: boolean
          empresa_id: string
          existe: boolean
          nome: string
          status: string
        }[]
      }
      kanban_extensao_registrar_acao: {
        Args: {
          p_acao: string
          p_card_id: string
          p_extensao: string
          p_metadata?: Json
          p_resultado?: string
        }
        Returns: string
      }
      pode_admin_board: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      aditivo_status: "rascunho" | "aprovado" | "cancelado"
      aditivo_tipo: "acrescimo" | "supressao" | "reajuste" | "prazo" | "misto"
      antecipacao_status: "rascunho" | "aprovada" | "liquidada" | "cancelada"
      antecipacao_tipo: "desconto_titulo" | "cessao" | "risco_sacado"
      app_role:
        | "gm"
        | "engenharia"
        | "dp"
        | "financeiro"
        | "compras"
        | "seguranca"
        | "comum"
      medicao_status:
        | "rascunho"
        | "em_revisao"
        | "enviada"
        | "aprovada"
        | "faturada"
        | "cancelada"
        | "rejeitada"
      nf_status:
        | "rascunho"
        | "emitida"
        | "enviada"
        | "aprovada_cliente"
        | "recebida"
        | "cancelada"
      obra_status:
        | "planejada"
        | "em_andamento"
        | "paralisada"
        | "concluida"
        | "cancelada"
      ocorrencia_status: "aberta" | "em_andamento" | "resolvida" | "cancelada"
      operador_tipo:
        | "fidc"
        | "banco"
        | "securitizadora"
        | "cliente_proprio"
        | "outro"
      recebimento_status:
        | "previsto"
        | "a_receber"
        | "parcial"
        | "pago"
        | "recebido"
        | "atrasado"
        | "inadimplente"
        | "antecipado"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      aditivo_status: ["rascunho", "aprovado", "cancelado"],
      aditivo_tipo: ["acrescimo", "supressao", "reajuste", "prazo", "misto"],
      antecipacao_status: ["rascunho", "aprovada", "liquidada", "cancelada"],
      antecipacao_tipo: ["desconto_titulo", "cessao", "risco_sacado"],
      app_role: [
        "gm",
        "engenharia",
        "dp",
        "financeiro",
        "compras",
        "seguranca",
        "comum",
      ],
      medicao_status: [
        "rascunho",
        "em_revisao",
        "enviada",
        "aprovada",
        "faturada",
        "cancelada",
        "rejeitada",
      ],
      nf_status: [
        "rascunho",
        "emitida",
        "enviada",
        "aprovada_cliente",
        "recebida",
        "cancelada",
      ],
      obra_status: [
        "planejada",
        "em_andamento",
        "paralisada",
        "concluida",
        "cancelada",
      ],
      ocorrencia_status: ["aberta", "em_andamento", "resolvida", "cancelada"],
      operador_tipo: [
        "fidc",
        "banco",
        "securitizadora",
        "cliente_proprio",
        "outro",
      ],
      recebimento_status: [
        "previsto",
        "a_receber",
        "parcial",
        "pago",
        "recebido",
        "atrasado",
        "inadimplente",
        "antecipado",
        "cancelado",
      ],
    },
  },
} as const

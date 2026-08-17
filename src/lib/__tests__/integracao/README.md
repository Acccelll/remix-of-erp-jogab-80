# Testes de cadeia crítica (H1.4)

Estes testes validam que os principais fluxos cross-módulo continuam
integrados pelos contratos certos (RPCs atômicas + shape de payloads),
sem tocar no banco. Quebrar a assinatura de qualquer elo abaixo quebra
um destes testes antes do runtime.

Cadeias cobertas:

1. Cronograma → BMS → Medição → Faturamento
2. Cotação → OC → Recebimento → Estoque
3. Solicitação Financeira → Aprovação → Lançamento
4. RDO → Apropriação → Custo Colaborador
5. Orçamento → Pacote de Trabalho → Restrição → Compromisso Semanal

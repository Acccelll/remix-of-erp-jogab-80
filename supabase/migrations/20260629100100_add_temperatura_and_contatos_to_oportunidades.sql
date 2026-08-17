-- Add temperatura and contatos fields to oportunidades table
ALTER TABLE oportunidades ADD COLUMN temperatura_temperatura VARCHAR(20);
ALTER TABLE oportunidades ADD COLUMN contatos JSONB;

-- Add comments to document the fields
COMMENT ON COLUMN oportunidades.temperatura_temperatura IS 'Temperatura da oportunidade: frio, morno, quente';
COMMENT ON COLUMN oportunidades.contatos IS 'Array de contatos: [{nome: string, telefone?: string, email?: string}]';

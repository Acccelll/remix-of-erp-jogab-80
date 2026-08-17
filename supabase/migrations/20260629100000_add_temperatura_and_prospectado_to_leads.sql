-- Add temperatura and prospectado_por fields to leads table
ALTER TABLE leads ADD COLUMN temperatura_temperatura VARCHAR(20);
ALTER TABLE leads ADD COLUMN prospectado_por UUID REFERENCES players(id) ON DELETE SET NULL;

-- Add comments to document the fields
COMMENT ON COLUMN leads.temperatura_temperatura IS 'Temperatura da oportunidade: frio, morno, quente';
COMMENT ON COLUMN leads.prospectado_por IS 'UUID do usuário que prospectou/criou o lead';

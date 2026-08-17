-- Add servico field to leads table for CRM opportunities
ALTER TABLE leads ADD COLUMN servico VARCHAR(100);

-- Add comment to document the field
COMMENT ON COLUMN leads.servico IS 'Tipo de serviço: Escavação, Fertirrigação, Sucroenergia, Construção Civil';

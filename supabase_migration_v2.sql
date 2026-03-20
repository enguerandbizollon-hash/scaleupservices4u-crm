-- Ajouter last_contact_date aux contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date DATE;

-- Ajouter deal_id dans organization_contacts pour lier un contact à un dossier précis
ALTER TABLE organization_contacts ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

-- Index pour les alertes de relance
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact ON contacts(last_contact_date) WHERE last_contact_date IS NOT NULL;

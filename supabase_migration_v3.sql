-- client_organization_id devient nullable (les orgs se lient aux dossiers, pas l'inverse)
ALTER TABLE deals ALTER COLUMN client_organization_id DROP NOT NULL;

-- Ajouter localisation sur les dossiers
ALTER TABLE deals ADD COLUMN IF NOT EXISTS location TEXT;

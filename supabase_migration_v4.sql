-- Table de liaison many-to-many deals <-> organizations
CREATE TABLE IF NOT EXISTS deal_organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  user_id     UUID REFERENCES auth.users(id),
  UNIQUE(deal_id, organization_id)
);

-- RLS
ALTER TABLE deal_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deal_organizations" ON deal_organizations
  FOR ALL USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_deal_organizations_deal ON deal_organizations(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_organizations_org  ON deal_organizations(organization_id);

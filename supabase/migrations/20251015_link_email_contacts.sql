-- Link incoming and outgoing emails to contacts for conversation views

BEGIN;

ALTER TABLE public.incoming_emails
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS incoming_emails_contact_id_idx
  ON public.incoming_emails(contact_id);

ALTER TABLE public.outgoing_emails
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS outgoing_emails_contact_id_idx
  ON public.outgoing_emails(contact_id);

COMMIT;

-- Aggiunge FK su expenses.source_action_id verso actions.id.
-- ON DELETE SET NULL: le spese storiche restano anche se l'azione viene cancellata.
alter table public.expenses
  drop constraint if exists expenses_source_action_id_fkey;

alter table public.expenses
  add constraint expenses_source_action_id_fkey
  foreign key (source_action_id)
  references public.actions(id)
  on delete set null;

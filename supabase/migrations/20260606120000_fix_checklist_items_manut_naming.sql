-- Fix naming mismatch: _checklist_items used MANUT3/MANUT4 (no underscore)
-- but all TypeScript code and action_type values use MANUT_3/MANUT_4.
CREATE OR REPLACE FUNCTION "public"."_checklist_items"("p_action_type" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case p_action_type
    when 'PULIZIA' then array[
      'Bagno: WC/bidet/doccia + lavandino/specchio',
      'Cucina: piano/lavello + controllo stoviglie',
      'Rifiuti: svuota e sostituisci sacchetti',
      'Camera/Soggiorno: spolvero superfici',
      'Pavimenti: aspira/lava',
      'Biancheria: cambio set letto + set asciugamani',
      'Controlli: luci/telecomandi/chiavi + eventuali danni'
    ]
    when 'LAVATRICI' then array[
      'Raccolta biancheria sporca',
      'Lavatrice: lenzuola/federe (60°)',
      'Lavatrice: asciugamani (60°)',
      'Asciugatrice / stendi',
      'Piega e riponi biancheria pulita',
      'Controlla detersivo/ammorbidente'
    ]
    when 'PREPARA_LETTO' then array[
      'Coprimaterasso pulito',
      'Lenzuolo sotto',
      'Lenzuolo sopra / copripiumino',
      'Federe cuscini',
      'Asciugamani puliti in bagno',
      'Controllo visivo finale'
    ]
    when 'MANUT_3' then array[
      'Controllo interruttori/prese',
      'Verifica perdite rubinetti/scarichi',
      'Test rilevatore fumo/CO',
      'Controllo estintore',
      'Verifica serrature'
    ]
    when 'MANUT_4' then array[
      'Ispezione caldaia/boiler',
      'Pulizia filtri A/C',
      'Controllo kit pronto soccorso',
      'Verifica materassi/reti',
      'Test elettrodomestici'
    ]
    else array[]::text[]
  end;
$$;

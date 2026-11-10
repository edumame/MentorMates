-- A1 (audit 2026-11-08) JUDGE-004/JUDGE-007 follow-up: zero is a real rubric value.
-- lib/judging/scoring-config.ts normalizeCriterion now uses nullish defaults
-- (weight ?? 1, min ?? 1, max ?? 10), so a criterion with min 0 (Yes/No 0..1 template)
-- keeps min 0. The DB validator applies the same defaults: min defaults to 1 only when
-- missing, an explicit 0 is allowed; max defaults to 10 only when missing.
-- Replaces project_score_values_error from 202611080105 (only the normalized bounds change).
-- Idempotent: create or replace.

begin;

-- Null when valid, else an error message.
-- Numeric: number or numeric string within [lo, hi]. Normalized criteria use the client's
-- normalizeCriterion (min ?? 1, max ?? 10); raw criteria use QuestionFactory (min ?? 0, max ?? 10).
-- Weight is not validated here: weight 0 only removes a criterion from weighting, its value
-- must still be in range.
-- Multiple choice: one of options, or "" (unanswered).
create or replace function public.project_score_values_error(p_track_id uuid, p_round integer, p_scores jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rubric jsonb := public.project_score_rubric(p_track_id, p_round);
  v_normalized boolean := coalesce((v_rubric->>'normalized')::boolean, false);
  v_key text;
  v_value jsonb;
  v_criterion jsonb;
  v_num numeric;
  v_min numeric;
  v_max numeric;
  v_lo numeric;
  v_hi numeric;
begin
  if p_scores is null or jsonb_typeof(p_scores) <> 'object' then
    return 'Scores must be an object keyed by criterion id';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_scores) loop
    select c into v_criterion
    from jsonb_array_elements(v_rubric->'criteria') c
    where jsonb_typeof(c) = 'object' and c->>'id' = v_key
    limit 1;

    if v_criterion is null then
      return format('Unknown scoring criterion "%s" for this track', v_key);
    end if;

    if coalesce(v_criterion->>'type', 'numeric') = 'multiplechoice' then
      if not (
        jsonb_typeof(v_value) in ('string', 'number') and (
          (v_value #>> '{}') = ''
          or exists (
            select 1
            from jsonb_array_elements_text(
              case when jsonb_typeof(v_criterion->'options') = 'array' then v_criterion->'options' else '[]'::jsonb end
            ) o
            where o = (v_value #>> '{}')
          )
        )
      ) then
        return format('Invalid value for scoring criterion "%s"', v_key);
      end if;
    else
      v_num := public.jsonb_to_numeric_or_null(v_value);
      v_min := public.jsonb_to_numeric_or_null(v_criterion->'min');
      v_max := public.jsonb_to_numeric_or_null(v_criterion->'max');
      if v_normalized then
        -- normalizeCriterion(): min ?? 1, max ?? 10 (0 is a real bound, e.g. Yes/No 0..1).
        v_lo := coalesce(v_min, 1);
        v_hi := coalesce(v_max, 10);
      else
        v_lo := coalesce(v_min, 0);
        v_hi := coalesce(v_max, 10);
      end if;
      if v_num is null or v_num < v_lo or v_num > v_hi then
        return format('Invalid value for scoring criterion "%s"', v_key);
      end if;
    end if;
    v_criterion := null;
  end loop;

  return null;
end;
$$;

revoke all on function public.project_score_values_error(uuid, integer, jsonb) from public, anon;
grant execute on function public.project_score_values_error(uuid, integer, jsonb) to authenticated, service_role;

commit;

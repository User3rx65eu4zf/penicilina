CREATE OR REPLACE FUNCTION public.save_inventory_operation(_expected bigint, _data jsonb, _action text, _duration integer)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v bigint;
BEGIN
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' THEN RAISE EXCEPTION 'invalid data'; END IF;
  UPDATE public.inventory_state SET data = _data - 'currentRole', version = version + 1, updated_at = now()
  WHERE id = 1 AND version = _expected RETURNING version INTO v;
  IF v IS NOT NULL THEN
    INSERT INTO public.operation_log(action, ok, duration_ms, user_name, role)
    VALUES(left(_action,80), true, least(greatest(_duration,0),599999),
      CASE _data->>'currentRole' WHEN 'Administrador' THEN 'Lucía Vega' WHEN 'Supervisor' THEN 'Carmen Rojas' ELSE 'Jorge Quispe' END,
      coalesce(_data->>'currentRole','Encargado de almacén'));
  END IF;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.save_inventory_operation(bigint,jsonb,text,integer) TO anon, authenticated;
CREATE INDEX IF NOT EXISTS operation_log_created_at_idx ON public.operation_log(created_at DESC);
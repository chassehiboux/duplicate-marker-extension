create or replace function public.extension_is_kv_sync_key(p_key text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(p_key, '') = any (array[
    'setting_copy_mode',
    'setting_highlight_mode',
    'setting_notify_execution',
    'setting_notify_editing',
    'setting_department_containers',
    'list_DebtID',
    'list_AccAddress_AccountNumber',
    'list_Individual_FullName',
    'list_CaseNumber',
    'list_EDNumber',
    'strict_CaseNumber',
    'strict_EDNumber',
    'dup_show_hidden_departments',
    'dup_fsspreestr_group_duplicates',
    'pyramid_christmas_v10_enabled',
    'pyramid_spring_enabled',
    'pyramid_theme_feature_settings_v1',
    'vzid_last_claim_type',
    'vzid_last_claim_type_label',
    'vzid_last_claim_type_updated_at',
    'dup_google_sheets_problem_picker_bridge_url',
    'support_reminders_state_v1',
    'dup_execution_analysis_params_v1',
    'dup_execution_analysis_state_v1',
    'dup_id_card_check_state_v1',
    'dup_epgu_retry_excluded_claimants_v1'
  ])
  or coalesce(p_key, '') like 'jqgrid_settings_%'
  or (
    coalesce(p_key, '') like 'dup_ui_show_%'
    and coalesce(p_key, '') <> all (array[
      'dup_ui_show_stage_timer',
      'dup_ui_show_stage_timer_toggle',
      'dup_ui_show_stage_timer_abort'
    ])
  );
$$;

revoke all on function public.extension_is_kv_sync_key(text) from public, anon, authenticated;

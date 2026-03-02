#Dear BIE Team,
# This configuration is used to define the dbt models that will be run in the production environment.
# The configuration requires that you register the table name and table type at least.
from bip_operators.bie_dbt_operator import BIEDbtPartitionType, BIEDbtTableType, BIEDbtInputTriggerType, BIEDbtAggregationType

dbt_models_data_prod = [
	# ============================================
    # Cross - Intermediate
    # ============================================
	# Cross - Looker View
	{
        "table_name": "obrt_rtb_filter_lv",
        "input_trigger": ["stg_obrt_rtb_filter_is_ready_in_bq_bi"],
        "upstream_dbt_models": False,
        "max_active_tasks": 1,
        "max_active_runs": 1
    },
    {
        "table_name": "rtb_bidding_data_lv",
        "input_trigger": ["stg_rtb_bidding_data_is_ready_in_bq_bi"],
        "upstream_dbt_models": False,
        "max_active_tasks": 1,
        "max_active_runs": 1
    },
    {
        "table_name": "unified_events_lv",
        "input_trigger": ["stg_faue_unified_events_is_ready_in_bq_bi"],
        "upstream_dbt_models": False,
        "max_active_tasks": 1,
        "max_active_runs": 1,
        "enable_retry_alerts": False
    },
	# ============================================
    # Cross - Mart

    {
        "table_name": "facp_cross_performance_d",
        "input_trigger": ["faue_unified_events_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
		"requires_output_trigger" : True,
        "pre_conditions":[
            {
                "input_trigger_name": "hics_campaign_settings_d_is_ready_in_bq",
                "number_runs": 1,
            },
			{
                "input_trigger_name": "famc_multiple_conversion_summary_d_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },
    {
		"table_name": "facp_campaign_section_d",
		"input_trigger": ["facp_cross_performance_d_is_ready_in_bq_bi"],
		"input_trigger_type" : BIEDbtInputTriggerType.DAILY,
		"table_type": BIEDbtTableType.FACT,
		"requires_output_trigger" : True,
        "upstream_dbt_models": False,
	},
	{
        "table_name": "fasc_spend_based_cross_d",
        "input_trigger": ["faae_abrecs_exploded_campaign_geo_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
        "precondition_timeout_minutes": 480,  # 8 hours timeout for 24 hourly runs (covers edge cases with delays)
         "pre_conditions":[
            {
                "input_trigger_name": "hourlyHiceOnlineCtrEstimateTestVariantsToBQTriggerReadyInApache",
				"number_runs": 24,
            },
        ]
    },
    {
        "table_name": "maom_operational_margin_cross",
        "input_trigger": ["fasg_campaign_section_geo_traffic_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_type": BIEDbtTableType.MART,
		"upstream_dbt_models": False,
        "pre_conditions":[
            {
                "input_trigger_name": "fast_section_traffic_d_is_ready_in_bq_bi",
                "number_runs": 1,
            },
        ]
    },
	{
        "table_name": "mapc_publisher_campaign_geo_traffic_d",
        "input_trigger": ["fakc_kpio_clicks_conversions_and_fakc_max_iterations_are_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
        "pre_conditions":[
            {
                "input_trigger_name": "hics_campaign_settings_d_is_ready_in_bq",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "fabe_campaign_budget_exploitation_d_is_ready_in_bq",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "facs_campaign_section_traffic_d_is_ready_in_bq",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "fasg_campaign_section_geo_traffic_d_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },
	# ============================================
    # Demand - Intermediate
	{
		"table_name": "diza_zemanta_account_supplement",
		"schedule_interval": "@daily",
		"table_type": BIEDbtTableType.DIMENSION,
	},
    # ============================================
	# Demand - Looker View
	{
        "table_name": "zemanta_dsp_dashboard_lv",
        "input_trigger": ["stg_zemanta_unified_events_is_ready_in_bq_bi"],
        "upstream_dbt_models": False
    },
	# ============================================
    # Demand - Mart
	{
		"table_name": "fabm_bidding_demand_traffic_d",
		"input_trigger": ["fabm_bidding_demand_traffic_d_is_ready_in_bq"],
		"input_trigger_type" : BIEDbtInputTriggerType.HOURLY,
		"table_partition_type" : BIEDbtPartitionType.DAILY,
		"table_type": BIEDbtTableType.FACT,
		"requires_output_trigger" : True
	},
	{
        "table_name": "fadl_demand_level_engage_d",
        "input_trigger": ["faae_abrecs_exploded_campaign_geo_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
        "pre_conditions":[
            {
                "input_trigger_name": "fasg_campaign_section_geo_traffic_d_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },
    {
		"table_name": "facp_ad_traffic_d",
		"input_trigger": ["facp_cross_performance_d_is_ready_in_bq_bi"],
		"input_trigger_type" : BIEDbtInputTriggerType.DAILY,
		"table_type": BIEDbtTableType.FACT,
		"requires_output_trigger" : True,
        "upstream_dbt_models": False,
	},
	{
        "table_name": "faud_small_table_d",
        "input_trigger": ["faud_unified_demand_traffic_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
		"requires_output_trigger" : True
    },

    {
        "table_name": "hial_audit_logs_marketer_d",
        "input_trigger": ["himl_marketer_audit_logs_in_hive_is_readyInApache"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
        "precondition_time_offset_days": -1,
        "requires_output_trigger" : True,
        "pre_conditions":[
            {
                "input_trigger_name": "hier_exchange_rate_d_is_ready_in_bq",
                "number_runs": 1,
                "time_offset_days": 0,  # This table needs current day (05), not -1 day
            },
            {
                "input_trigger_name": "hima_marketer_d_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },

	{
        "table_name": "hisi_smart_insight_d",
        "input_trigger": ["hiac_ad_change_log_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
		"precondition_time_offset_days": -1,
        "upstream_dbt_models": False,
        "pre_conditions":[
            {
                "input_trigger_name": "hics_campaign_settings_d_is_ready_in_bq",
                "number_runs": 1,
            },
			{
                "input_trigger_name": "facp_cross_performance_d_is_ready_in_bq_bi",
                "number_runs": 1,
            },
        ]
    },

	{
        "table_name": "macf_content_filtering",
        "input_trigger": ["faon_online_filter_traffic_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
        "pre_conditions":[
            {
                "input_trigger_name": "faad_ad_traffic_d_is_ready_in_bq",
                "number_runs": 1,
            },
			{
                "input_trigger_name": "fabr_bidding_rejected_creative_d_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },
	{
        "table_name": "maom_ob_marketer_performance_d",
        "input_trigger": ["hier_exchange_rate_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
		"table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
        "precondition_time_offset_days": -1,
		"upstream_dbt_models": False,
        "pre_conditions":[
			{
                "input_trigger_name": "faud_small_table_d_is_ready_in_bq_bi",
                "number_runs": 1,
            },
			{
                "input_trigger_name": "ficd_finance_commission_demand_q_is_ready_in_bq",
                "number_runs": 1,
            },
			{
                "input_trigger_name": "hics_campaign_settings_d_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },
      {
        "table_name": "maom_ob_marketer_performance_d_new",
        "input_trigger": ["faud_small_table_d_is_ready_in_bq_bi"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
		"table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
		"upstream_dbt_models": False,
        "pre_conditions":[ 
			{
                "input_trigger_name": "hier_exchange_rate_d_is_ready_in_bq", 
                "number_runs": 1,
                "time_offset_days": 1,
            },
			{
                "input_trigger_name": "ficd_finance_commission_demand_q_is_ready_in_bq",
                "number_runs": 1,
            },
			{
                "input_trigger_name": "hics_campaign_settings_d_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },
    {
        "table_name": "matt_teads_amplify_traffic",
        "input_trigger": ["hier_exchange_rate_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
		"precondition_time_offset_days": -1,
		"pre_conditions":[
			{
                "input_trigger_name": "fabe_campaign_budget_exploitation_d_is_ready_in_bq",
                "number_runs": 1,
            },
			{
                "input_trigger_name": "hics_campaign_settings_d_is_ready_in_bq",
                "number_runs": 1,
            },
			{
                "input_trigger_name": "facm_campaign_traffic_d_is_ready_in_bq",
                "number_runs": 1,
            },
			{
                "input_trigger_name": "famc_multiple_conversion_click_listing_traffic_is_ready_in_bq",
                "number_runs": 1,
            },
			{
				"input_trigger_name": "faae_advertiser_engagement_in_hive_is_readyInApache",
				"number_runs": 1,
			}
        ]
    },
    {
        "table_name": "masd_small_dido_document",
        "input_trigger": ["fact_category_traffic_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
		"table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
    },
	# ============================================
    # Dimensions
    # ============================================
	{
        "table_name": "dicp_case_sub_reason_importence",
        "schedule_interval": "@weekly",
        "table_type": BIEDbtTableType.DIMENSION,
    },
	{
        "table_name": "digd_guarantee_deducted_pvs",
        "schedule_interval": "@daily",
        "table_type": BIEDbtTableType.DIMENSION,
    },
    {
        "table_name": "dilp_latest_partition",
        "schedule_interval": "*/20 * * * *",
        "table_type": BIEDbtTableType.DIMENSION,
    },
    {
        "table_name": "dirt_refresh_tracker_tables",
        "schedule_interval": "0 */6 * * *",
        "table_type": BIEDbtTableType.DIMENSION,
    },
	{
        "table_name": "diub_unified_blocks",
        "schedule_interval": "@daily",
        "table_type": BIEDbtTableType.DIMENSION,
    },

	# ============================================
    # Finance - Intermediate
    # ============================================
	# Finance - Looker View
	# ============================================
    # Finance - Mart
	{
        "table_name": "mapd_proxy_demand_ob_extac_m",
        "input_trigger": ["fapm_publisher_marketer_traffic_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
		"upstream_dbt_models": False,
    },
 	{
        "table_name": "mauf_unified_forecast_delivery_fpa_d",
        "input_trigger": ["faot_ob_traffic_fpa_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
		"table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
        "pre_conditions":[
			{
                "input_trigger_name": "fatt_teads_traffic_fpa_d_is_ready_in_bq",
                "number_runs": 1,
            },
			{
                "input_trigger_name": "fape_publishers_extac_d_is_ready_in_bq_bi",
                "number_runs": 1,
            },
        ]
    },
	# ============================================
    # Supply - Intermediate
    # ============================================
	# Supply - Looker View
	{
        "table_name": "faet_engage_traffic_lv",
        "input_trigger": ["fast_section_traffic_d_is_ready_in_bq_bi"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "upstream_dbt_models": False
    },
	# ============================================
    # Supply - Mart
	{
        "table_name": "facd_commercial_unified_datamart_d",
        "input_trigger": ["fast_section_traffic_d_is_ready_in_bq_bi"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
	    "upstream_dbt_models": False,
        "pre_conditions":[
            {
                "input_trigger_name": "exTeadsTriggerbq-console-datamart-169436",
                "number_runs": 1,
                "time_offset_days": -1,  # Teads sends on D at 19:00 that data for D+1 is ready; run is for D+1 so look for trigger from D
            },
        ]
    },
    {
        "table_name": "fagf_gmo_factor_d",
        "input_trigger": ["hipb_publisher_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type": BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
        "upstream_dbt_models": False,
        "precondition_time_offset_days": -1,
        "pre_conditions":[
            {
                "input_trigger_name": "hisp_revenue_shaping_shaped_publisher_d_is_ready_in_bq",
                "number_runs": 1,
                "time_offset_days": 0,  # Look for trigger with handledHour: 23
            },
            {
                "input_trigger_name": "higd_guarantee_daily_m_is_ready_in_bq_bi",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "fakc_kpio_clicks_conversions_and_fakc_max_iterations_are_ready_in_bq",
                "number_runs": 24,
            },
        ]
    },
	{
        "table_name": "fagi_gmo_impact_publisher_traffic_w",
        "input_trigger": ["fakc_kpio_clicks_conversions_and_fakc_max_iterations_are_ready_in_bq"], 
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "aggregation_type": BIEDbtAggregationType.WEEKLY,
        "table_partition_type": BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
		"upstream_dbt_models": False,
        "pre_conditions":[
            {
                "input_trigger_name": "hics_campaign_settings_d_is_ready_in_bq",
                "number_runs": 1,
                "handled_hour": 23,
                 "time_offset_days": -1,  # Look for trigger with handledHour: 23
            },
            {
                "input_trigger_name": "fast_section_traffic_agg_d_is_ready_in_bq_bi",
                "number_runs": 1,
                "handled_hour": 23,
                 "time_offset_days": -1,  # Look for trigger with handledHour: 23
            },
        ]
    },
    {
        "table_name": "fape_publishers_extac_d",
        "input_trigger": ["hipb_publisher_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
		"requires_output_trigger" : True,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
        "precondition_time_offset_days": -1,
        "pre_conditions":[
            {
                "input_trigger_name": "faup_publisher_daily_upfront_payment_is_ready_in_bq_bi",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "fast_section_traffic_d_is_ready_in_bq",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "digc_guarantee_calculation_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },
    {
        "table_name": "mape_publishers_extac_d",
        "input_trigger": ["hipb_publisher_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
        "requires_output_trigger" : True,
        "precondition_time_offset_days": -1,
        "pre_conditions":[
            {
                "input_trigger_name": "faup_publisher_daily_upfront_payment_is_ready_in_bq_bi",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "fast_section_traffic_d_is_ready_in_bq",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "digc_guarantee_calculation_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },
	{
        "table_name": "fapg_publisher_gmo_boost_geo_traffic_d",
        "input_trigger": ["hisp_revenue_shaping_shaped_publisher_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
        "precondition_time_offset_days": -1,
        "precondition_timeout_minutes": 240,  # 4 hours timeout for heavy table
        "upstream_dbt_models": False,
        "pre_conditions":[
            {
                "input_trigger_name": "fast_section_traffic_agg_d_is_ready_in_bq_bi",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "fakc_kpio_clicks_conversions_and_fakc_max_iterations_are_ready_in_bq",
                "number_runs": 24,
            },
        ]
    },
    {
        "table_name": "fapl_page_level_engage_d",
        "input_trigger": ["fast_section_traffic_d_is_ready_in_bq_bi"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_type": BIEDbtTableType.FACT,
		"upstream_dbt_models": False,
        "pre_conditions":[
            {
                "input_trigger_name": "faap_abrecs_page_level_exploded_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },
    {
        "table_name": "fapm_publisher_marketer_bi_d",
        "input_trigger": ["hisp_section_product_traffic_d_is_ready_in_bq_bi"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type": BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
        "requires_output_trigger": True,
        "upstream_dbt_models": False,
		"precondition_time_offset_days": -1,
        "pre_conditions": [
            {
                "input_trigger_name": "facs_campaign_section_traffic_d_is_ready_in_bq",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "hics_campaign_settings_d_is_ready_in_bq",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "fabe_campaign_budget_exploitation_d_is_ready_in_bq",
                "number_runs": 1,
            },
            {
                "input_trigger_name": "hisc_revenue_shaping_shaped_campaign_d_is_ready_in_bq",
                "number_runs": 1,
            },
        ]
    },
	{
		"table_name": "fasc_supply_scores_unified_v3",
		"input_trigger": ["hisp_section_product_traffic_d_is_ready_in_bq_bi"],
		"input_trigger_type": BIEDbtInputTriggerType.DAILY,
		"table_partition_type": BIEDbtPartitionType.DAILY,
		"table_type": BIEDbtTableType.FACT,
		"precondition_time_offset_days": -1,
		"pre_conditions": [
			{
				"input_trigger_name": "fast_section_traffic_d_is_ready_in_bq_bi",
				"number_runs": 1,
			},
			{
				"input_trigger_name": "fadt_src_doc_traffic_d_is_ready_in_bq",
				"number_runs": 1,
			},
			{
				"input_trigger_name": "fasg_campaign_section_geo_traffic_d_is_ready_in_bq",
				"number_runs": 1,
			},
			{
				"input_trigger_name": "hipb_publisher_d_is_ready_in_bq",
				"number_runs": 1,
				"time_offset_days": 0,
			},
			{
				"input_trigger_name": "hisf_kpio_source_platform_factors_is_ready_in_bq",
				"number_runs": 1,
			},
			{
				"input_trigger_name": "hipf_publisher_platform_factors_is_ready_in_bq",
				"number_runs": 1,
			},
		]
	},
	{
        "table_name": "fass_spend_based_supply_d",
        "input_trigger": ["faap_abrecs_page_level_exploded_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
        "precondition_timeout_minutes": 480,  # 8 hours timeout for 24 hourly runs (covers edge cases with delays)
         "pre_conditions":[
            {
                "input_trigger_name": "hourlyHiceOnlineCtrEstimateTestVariantsToBQTriggerReadyInApache",
				"number_runs": 24,
            },
        ]
    },
	{
		"table_name": "fast_section_traffic_agg_d",
		"input_trigger": ["fast_section_traffic_d_is_ready_in_bq_bi"],
		"input_trigger_type" : BIEDbtInputTriggerType.HOURLY,
  		"table_partition_type" : BIEDbtPartitionType.DAILY,
		"table_type": BIEDbtTableType.FACT,
  		"upstream_dbt_models": False,
    	"requires_output_trigger" : True
	},
	{
		"table_name": "fast_section_traffic_d",
		"input_trigger": ["fast_section_traffic_d_is_ready_in_bq"],
		"input_trigger_type" : BIEDbtInputTriggerType.HOURLY,
		"table_type": BIEDbtTableType.FACT,
		"requires_output_trigger" : True
	},
	{
        "table_name": "fatr_em_trigger_rate",
        "input_trigger": ["faue_unified_events_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
		"requires_output_trigger" : True,
    },
    {
        "table_name": "faws_supply_demand_unified_placements_d",
        "input_trigger": ["hisp_section_product_traffic_d_is_ready_in_bq_bi"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
	    "upstream_dbt_models": False,
       	"precondition_time_offset_days": -1,
     	"pre_conditions":[
            {
                "input_trigger_name": "facs_campaign_section_traffic_d_is_ready_in_bq",
				"number_runs": 1,
            },
            {
                "input_trigger_name": "exTeadsTriggerbq-console-datamart-169436",
                "number_runs": 1,
                "time_offset_days": -2,  # hisp releases next day (run date D = data D-1); Teads for D-1 sent on D-2 19:00 → look for trigger from D-2
            },
        ]
    },
	{
        "table_name": "higd_guarantee_daily_m",
        "input_trigger": ["fagm_guarantee_manual_calculations_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type": BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.FACT,
        "requires_output_trigger" : True,
        "upstream_dbt_models": False,
    },
    {
		"table_name": "hisp_section_product_traffic_d",
		"input_trigger": ["hisc_section_configuration_d_is_ready_in_bq"],
		"input_trigger_type": BIEDbtInputTriggerType.DAILY,
		"table_partition_type" : BIEDbtPartitionType.DAILY,
		"table_type": BIEDbtTableType.FACT,
		"upstream_dbt_models": False,
  		"requires_output_trigger" : True,
  		"precondition_time_offset_days": -1,  # Default offset for preconditions
        "precondition_timeout_minutes": 240,  # 4 hours timeout for heavy table
		"pre_conditions":[
			{
                "input_trigger_name": "fast_section_traffic_agg_d_is_ready_in_bq_bi",
				"number_runs": 1,
            },
			{
                "input_trigger_name": "faee_engage_events_is_ready_in_bq",
				"number_runs": 1,
            },
			{
                "input_trigger_name": "hipb_publisher_d_is_ready_in_bq",
				"number_runs": 1,
				"time_offset_days": 0,  # This table needs current day (05), not -1 day
            },
		]
	},
	{
        "table_name": "maba_btf_adoption_d",
        "input_trigger": ["hisc_section_configuration_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
        "precondition_time_offset_days": -1,
        "upstream_dbt_models": False,
        "pre_conditions":[
            {
                "input_trigger_name": "fast_section_traffic_d_is_ready_in_bq_bi",
				"number_runs": 1,
            },
			{
                "input_trigger_name": "faee_engage_events_is_ready_in_bq",
				"number_runs": 1,
            },
        ]
    },
	{
        "table_name": "mabp_btf_publishers_products_d",
        "input_trigger": ["hisc_section_configuration_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
        "precondition_time_offset_days": -1,
        "upstream_dbt_models": False,
        "pre_conditions":[
            {
                "input_trigger_name": "fast_section_traffic_d_is_ready_in_bq_bi",
				"number_runs": 1,
            },
			{
                "input_trigger_name": "faee_engage_events_is_ready_in_bq",
				"number_runs": 1,
            },
			{
                "input_trigger_name": "fatr_em_trigger_rate_is_ready_in_bq_bi",
				"number_runs": 1,
            },
        ]
    },
    {
        "table_name": "magc_guarantee_calculations",
        "input_trigger": ["fast_section_traffic_d_is_ready_in_bq_bi"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
        "upstream_dbt_models": True,
    },
	{
        "table_name": "masp_supply_placement_type_d",
        "input_trigger": ["hisc_section_configuration_d_is_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.DAILY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
        "precondition_time_offset_days": -1,
		"upstream_dbt_models": False,
        "pre_conditions":[
            {
                "input_trigger_name": "fast_section_traffic_d_is_ready_in_bq_bi",
				"number_runs": 1,
            },
			{
                "input_trigger_name": "faee_engage_events_is_ready_in_bq",
				"number_runs": 1,
            },
        ]
    },
    {
        "table_name": "masr_source_referrer",
        "input_trigger": ["fast_section_traffic_d_is_ready_in_bq_bi"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
		"upstream_dbt_models": False,
    },
    {
        "table_name": "maiq_inventory_quality_unified_d",
        "input_trigger": ["faue_unified_events_ready_in_bq"],
        "input_trigger_type": BIEDbtInputTriggerType.HOURLY,
        "table_partition_type" : BIEDbtPartitionType.DAILY,
        "table_type": BIEDbtTableType.MART,
		"upstream_dbt_models": False,
        "sleep_till_cron": "30 7 * * *"
    },
    
]

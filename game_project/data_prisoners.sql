SELECT
    ROW_NUMBER() OVER (PARTITION BY gm.match_id ORDER BY gr.round_number ASC) as row_number,
    gm.match_id AS game_match_uuid,
    gm.player_1_fingerprint,
    gr.player_1_action,
    gr.player_1_score,
    gm.player_2_fingerprint,
    gr.player_2_action,
    gr.player_2_score,
    gr.player_1_cooperation_percent,  
    gr.player_2_cooperation_percent,  
    gr.avg_cooperation_percent,       
    gr.player_1_cumulative_score,
    gr.player_2_cumulative_score,
    gm.player_1_country,
    gm.player_1_city,
    gm.player_2_country,
    gm.player_2_city,
    gr.round_start_time AS round_start,
    gr.round_end_time AS round_end,
    gm.is_complete AS match_complete,
    gm.completed_at AS match_completed_at
FROM
    the_game_gameround AS gr
JOIN
    the_game_gamematch AS gm ON gr.match_id = gm.id
WHERE
    gr.player_1_action IS NOT NULL 
    AND gr.player_2_action IS NOT NULL
ORDER BY
    gm.match_id, gr.round_number ASC;
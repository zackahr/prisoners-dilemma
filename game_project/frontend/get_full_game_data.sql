SELECT
    ROW_NUMBER() OVER (PARTITION BY gm.match_id ORDER BY gr.round_number ASC) AS sequential_round_num,
    gr.id AS round_id,
    gr.round_number,
    gr.player_1_action,
    gr.player_2_action,
    gr.player_1_score,
    gr.player_2_score,
    gr.round_start_time AS round_start,
    gr.round_end_time AS round_end,
    gm.match_id AS game_match_uuid,
    gm.player_1_fingerprint,
    gm.player_2_fingerprint,
    gm.player_1_country,
    gm.player_1_city,
    gm.player_2_country,
    gm.player_2_city,
    gm.avg_cooperation_percent,
    gm.player_1_cooperation_percent,
    gm.player_2_cooperation_percent,
    gm.player_1_final_score,
    gm.player_2_final_score,
    gm.is_complete AS match_complete,
    gm.completed_at AS match_completed_at
FROM
    the_game_gameround AS gr
JOIN
    the_game_gamematch AS gm ON gr.match_id = gm.id
ORDER BY
    gm.match_id ASC,
    gr.round_number ASC;
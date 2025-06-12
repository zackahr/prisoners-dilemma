SELECT
    ROW_NUMBER() OVER (PARTITION BY ugr.game_match_uuid ORDER BY ugr.round_number ASC) as round_number,
    ugr.game_match_uuid,
    ugr.game_mode,


    ugr.player_1_fingerprint,
    ugr.player_1_ip_address,
    ugr.player_1_coins_to_keep,
    ugr.player_1_coins_to_offer,
    ugr.player_1_response_to_p2_offer,
    ugr.player_1_coins_made_in_round,

    ugr.player_2_fingerprint,
    ugr.player_2_ip_address,
    ugr.player_2_coins_to_keep,
    ugr.player_2_coins_to_offer,
    ugr.player_2_response_to_p1_offer,
    ugr.player_2_coins_made_in_round,

    ugr.players_sum_coins_in_round,
    ugr.players_sum_coins_total,
    ugr.player_1_final_score,
    ugr.player_2_final_score,

    ugr.player_1_country,
    ugr.player_1_city,
    ugr.player_2_country,
    ugr.player_2_city,

    ugr.round_start,
    ugr.round_end,
    ugr.match_complete
FROM
    ultimatum_ultimatumgameround AS ugr
WHERE
    ugr.player_1_coins_to_keep IS NOT NULL 
    AND ugr.player_1_coins_to_offer IS NOT NULL
    AND ugr.player_2_coins_to_keep IS NOT NULL
    AND ugr.player_2_coins_to_offer IS NOT NULL
    AND ugr.player_1_response_to_p2_offer IS NOT NULL
    AND ugr.player_2_response_to_p1_offer IS NOT NULL
ORDER BY
    ugr.game_match_uuid, ugr.round_number ASC;
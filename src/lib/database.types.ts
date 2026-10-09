export interface League { id: string; name: string; created_at: string }
export interface Season { id: string; league_id: string; year: number; start_date: string | null; end_date: string | null; course_par: number; handicap_rounds: number; handicap_allowance: number; skins_buyin: number; skins_gross: boolean; skins_carryover: boolean; ghost_mode: string; first_tee_time: string; tee_interval_min: number; created_at: string }
export interface Player { id: string; league_id: string; name: string; email: string | null; is_senior: boolean; active: boolean; created_at: string }
export interface Team { id: string; season_id: string; name: string; player1_id: string | null; player2_id: string | null; is_ghost: boolean; created_at: string }
export interface Week { id: string; season_id: string; number: number; date: string; status: string; created_at: string }
export interface Match { id: string; week_id: string; team_a_id: string; team_b_id: string; tee_time: string | null; created_at: string }
export interface MatchPlayer { id: string; match_id: string; player_id: string; team_id: string; handicap_used: number; strokes_received: number; is_sub: boolean; is_absent: boolean; created_at: string }
export interface Score { id: string; match_player_id: string; hole_number: number; gross: number }
export interface HandicapHistory { id: string; player_id: string; season_id: string; week_number: number; handicap: number; gross_score: number | null; created_at: string }
export interface MatchResult { id: string; match_id: string; team_a_points: number; team_b_points: number; team_a_hole_points: number; team_b_hole_points: number; team_a_front_points: number; team_b_front_points: number; team_a_back_points: number; team_b_back_points: number; team_a_overall_points: number; team_b_overall_points: number; updated_at: string }

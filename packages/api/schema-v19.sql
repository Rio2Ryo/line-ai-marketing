-- Schema v19: Visual editor support for scenario steps
ALTER TABLE scenario_steps ADD COLUMN position_x REAL DEFAULT 0;
ALTER TABLE scenario_steps ADD COLUMN position_y REAL DEFAULT 0;
ALTER TABLE scenario_steps ADD COLUMN node_type TEXT DEFAULT 'message';
ALTER TABLE scenario_steps ADD COLUMN next_step_id TEXT;
ALTER TABLE scenario_steps ADD COLUMN condition_true_step_id TEXT;
ALTER TABLE scenario_steps ADD COLUMN condition_false_step_id TEXT;

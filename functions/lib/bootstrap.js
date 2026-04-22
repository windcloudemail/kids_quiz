// Self-contained schema + seed for `wrangler pages dev` local D1.
// Kept in sync with .cloudflare/schema.sql and .cloudflare/dev_seed.sql.
// The wrangler local D1 used by `pages dev` is hashed by database_id, which
// differs from the one used by `wrangler d1 execute --local`. To avoid
// maintaining two copies of the same file, POST /api/admin/init applies these
// strings directly through the same env.DB binding that pages dev uses.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS teachers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  username              TEXT UNIQUE NOT NULL,
  display_name          TEXT NOT NULL,
  password_hash         TEXT NOT NULL,
  daily_goal            INTEGER NOT NULL DEFAULT 30,
  created_by_teacher_id INTEGER NOT NULL,
  created_at            TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id)
);

CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL,
  name        TEXT NOT NULL,
  subject     TEXT,
  grade       INTEGER,
  invite_code TEXT UNIQUE NOT NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

CREATE TABLE IF NOT EXISTS class_students (
  class_id   INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  joined_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (class_id, student_id),
  FOREIGN KEY (class_id)   REFERENCES classes(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS questions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_teacher_id INTEGER NOT NULL,
  subject          TEXT NOT NULL,
  grade            INTEGER NOT NULL,
  unit             TEXT,
  difficulty       INTEGER NOT NULL DEFAULT 1,
  question         TEXT NOT NULL,
  zhuyin           TEXT,
  option_a         TEXT NOT NULL,
  option_b         TEXT NOT NULL,
  option_c         TEXT NOT NULL,
  option_d         TEXT NOT NULL,
  answer           TEXT NOT NULL,
  explanation      TEXT,
  used_count       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_teacher_id) REFERENCES teachers(id)
);

CREATE TABLE IF NOT EXISTS student_attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  class_id    INTEGER,
  selected    TEXT NOT NULL,
  correct     INTEGER NOT NULL,
  time_ms     INTEGER,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id)  REFERENCES students(id),
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (class_id)    REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS daily_streaks (
  student_id          INTEGER NOT NULL,
  date                TEXT NOT NULL,
  questions_answered  INTEGER NOT NULL DEFAULT 0,
  goal_met            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, date),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_type  TEXT NOT NULL,
  user_id    INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_subject_grade ON questions(subject, grade);
CREATE INDEX IF NOT EXISTS idx_questions_owner ON questions(owner_teacher_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student_time ON student_attempts(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON student_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_class_time ON student_attempts(class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`

const DEV_HASH =
  '3f19c1c3adb0f97ed06b9411dcfb1ff8eaecbcc259d5b7657b952a12e5bd842b'

const RUBY =
  '[{"c":"下","zy":"ㄒㄧㄚˋ"},{"c":"列","zy":"ㄌㄧㄝˋ"},{"c":"哪","zy":"ㄋㄚˇ"},{"c":"個","zy":"˙ㄍㄜ"},{"c":"詞","zy":"ㄘˊ"},{"c":"語","zy":"ㄩˇ"},{"c":"的","zy":"˙ㄉㄜ"},{"c":"用","zy":"ㄩㄥˋ"},{"c":"法","zy":"ㄈㄚˇ"},{"c":"最","zy":"ㄗㄨㄟˋ"},{"c":"恰","zy":"ㄑㄧㄚˋ"},{"c":"當","zy":"ㄉㄤˋ"},{"c":"？","zy":""}]'

export const SEED_SQL = `
INSERT INTO teachers (id, email, password_hash, name) VALUES
  (1, 'teacher@test.com', '${DEV_HASH}', '王老師');

INSERT INTO students (id, username, display_name, password_hash, daily_goal, created_by_teacher_id) VALUES
  (1, 'ming',  '小明',   '${DEV_HASH}', 30, 1),
  (2, 'wang',  '王小明', '${DEV_HASH}', 30, 1),
  (3, 'chen',  '陳美惠', '${DEV_HASH}', 30, 1),
  (4, 'lin',   '林宜靜', '${DEV_HASH}', 30, 1),
  (5, 'zhang', '張志豪', '${DEV_HASH}', 30, 1);

INSERT INTO classes (id, teacher_id, name, subject, grade, invite_code) VALUES
  (1, 1, '四年三班', NULL, 4, '1234');

INSERT INTO class_students (class_id, student_id) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4), (1, 5);

INSERT INTO questions (id, owner_teacher_id, subject, grade, unit, difficulty, question, zhuyin, option_a, option_b, option_c, option_d, answer, explanation, used_count) VALUES
  (1, 1, 'chinese', 3, '字詞辨識', 2, '下列哪個詞語的用法最恰當？「他的字跡＿＿，老師看不懂。」', '${RUBY}', '潦草', '詳細', '工整', '漂亮', 'A', '「潦草」形容字跡或做事不工整、不仔細，常用於「字跡潦草」。', 142),
  (2, 1, 'math', 2, '乘法', 1, '7 × 8 = ？', NULL, '54', '56', '58', '60', 'B', '7 × 8 = 56。可以用 7 × 8 = 7 × 10 − 7 × 2 = 70 − 14 = 56 來驗算。', 305),
  (3, 1, 'math', 4, '分數加減', 3, '小美吃了一個披薩的 1/4，小華吃了 2/8，兩人合計吃了幾分之幾？', NULL, '1/4', '1/2', '3/8', '1/3', 'B', '2/8 可以化簡為 1/4。1/4 + 1/4 = 2/4 = 1/2。', 98),
  (4, 1, 'english', 2, 'Colors', 1, 'The sky is _____ on a sunny day.', NULL, 'red', 'blue', 'green', 'yellow', 'B', 'On a clear sunny day the sky looks blue because of how sunlight scatters in the air.', 215),
  (5, 1, 'english', 4, 'Tenses', 2, 'Yesterday, I _____ to the park with my dog.', NULL, 'go', 'goes', 'went', 'going', 'C', 'Yesterday 是過去時間標記，動詞要用過去式。Go 的過去式是 went。', 122);
`

// Naive SQL splitter: assumes no ';' inside quoted values (holds for our files).
export function splitStatements(sql) {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'))
}

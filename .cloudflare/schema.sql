-- Kids Quiz D1 schema v1.0
-- Policy per F1-i / F2-ii / F3-ii decisions:
--   F1-i : questions are publicly READable to every teacher/student.
--          Only the owning teacher may UPDATE/DELETE (enforced in API, not DB).
--   F2-ii: teachers MANUALLY create student accounts (no self-signup).
--          classes.invite_code is kept but re-scoped: it lets an EXISTING
--          student (with login credentials) self-join an ADDITIONAL class.
--   F3-ii: students can belong to multiple classes via class_students (m-to-m).
--
-- All CREATE statements use IF NOT EXISTS so this file stays idempotent.
-- Schema evolutions should use ALTER TABLE, never DROP+CREATE.

-- ========================================================================
-- Users
-- ========================================================================

CREATE TABLE IF NOT EXISTS teachers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,               -- bcrypt
  name          TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  username              TEXT UNIQUE NOT NULL,
  display_name          TEXT NOT NULL,
  password_hash         TEXT NOT NULL,       -- bcrypt, initial value set by teacher
  daily_goal            INTEGER NOT NULL DEFAULT 30,
  created_by_teacher_id INTEGER NOT NULL,    -- first teacher who provisioned the account
  created_at            TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id)
);

-- ========================================================================
-- Classes
-- ========================================================================

CREATE TABLE IF NOT EXISTS classes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id  INTEGER NOT NULL,
  name        TEXT NOT NULL,                 -- e.g. 四年三班
  subject     TEXT,                          -- 'chinese' | 'math' | 'english' | NULL(全科)
  grade       INTEGER,                       -- 1..6 | NULL(跨年級)
  invite_code TEXT UNIQUE NOT NULL,          -- 8+ char random, e.g. KID-4A7X9
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Many-to-many: a student may belong to several classes across teachers.
CREATE TABLE IF NOT EXISTS class_students (
  class_id   INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  joined_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (class_id, student_id),
  FOREIGN KEY (class_id)   REFERENCES classes(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ========================================================================
-- Questions
-- ========================================================================

-- No is_public column: every row is globally readable.
-- Options are stored in positional columns option_a..option_d.
-- `answer` and student-side `selected` use the letters 'A'..'D' to match UI data.
-- `zhuyin` is a JSON array of {c, zy} pairs for Chinese ruby annotation;
--   NULL for math/english rows.
CREATE TABLE IF NOT EXISTS questions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_teacher_id INTEGER NOT NULL,
  source_number    INTEGER,                  -- 原題本題號 (nullable for manually added)
  subject          TEXT NOT NULL,            -- 'chinese' | 'math' | 'english'
  grade            INTEGER NOT NULL,         -- 1..6
  unit             TEXT,                     -- free-text topic/unit label
  difficulty       INTEGER NOT NULL DEFAULT 1,  -- 1..5 (stars)
  question         TEXT NOT NULL,
  zhuyin           TEXT,                     -- JSON: [{"c":"下","zy":"ㄒㄧㄚˋ"}, ...]
  option_a         TEXT NOT NULL,
  option_b         TEXT NOT NULL,
  option_c         TEXT NOT NULL,
  option_d         TEXT NOT NULL,
  answer           TEXT NOT NULL,            -- 'A' | 'B' | 'C' | 'D'
  explanation      TEXT,
  image_url        TEXT,                     -- R2 key path (/api/media/...) for question image
  used_count       INTEGER NOT NULL DEFAULT 0,  -- denormalised for list perf
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_teacher_id) REFERENCES teachers(id)
);

-- ========================================================================
-- Activity
-- ========================================================================

-- One row per answer submission (not per quiz session).
-- class_id is nullable: a student may practice outside any class context.
CREATE TABLE IF NOT EXISTS student_attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  class_id    INTEGER,
  selected    TEXT NOT NULL,                 -- 'A' | 'B' | 'C' | 'D'
  correct     INTEGER NOT NULL,              -- 0 | 1
  time_ms     INTEGER,                       -- optional: ms spent on this question
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id)  REFERENCES students(id),
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (class_id)    REFERENCES classes(id)
);

-- Pre-aggregated per-day tally for streak badge + daily goal card.
-- Written by API on each submission (INSERT ... ON CONFLICT DO UPDATE).
CREATE TABLE IF NOT EXISTS daily_streaks (
  student_id          INTEGER NOT NULL,
  date                TEXT NOT NULL,         -- YYYY-MM-DD, Asia/Taipei local
  questions_answered  INTEGER NOT NULL DEFAULT 0,
  goal_met            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, date),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ========================================================================
-- Sessions
-- ========================================================================

-- httpOnly cookie carries `token`; server looks it up on every request.
-- user_type narrows the join target (teachers / students).
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,               -- 32-byte random hex (64 chars)
  user_type  TEXT NOT NULL,                  -- 'teacher' | 'student'
  user_id    INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

-- ========================================================================
-- Indexes
-- ========================================================================

CREATE INDEX IF NOT EXISTS idx_questions_subject_grade
  ON questions(subject, grade);
CREATE INDEX IF NOT EXISTS idx_questions_owner
  ON questions(owner_teacher_id);

CREATE INDEX IF NOT EXISTS idx_attempts_student_time
  ON student_attempts(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_question
  ON student_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_class_time
  ON student_attempts(class_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_class_students_student
  ON class_students(student_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON sessions(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires
  ON sessions(expires_at);

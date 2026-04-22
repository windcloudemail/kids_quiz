-- Dev seed for local D1. DO NOT run against production DB.
-- All password_hash values are sha256_hex('kids-dev:' || plaintext).
-- All dev accounts use password '1234'. Invite code is also '1234'.
-- The auth API must use the same scheme (salt 'kids-dev', algo SHA-256) or
-- this seed will not log in.
--
-- This file is intentionally idempotent on question content (fixed ids) but
-- will fail re-running on UNIQUE constraints unless the DB is reset first.
-- Typical flow:
--   wrangler d1 execute kids-quiz-db --local --file=.cloudflare/schema.sql
--   wrangler d1 execute kids-quiz-db --local --file=.cloudflare/dev_seed.sql

-- ========== 1 teacher ==========
-- password '1234' → sha256('kids-dev:1234')
INSERT INTO teachers (id, email, password_hash, name) VALUES
  (1, 'teacher@test.com',
   '3f19c1c3adb0f97ed06b9411dcfb1ff8eaecbcc259d5b7657b952a12e5bd842b',
   '王老師');

-- ========== 5 students ==========
-- All passwords '1234' (same hash).
INSERT INTO students (id, username, display_name, password_hash, daily_goal, created_by_teacher_id) VALUES
  (1, 'ming',     '小明',   '3f19c1c3adb0f97ed06b9411dcfb1ff8eaecbcc259d5b7657b952a12e5bd842b', 30, 1),
  (2, 'wang',     '王小明', '3f19c1c3adb0f97ed06b9411dcfb1ff8eaecbcc259d5b7657b952a12e5bd842b', 30, 1),
  (3, 'chen',     '陳美惠', '3f19c1c3adb0f97ed06b9411dcfb1ff8eaecbcc259d5b7657b952a12e5bd842b', 30, 1),
  (4, 'lin',      '林宜靜', '3f19c1c3adb0f97ed06b9411dcfb1ff8eaecbcc259d5b7657b952a12e5bd842b', 30, 1),
  (5, 'zhang',    '張志豪', '3f19c1c3adb0f97ed06b9411dcfb1ff8eaecbcc259d5b7657b952a12e5bd842b', 30, 1);

-- ========== 1 class ==========
-- Invite code is '1234' per Roger's dev request. Production API should
-- generate 8+ char random codes (e.g. KID-XXXXX).
INSERT INTO classes (id, teacher_id, name, subject, grade, invite_code) VALUES
  (1, 1, '四年三班', NULL, 4, '1234');

-- ========== class roster ==========
INSERT INTO class_students (class_id, student_id) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4), (1, 5);

-- ========== 5 questions across 3 subjects ==========
-- Q1: Chinese (from handoff QUIZ, full zhuyin ruby)
INSERT INTO questions (
  id, owner_teacher_id, subject, grade, unit, difficulty,
  question, zhuyin,
  option_a, option_b, option_c, option_d, answer, explanation, used_count
) VALUES (
  1, 1, 'chinese', 3, '字詞辨識', 2,
  '下列哪個詞語的用法最恰當？「他的字跡＿＿，老師看不懂。」',
  '[{"c":"下","zy":"ㄒㄧㄚˋ"},{"c":"列","zy":"ㄌㄧㄝˋ"},{"c":"哪","zy":"ㄋㄚˇ"},{"c":"個","zy":"˙ㄍㄜ"},{"c":"詞","zy":"ㄘˊ"},{"c":"語","zy":"ㄩˇ"},{"c":"的","zy":"˙ㄉㄜ"},{"c":"用","zy":"ㄩㄥˋ"},{"c":"法","zy":"ㄈㄚˇ"},{"c":"最","zy":"ㄗㄨㄟˋ"},{"c":"恰","zy":"ㄑㄧㄚˋ"},{"c":"當","zy":"ㄉㄤˋ"},{"c":"？","zy":""}]',
  '潦草', '詳細', '工整', '漂亮', 'A',
  '「潦草」形容字跡或做事不工整、不仔細，常用於「字跡潦草」。',
  142
);

-- Q2: Math (low grade, easy)
INSERT INTO questions (
  id, owner_teacher_id, subject, grade, unit, difficulty,
  question, zhuyin,
  option_a, option_b, option_c, option_d, answer, explanation, used_count
) VALUES (
  2, 1, 'math', 2, '乘法', 1,
  '7 × 8 = ？', NULL,
  '54', '56', '58', '60', 'B',
  '7 × 8 = 56。可以用 7 × 8 = 7 × 10 − 7 × 2 = 70 − 14 = 56 來驗算。',
  305
);

-- Q3: Math (fractions, medium)
INSERT INTO questions (
  id, owner_teacher_id, subject, grade, unit, difficulty,
  question, zhuyin,
  option_a, option_b, option_c, option_d, answer, explanation, used_count
) VALUES (
  3, 1, 'math', 4, '分數加減', 3,
  '小美吃了一個披薩的 1/4，小華吃了 2/8，兩人合計吃了幾分之幾？', NULL,
  '1/4', '1/2', '3/8', '1/3', 'B',
  '2/8 可以化簡為 1/4。1/4 + 1/4 = 2/4 = 1/2。',
  98
);

-- Q4: English (colors, easy)
INSERT INTO questions (
  id, owner_teacher_id, subject, grade, unit, difficulty,
  question, zhuyin,
  option_a, option_b, option_c, option_d, answer, explanation, used_count
) VALUES (
  4, 1, 'english', 2, 'Colors', 1,
  'The sky is _____ on a sunny day.', NULL,
  'red', 'blue', 'green', 'yellow', 'B',
  'On a clear sunny day the sky looks blue because of how sunlight scatters in the air.',
  215
);

-- Q5: English (past tense)
INSERT INTO questions (
  id, owner_teacher_id, subject, grade, unit, difficulty,
  question, zhuyin,
  option_a, option_b, option_c, option_d, answer, explanation, used_count
) VALUES (
  5, 1, 'english', 4, 'Tenses', 2,
  'Yesterday, I _____ to the park with my dog.', NULL,
  'go', 'goes', 'went', 'going', 'C',
  'Yesterday 是過去時間標記，動詞要用過去式。Go 的過去式是 went。',
  122
);

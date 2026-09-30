-- Data-only: the quiz prompt now bans questions that refer to "the notes". Clear every banked
-- question written under the old prompt and reset the refresh throttle so pages get a fresh bank
-- on their next save or quiz.
DELETE FROM "bank_questions";

UPDATE "pages" SET "bankAttemptAt" = NULL;

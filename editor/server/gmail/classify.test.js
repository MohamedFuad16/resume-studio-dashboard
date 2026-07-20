// Classifier regression suite — `npm run test:classify`.
//
// Every fixture is a REAL message from the owner's inbox, reduced to the text
// that carries the decision (names, application ids, portal credentials and
// signature blocks removed). They are here because on 2026-07-20 the classifier
// could not read Japanese rejections: two of them never reached the tracker at
// all, one was queued as an interview, and one produced a phantom interview
// beside a correct rejection. The owner had no interviews anywhere.
//
// These tests exercise the DETERMINISTIC layer only — resolveKind and
// internshipEvidenceHolds — so they need no API key, no network and no model.
// That is the point: the prompt can drift, the model can be swapped, and a
// verified Japanese rejection phrase still cannot be read as anything else.
//
// Deliberately no company names in the code under test. The fixtures name
// companies because a test needs real text; classify.js matches only on phrases
// of the language, which is what makes these cases generalise to the next
// Japanese ATS the owner applies through.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveKind, internshipEvidenceHolds, isBulkMail } from './classify.js';
import { admitsCarriedDecision, provesInternshipApplication, companyKey } from './sync.js';

// ── The four defects of 2026-07-20 ──────────────────────────────────────────

// msg 19f634af8733f4c8 — NOT QUEUED AT ALL, so the tracker stayed at "applied".
// The rejection is stated only as 「貴意に添いかねる」 and the mail contains no
// internship word anywhere (see the "internship evidence" block below).
const ABEJA_REJECTION = {
  subject: '【株式会社ABEJA】選考結果のご連絡',
  body: [
    'お世話になっております。',
    '株式会社ABEJA HRチームです。',
    'この度は、数ある企業の中から弊社へご応募いただき誠にありがとうございました。',
    '厳正なる選考の結果、誠に残念ながら今回は貴意に添いかねることとなりました。',
    '弊社の力が及ばず、このようなご連絡となり大変申し訳ございません。',
  ].join('\n'),
};

// msg 19f630feccdc3a48 — NOT QUEUED AT ALL. Note the subject: 「ご応募のお礼」
// reads as "thank you for applying". The rejection exists ONLY in the body.
const AICE_REJECTION = {
  subject: 'ご応募のお礼【AICE株式会社】',
  body: [
    'お世話になっております。',
    'AICE株式会社 採用担当でございます。',
    'この度は弊社にご興味をお持ちいただき誠にありがとうございました。',
    'いただいた書類内容をもとに選考を進めさせて頂きましたが、',
    '残念ながらご希望に沿えない結果となりました。',
    '限られた採用枠に対して多数のご応募を頂いており、慎重に選考を進め、判断させていただいた結果でございます。',
  ].join('\n'),
};

// msg 19f367356e0548e1 — classified as INTERVIEW. It is a rejection. The mail
// states no outcome at all: the verdict lives on a candidate portal. What it
// does say is 「選考結果」 in the subject — a decision, and not an invitation.
const SKY_DECISION = {
  subject: '＜選考結果のご連絡＞5daysインターンシップ/3daysワークショップ【Ｓｋｙ株式会社】',
  body: [
    'Ｓｋｙ株式会社　管理本部　人財部　リクルーティング課です。',
    '＜5daysインターンシップ/3daysワークショップ＞にご応募いただきありがとうございました。',
    '選考結果につきまして、マイページに記載しております。',
    'ログインいただき、ご確認ください。',
  ].join('\n'),
};

// msg 19f5e93574e7d36c — correctly rejected. Kept as a regression guard: the
// English path must not change.
const HENNGE_REJECTION = {
  subject: "HENNGE's Admission Challenge - Your Application Results",
  body: [
    "Thank you for your interest in HENNGE's Global Internship Program, and we appreciate the time and effort you put into your application.",
    'We have carefully reviewed your code and the documents you submitted. While we were impressed with your background and experience, the selection process is highly competitive.',
    'Unfortunately, we have decided to move forward with another candidate that better fits our requirements at the moment.',
    'However, we sincerely appreciate your application and encourage you to re-apply in the future. We recommend waiting at least 9-12 months before re-applying.',
  ].join('\n'),
};

// …and the source of the PHANTOM interview beside it. The admission challenge
// IS the application here — "Thank you for applying… Please proceed to the
// coding test" — but the prompt reads any coding test as a step past "applied".
const HENNGE_CHALLENGE_INVITE = {
  subject: 'HENNGE - Get your Admission Challenge URL here!',
  body: [
    'Konnichiwa! Thank you for applying to HENNGE.',
    "We're excited about the possibility of you joining our team!",
    'Please proceed to the coding test by registering from the link below.',
  ].join('\n'),
};

// ── The falsifier: a genuine interview invitation ───────────────────────────
//
// msg 19f3618f282ec812. Critically, its BODY says 「書類選考の結果」 — a rule that
// read 選考の結果 anywhere as a rejection would destroy this, which is why the
// decision-notice test reads the SUBJECT only.
const ENECHAIN_INTERVIEW_INVITE = {
  subject: 'アンケート回答いただきありがとうございます【enechain】',
  body: [
    'お世話になっております。enechainの大田です。',
    'アンケートについて、ご返信いただきありがとうございます。',
    '書類選考の結果、ぜひ面接にてお話の機会をいただければと思い、ご連絡いたしました。',
    'エンジニアの大坪とお話させていただきたく、日程候補をいくつか教えていただけますでしょうか？',
    'オンラインで60分を想定しております。',
  ].join('\n'),
};

// The same acknowledgement-subject / rejection-body shape as AICE, from a
// different ATS — proof the rule is about the language and not one sender.
const CANARY_REJECTION = {
  subject: '【株式会社カナリー 採用チーム】ご応募ありがとうございます',
  body: [
    '株式会社カナリー 採用チームでございます。',
    'この度は数ある求人の中からご応募いただき、誠にありがとうございます。',
    '慎重に選考を進めた結果、誠に残念ながら、今回は貴意に添いかねる結果となりました。',
  ].join('\n'),
};

// A real application confirmation — must stay "applied", not be dragged anywhere.
const ABEJA_CONFIRMATION = {
  subject: '＜新卒通年インターン＞ソフトウェアエンジニア（プラットフォーム領域）への応募が完了しました',
  body: '「＜新卒通年インターン＞ソフトウェアエンジニア（プラットフォーム領域）（株式会社ABEJA）」へご応募いただきありがとうございました。応募情報の控えをお送りいたします。',
};

const resolve = (fixture, kind, hasInterviewDate = false) =>
  resolveKind({ kind, subject: fixture.subject, body: fixture.body, hasInterviewDate });

// ── Japanese rejections are recognised whatever the model said ──────────────

test('ABEJA — 貴意に添いかね is a rejection even if the model says other', () => {
  const out = resolve(ABEJA_REJECTION, 'other');
  assert.equal(out.kind, 'rejected');
  assert.equal(out.rule, 'rejection-phrase');
  assert.ok(out.evidence.includes('貴意に添いかね'));
});

test('AICE — an acknowledgement SUBJECT still classifies from its BODY', () => {
  // The whole point: 「ご応募のお礼」 says "thank you for applying". Reading the
  // subject alone gives "applied" and freezes the tracker there forever.
  const out = resolve(AICE_REJECTION, 'applied');
  assert.equal(out.kind, 'rejected');
  assert.equal(out.rule, 'rejection-phrase');
  assert.ok(out.evidence.includes('ご希望に沿えない'));
});

test('カナリー — the same shape from a different ATS', () => {
  assert.equal(resolve(CANARY_REJECTION, 'applied').kind, 'rejected');
});

test('Sky — 選考結果 in a subject is a decision, never an interview invitation', () => {
  const out = resolve(SKY_DECISION, 'interview');
  assert.equal(out.kind, 'rejected');
  assert.equal(out.rule, 'decision-notice');
  assert.ok(out.evidence.includes('選考結果'));
});

test('every indirect Japanese rejection form is read as a rejection', () => {
  // The register, not the vocabulary — none of these says "reject".
  for (const phrase of [
    '今回は貴意に添いかねることとなりました',
    '残念ながらご希望に沿えない結果となりました',
    '誠に残念ながら今回は見送らせていただきます',
    'ご期待に添えない結果となりました',
    '今回のインターンへの参加は見送らせていただくことになりました',
    '選考の結果、不合格となりました',
    '今回はご縁がなかったという結果になりました',
  ]) {
    const out = resolveKind({ kind: 'other', subject: 'ご連絡', body: phrase });
    assert.equal(out.kind, 'rejected', `not read as a rejection: ${phrase}`);
  }
});

// ── The phantom interview ───────────────────────────────────────────────────

test('HENNGE — the rejection stays a rejection (English path unchanged)', () => {
  const out = resolve(HENNGE_REJECTION, 'rejected');
  assert.equal(out.kind, 'rejected');
});

test('HENNGE — a coding test framed as part of APPLYING is not an interview', () => {
  // This is where the phantom interview came from.
  const out = resolve(HENNGE_CHALLENGE_INVITE, 'interview');
  assert.equal(out.kind, 'applied');
  assert.equal(out.rule, 'interview-unsupported');
});

test('an assessment that is actually INVITED still counts as a step past applied', () => {
  // Demoting a coding test must not cost us real assessment invitations.
  const out = resolveKind({
    kind: 'interview',
    subject: 'Your Codility test',
    body: 'We would like to invite you to complete an online assessment.',
  });
  assert.equal(out.kind, 'interview');
});

test('an interview with an extracted date survives without invitation wording', () => {
  const out = resolveKind({ kind: 'interview', subject: 'Next steps', body: 'See the attached details.', hasInterviewDate: true });
  assert.equal(out.kind, 'interview');
});

// ── The falsifier ───────────────────────────────────────────────────────────

test('enechain — a genuine JA interview invitation is NOT flipped to rejected', () => {
  // Its body says 「書類選考の結果」. If this ever returns "rejected", the
  // decision-notice rule has started reading bodies and must be reverted.
  const out = resolve(ENECHAIN_INTERVIEW_INVITE, 'interview');
  assert.equal(out.kind, 'interview');
  assert.equal(out.rule, 'model');
});

test('an application confirmation stays applied', () => {
  assert.equal(resolve(ABEJA_CONFIRMATION, 'applied').kind, 'applied');
});

test('an offer is never demoted or rejected', () => {
  const out = resolveKind({ kind: 'offer', subject: '選考結果のご連絡', body: '内定のご連絡です。' });
  assert.equal(out.kind, 'offer');
});

// ── Internship detection is NOT weakened ────────────────────────────────────

test('the internship evidence gate is unchanged and still strict', () => {
  // Unquoted, invented, or non-internship "evidence" is still rejected.
  assert.equal(internshipEvidenceHolds('', 'summer internship 2026'), false);
  assert.equal(internshipEvidenceHolds('Summer Internship 2026', 'we are hiring a contractor'), false);
  assert.equal(internshipEvidenceHolds('AI trainer', 'we need an AI trainer'), false);
  // A real quote that really names an internship still holds, punctuation and all.
  assert.equal(internshipEvidenceHolds('Summer Internship 2026.', 'Apply for our Summer Internship 2026 today'), true);
  assert.equal(internshipEvidenceHolds('「インターンシップ選考」', 'インターンシップ選考のご案内'), true);
});

test('the JA rejections that were dropped genuinely carry no internship evidence', () => {
  // This is WHY they were never queued — not a register problem but the
  // evidence gate, which is why sync.js admits a decision on the prior tracked
  // application instead of loosening the gate. If this ever starts passing, the
  // sync.js carry-forward is no longer load-bearing for these messages.
  for (const fixture of [ABEJA_REJECTION, AICE_REJECTION]) {
    const haystack = `${fixture.subject} ${fixture.body}`;
    for (const attempt of ['インターン', '新卒', 'internship', fixture.subject]) {
      assert.equal(internshipEvidenceHolds(attempt, haystack), false);
    }
  }
  // …whereas each one's application confirmation does carry it, which is what
  // put the record in the tracker in the first place.
  assert.equal(
    internshipEvidenceHolds('新卒通年インターン', `${ABEJA_CONFIRMATION.subject} ${ABEJA_CONFIRMATION.body}`),
    true,
  );
});

// ── The carry-forward: a decision admitted on a PRIOR application ───────────
//
// The gate that ABEJA and AICE actually failed. Their rejections are correctly
// read as rejections (above) and still carry no internship evidence (above), so
// something else has to admit them — or the tracker stays frozen at "applied".
//
// That something is the server's OWN memory: the set of companies for which
// this profile has already had an internship `applied`/`offer` queued, stored
// on the connection record beside processedMessageIds. It is never a read of
// the owner's tracker — that lives in client-direct Firestore and the server
// holds no user data (CLAUDE.md rule 4). The previous implementation read a
// `tracker:{profile}` KV key that is always empty in production, which is why
// carriedInternship was 0 on every live run.

// The verdicts the classifier produces for the two mails, reduced to the fields
// the gate reads. `isInternship` is post-quote-check: false on both rejections
// (proved by the evidence test above), true on the confirmation.
const APPLIED_VERDICT = { kind: 'applied', company: '株式会社ABEJA', isInternship: true };
const REJECTION_VERDICT = { kind: 'rejected', company: '株式会社ABEJA', isInternship: false };

test('a decision with no internship evidence is admitted after a prior application', () => {
  const seen = new Set();
  // Cold: nothing has ever been applied to. The rejection must still drop.
  assert.equal(admitsCarriedDecision(REJECTION_VERDICT, seen), false);

  // The application confirmation goes through — it carries real, quoted
  // internship evidence — and the server remembers the company.
  assert.equal(provesInternshipApplication(APPLIED_VERDICT), true);
  seen.add(companyKey(APPLIED_VERDICT.company));

  // Now the very same rejection is admitted, on the earlier mail's evidence.
  assert.equal(admitsCarriedDecision(REJECTION_VERDICT, seen), true);
});

test('a company never seen applying to an internship is still dropped', () => {
  // The gig rejections the evidence gate exists to refuse. Nothing about the
  // carry-forward may let these in.
  const seen = new Set([companyKey('AICE株式会社')]);
  for (const company of ['micro1', 'Turing', '5CA']) {
    assert.equal(admitsCarriedDecision({ kind: 'rejected', company, isInternship: false }, seen), false);
  }
});

test('the carry-forward matches EXACT keys, never substrings', () => {
  // SPEC-per-role-keying §4. A substring test would admit a rejection from
  // "AICE Robotics" (or from "AI") on the strength of an AICE application.
  const seen = new Set([companyKey('AICE株式会社')]);
  assert.equal(admitsCarriedDecision({ kind: 'rejected', company: 'AICE', isInternship: false }, seen), true);
  for (const impostor of ['AICE Robotics', 'AI', 'AICE Holdings', 'MyAICE']) {
    assert.equal(
      admitsCarriedDecision({ kind: 'rejected', company: impostor, isInternship: false }, seen),
      false,
      `admitted on a substring match: ${impostor}`,
    );
  }
});

test('corporate-suffix forms of one company share a key', () => {
  // 株式会社enechain and enechain are the SAME company and must not produce two
  // records — nor two entries in the remembered set.
  assert.equal(companyKey('株式会社enechain'), companyKey('enechain'));
  assert.equal(companyKey('株式会社カナリー'), companyKey('カナリー'));
  // …and a purely-Japanese name must never normalize to '' (an empty key would
  // match everything, or nothing, depending on the caller).
  assert.notEqual(companyKey('株式会社カナリー'), '');
});

test('only a proven internship application teaches the set', () => {
  // The set can never be self-fulfilling: a decision admitted BY the gate has
  // isInternship=false and so adds nothing back.
  assert.equal(provesInternshipApplication(REJECTION_VERDICT), false);
  assert.equal(provesInternshipApplication({ kind: 'applied', company: 'X', isInternship: false }), false);
  assert.equal(provesInternshipApplication({ kind: 'interview', company: 'X', isInternship: true }), false);
  assert.equal(provesInternshipApplication({ kind: 'applied', company: '', isInternship: true }), false);
  assert.equal(provesInternshipApplication({ kind: 'offer', company: 'X', isInternship: true }), true);
});

test('an application admits a rejection processed later in the SAME run', () => {
  // The fresh-backfill case: no persisted set at all, both mails in one scan.
  // sync.js processes oldest-first so the confirmation is seen first; this is
  // that sequence, and it is the reason ABEJA/AICE recover on a 90-day backfill.
  const seen = new Set(); // nothing persisted
  const run = [APPLIED_VERDICT, REJECTION_VERDICT]; // oldest → newest
  const admitted = [];
  for (const verdict of run) {
    if (verdict.isInternship || admitsCarriedDecision(verdict, seen)) {
      admitted.push(verdict.kind);
      if (provesInternshipApplication(verdict)) seen.add(companyKey(verdict.company));
    }
  }
  assert.deepEqual(admitted, ['applied', 'rejected']);

  // …and reversed (newest-first, the order Gmail returns) it does NOT work —
  // which is what makes the .reverse() in sync.js load-bearing rather than
  // cosmetic. If this ever passes, the ordering guarantee has been lost.
  const seenReversed = new Set();
  assert.equal(admitsCarriedDecision(REJECTION_VERDICT, seenReversed), false);
});

// ── The bulk-mail guard is untouched ────────────────────────────────────────

test('bulk mail is still refused before the classifier', () => {
  assert.equal(isBulkMail({ bulk: { listUnsubscribe: '<mailto:x@y.z>' } }), true);
  assert.equal(isBulkMail({ bulk: { precedence: 'bulk' } }), true);
  assert.equal(isBulkMail({ bulk: {} }), false);
});

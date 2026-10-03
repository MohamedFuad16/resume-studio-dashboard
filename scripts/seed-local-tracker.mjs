// Seeds the LOCAL no-auth tracker (profile mohamed_fuad) with sample
// applications for checking the UI: internships, new-grad and full-time roles,
// Gmail rows from two inboxes, a rejection with a reapply cooldown, an interview
// milestone and a dated deadline. It writes only to the local Express server's
// SQLite store (localhost:5005), never to Firestore or production.
//
// Usage: start the app in no-auth mode (.claude/launch.json "portal-dev-noauth",
// or VITE_AUTH_DISABLED=true npm --prefix editor run dev), then:
//   node scripts/seed-local-tracker.mjs
const day = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d; };
const iso = n => day(n).toISOString();
const ymd = n => day(n).toISOString().slice(0, 10);
const A = 'first.inbox@example.com';
const B = 'second.inbox@example.com';
const rec = (id, fields) => [id, { internshipId: id, milestones: [], deadline: 'Not stated', source: 'web', createdAt: iso(-10), updatedAt: iso(-1), ...fields }];

const tracker = Object.fromEntries([
  rec('hennge-global-internship-frontend', { company: 'HENNGE', role: 'Global Internship Program Front-End Pathway', location: 'Shibuya, Tokyo, Japan', deadline: 'No official deadline', applyUrl: 'https://hennge.com/global/careers/', status: 'interview', statusPinned: true, appliedAt: iso(-9), interviewAt: iso(-3), updatedAt: iso(-3), milestones: [{ id: 'm1', kind: 'interview', date: ymd(4), time: '14:00', timeZone: 'Asia/Tokyo', title: 'Interview — HENNGE', createdAt: iso(-3) }] }),
  rec('gmail-mercari-swe-intern', { company: 'Mercari', role: 'Software Engineer Intern (Backend)', location: 'Roppongi, Tokyo', applyUrl: 'https://careers.mercari.com/', status: 'rejected', source: 'gmail', appliedAt: iso(-12), rejectedAt: iso(-6), updatedAt: iso(-6), reapplyAfter: ymd(150), reapplyNote: 'Mercari asks applicants to wait 6 months before reapplying.', sourceMeta: { mailbox: A, subject: 'Result of your internship application', receivedAt: iso(-6) } }),
  rec('gmail-sansan-application', { company: 'Sansan株式会社', role: 'Application', location: '', applyUrl: '', status: 'applied', source: 'gmail', appliedAt: iso(-2), updatedAt: iso(-2), sourceMeta: { mailbox: B, subject: 'ご応募ありがとうございます', receivedAt: iso(-2) } }),
  rec('gmail-cyberagent-27', { company: 'CyberAgent', role: 'Engineer', location: 'Shibuya, Tokyo', applyUrl: 'https://www.cyberagent.co.jp/careers/', status: 'applied', source: 'gmail', appliedAt: iso(-4), updatedAt: iso(-4), sourceMeta: { mailbox: B, subject: '【27卒】エンジニア職 エントリー受付のお知らせ', receivedAt: iso(-4) } }),
  rec('gmail-moneyforward-newgrad', { company: 'Money Forward', role: 'Software Engineer, New Grad 2027', location: 'Tamachi, Tokyo', applyUrl: 'https://hrmos.co/pages/moneyforward/jobs', status: 'interview', source: 'gmail', appliedAt: iso(-11), interviewAt: iso(-1), updatedAt: iso(-1), sourceMeta: { mailbox: A, subject: 'Interview invitation', receivedAt: iso(-1) } }),
  rec('smartnews-backend-ft', { company: 'SmartNews', role: 'Backend Engineer', location: 'Shibuya, Tokyo', applyUrl: 'https://careers.smartnews.com/', status: 'saved', createdAt: iso(-1), updatedAt: iso(-1) }),
  rec('rakuten-tech-camp', { company: 'Rakuten Group', role: 'TECH Camp - Applications Engineering', location: 'Rakuten Crimson House, Tokyo', deadline: ymd(10), deadlineDate: ymd(10), applyUrl: 'https://rakuten.careers/', status: 'saved', createdAt: iso(0), updatedAt: iso(0) }),
  rec('mercari-software-engineer-2028', { company: 'Mercari Group', role: 'Class of 2028 Software Engineer Internship', location: 'Roppongi, Tokyo / remote within Japan', applyUrl: 'https://apply.workable.com/mercari/j/EC5A1078C4/', status: 'applying', createdAt: iso(-1), updatedAt: iso(-1) }),
]);

const response = await fetch('http://localhost:5005/api/tracker?profile=mohamed_fuad', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(tracker),
});
console.log(response.status, await response.text());

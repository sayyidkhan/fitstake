import type { ReactNode } from "react";

// Details only the operator can confirm. Replace every bracketed placeholder before launch.
export const LEGAL = {
  operator: "FitStake",
  legalEntity: "[operator legal name]",
  uen: "[UEN]",
  address: "[registered business address, Singapore]",
  dpoEmail: "[privacy email]",
  lastUpdated: "9 October 2026",
  complaintsUrl: "https://www.pdpc.gov.sg",
};

const Ph = ({ children }: { children: ReactNode }) => (
  <span className="legal-placeholder">{children}</span>
);

type Section = { id: string; title: string; body: ReactNode };
type Doc = { title: string; intro: ReactNode; sections: Section[] };

const PRIVACY: Doc = {
  title: "Privacy Policy",
  intro: (
    <>
      This is our Data Protection Notice under Singapore’s Personal Data Protection Act 2012
      (PDPA). It explains what personal data {LEGAL.operator} collects through FitStake, why, who
      we share it with, and what you can do about it. Please read it together with our{" "}
      <a href="#terms">Terms</a> and <a href="#data-policy">Data Policy</a>.
    </>
  ),
  sections: [
    {
      id: "who",
      title: "1. Who we are",
      body: (
        <>
          <p>
            FitStake is operated by <Ph>{LEGAL.legalEntity}</Ph>, a company in Singapore (UEN{" "}
            <Ph>{LEGAL.uen}</Ph>, address <Ph>{LEGAL.address}</Ph>). In this notice, “we”, “us” and
            “our” mean {LEGAL.operator}.
          </p>
          <p>
            Our Data Protection Officer (DPO) handles privacy questions and requests. Contact:{" "}
            <Ph>{LEGAL.dpoEmail}</Ph>.
          </p>
        </>
      ),
    },
    {
      id: "collect",
      title: "2. Personal data we collect",
      body: (
        <ul>
          <li>
            <strong>Account details:</strong> your name and email address, which you give when you
            create or join a challenge.
          </li>
          <li>
            <strong>Challenge data:</strong> the challenge name, invite code, start and settlement
            dates, your reward choices, daily activity entries and leaderboard scores. In the current
            proof of concept, activity entries are simulated, not taken from your devices.
          </li>
          <li>
            <strong>Payment set-up data:</strong> your payment-provider enrolment reference, the
            spending ceiling you set, approval status and transaction records (amount, status and
            provider reference). We never receive or store your card number.
          </li>
          <li>
            <strong>Preferences you type:</strong> any free text you enter to get reward suggestions.
            Please do not include health or medical information here.
          </li>
          <li>
            <strong>Technical data:</strong> IP address and request logs held by our hosting provider,
            and a small entry in your browser’s local storage that keeps your challenge open on that
            device. We do not use advertising or analytics cookies.
          </li>
        </ul>
      ),
    },
    {
      id: "purposes",
      title: "3. Why we collect and use it, and consent",
      body: (
        <>
          <p>We collect, use and disclose your personal data only for these purposes:</p>
          <ul>
            <li>creating, running and scoring your challenge, and showing results to the other participant;</li>
            <li>locking your reward choices and setting up, approving and recording reward purchases;</li>
            <li>suggesting rewards from our catalogue using the preferences you enter;</li>
            <li>keeping the service secure, preventing fraud and misuse, and meeting legal and accounting duties;</li>
            <li>responding to your questions, requests and complaints.</li>
          </ul>
          <p>
            We ask for your consent before we collect, use or disclose your personal data for these
            purposes. You give consent when you tick the box to accept these terms and notices, and
            when you approve a payment set-up step. Where the PDPA allows us to act without consent
            (for example, to investigate fraud or respond to a security incident), we may do so.
          </p>
        </>
      ),
    },
    {
      id: "disclosure",
      title: "4. Who we share it with",
      body: (
        <>
          <p>
            Your name, challenge progress, reward choices and results are visible to the other
            participant in your challenge. Your email address is not shown to them.
          </p>
          <p>
            We share personal data with service providers only as needed to run FitStake: our
            payment provider (Reap), our AI provider (OpenAI), our database host (Turso) and our
            hosting provider (Vercel). They act on our instructions. We also disclose data where the
            law requires it. The Data Policy lists each provider and what it receives.
          </p>
        </>
      ),
    },
    {
      id: "transfer",
      title: "5. Transfers outside Singapore",
      body: (
        <p>
          Some of our providers process data outside Singapore, including in Japan and the United
          States. Before we transfer personal data overseas, we take steps to make sure it receives
          a standard of protection comparable to the PDPA, through contractual terms with those
          providers. The Data Policy gives details.
        </p>
      ),
    },
    {
      id: "automated",
      title: "6. Automated suggestions and decisions",
      body: (
        <p>
          AI suggests rewards only, and only from our supported catalogue. The winner and loser are
          decided by fixed, published scoring rules, not by AI. You can see the rules before you join.
        </p>
      ),
    },
    {
      id: "retention",
      title: "7. How long we keep it",
      body: (
        <p>
          We keep personal data only as long as the purpose requires, or as the law requires. The
          retention schedule is in the Data Policy. When we no longer need it, we delete it or
          anonymise it.
        </p>
      ),
    },
    {
      id: "security",
      title: "8. Security and data breaches",
      body: (
        <>
          <p>
            We protect personal data with reasonable security arrangements, including encryption in
            transit, server-side secrets, limited staff access and no storage of card data. No system
            is completely secure, so we cannot guarantee absolute security.
          </p>
          <p>
            If a data breach affects personal data in our control, we will assess it promptly. If it
            is notifiable under the PDPA, we will notify the Personal Data Protection Commission (PDPC)
            within 3 calendar days of our assessment, and notify affected individuals as soon as
            practicable where it is likely to cause significant harm.
          </p>
        </>
      ),
    },
    {
      id: "rights",
      title: "9. Your rights",
      body: (
        <>
          <p>Under the PDPA, you can:</p>
          <ul>
            <li>
              <strong>ask for access</strong> to your personal data and how we have used or disclosed
              it in the past year;
            </li>
            <li>
              <strong>ask us to correct</strong> an error or omission in your personal data;
            </li>
            <li>
              <strong>withdraw consent</strong> at any time. We will tell you the likely consequences.
              Withdrawing may mean we can no longer run your challenge, and we may then end your
              participation;
            </li>
            <li>
              <strong>ask us to delete</strong> your personal data, unless we must keep it for a legal,
              accounting or dispute-resolution reason.
            </li>
          </ul>
          <p>
            Send requests to <Ph>{LEGAL.dpoEmail}</Ph>. We may ask you to verify your identity first.
            We will respond as soon as reasonably possible and within 30 days. If we need longer, we
            will tell you why and by when. We may charge a reasonable fee for access requests, and we
            will tell you the amount before we process the request.
          </p>
        </>
      ),
    },
    {
      id: "marketing",
      title: "10. Marketing messages",
      body: (
        <p>
          We do not send marketing messages today. If we start, we will ask for your separate opt-in
          consent, include a way to unsubscribe, and comply with the Spam Control Act 2007 and the
          Do Not Call Registry where they apply.
        </p>
      ),
    },
    {
      id: "age",
      title: "11. Age limit",
      body: (
        <p>
          FitStake is for adults aged 21 and over. Do not create or join a challenge if you are
          younger. If we learn that we hold data about someone under 21, we will delete it.
        </p>
      ),
    },
    {
      id: "complaints",
      title: "12. Questions and complaints",
      body: (
        <p>
          Contact our DPO first, and we will work to resolve your concern. You can also complain to
          the Personal Data Protection Commission at{" "}
          <a href={LEGAL.complaintsUrl} target="_blank" rel="noopener noreferrer">
            pdpc.gov.sg
          </a>
          .
        </p>
      ),
    },
    {
      id: "changes",
      title: "13. Changes to this notice",
      body: (
        <p>
          We may update this notice. We will change the “last updated” date and, for material changes,
          tell you before they take effect. Where the change needs your consent, we will ask for it.
        </p>
      ),
    },
  ],
};

const TERMS: Doc = {
  title: "Terms & Conditions",
  intro: (
    <>
      These Terms form a contract between you and {LEGAL.operator} for your use of FitStake. By
      creating or joining a challenge, you accept them. Please read the{" "}
      <a href="#privacy">Privacy Policy</a> and <a href="#data-policy">Data Policy</a> too.
    </>
  ),
  sections: [
    {
      id: "status",
      title: "1. What FitStake is right now",
      body: (
        <>
          <p>
            FitStake is currently a proof of concept. Fitness activity is simulated, and reward
            purchases run in the payment provider’s sandbox. No real money is charged, and nothing is
            delivered.
          </p>
          <p>
            Before we enable real-money purchases or real fitness data, we will update these Terms,
            confirm that the challenge and reward arrangements comply with Singapore law (including
            gambling, lottery and payment services law), and notify you.
          </p>
        </>
      ),
    },
    {
      id: "eligibility",
      title: "2. Who can use FitStake",
      body: (
        <p>
          You must be at least 21 years old and able to enter a binding contract. You must give
          accurate information, keep your invite code private, and tell us if your details change.
        </p>
      ),
    },
    {
      id: "challenges",
      title: "3. Challenges",
      body: (
        <>
          <p>
            A challenge is a 1-versus-1 contest between two people over a fixed number of days, from
            1 to 365. The creator sets the name and length. Anyone with the invite code can join, up to
            two participants.
          </p>
          <p>
            Rewards are locked once chosen. Once a challenge is active, it can end early only if both
            participants agree in writing, or as set out in section 9.
          </p>
        </>
      ),
    },
    {
      id: "scoring",
      title: "4. Scoring rules",
      body: (
        <p>
          Points are awarded under the scoring rules shown before you join: active minutes per day
          (capped at 90), plus a bonus for each day with at least 30 active minutes. Ties go to more
          active days, then more steps, then a fixed tie-break. We may correct a scoring error, and
          we will tell participants if we do. Scores are not medical measurements and carry no weight-loss
          targets.
        </p>
      ),
    },
    {
      id: "rewards",
      title: "5. Rewards and purchases",
      body: (
        <>
          <p>
            Each participant locks one lower-value reward and one higher-value reward from our
            supported catalogue. On settlement, the loser buys the winner’s higher-value reward, and the
            winner buys the loser’s lower-value reward, each through the payment provider.
          </p>
          <p>
            FitStake does not hold or escrow money. Each charge is approved by you on the payment
            provider’s page, and only up to the spending ceiling you set. If a quote exceeds your
            ceiling, the purchase stops and nothing is charged.
          </p>
          <p>
            Reward products are sold by the merchant. Returns and refunds follow the merchant’s policy
            and your rights under Singapore law, including the Consumer Protection (Fair Trading) Act
            2003. Contact us if a purchase fails or is charged incorrectly.
          </p>
          <p>
            We may replace a reward only with your agreement, or if it becomes unavailable, and then
            only with an item of equal or lower value.
          </p>
        </>
      ),
    },
    {
      id: "payments",
      title: "6. Payment provider",
      body: (
        <p>
          Card enrolment and payments are provided by Reap. Your use of Reap is also subject to
          Reap’s terms and privacy notice. We never see your full card details.
        </p>
      ),
    },
    {
      id: "health",
      title: "7. Health and safety",
      body: (
        <>
          <p>
            FitStake is not medical advice. Check with a doctor before you start or change an exercise
            routine, especially if you have a medical condition, are pregnant or take medication. Stop
            exercising and seek help if you feel pain, dizziness or unwell.
          </p>
          <p>
            You take part at your own risk, to the extent the law allows. Activity data in the proof of
            concept is simulated and is not verified.
          </p>
        </>
      ),
    },
    {
      id: "acceptable",
      title: "8. Acceptable use",
      body: (
        <>
          <p>You must not:</p>
          <ul>
            <li>submit false, copied or fabricated activity data, or try to affect the result by other dishonest means;</li>
            <li>create multiple accounts or impersonate someone;</li>
            <li>harass, threaten or abuse another participant;</li>
            <li>attempt to access data or systems that are not yours, or disrupt the service;</li>
            <li>use FitStake for any unlawful purpose, including unlawful gambling.</li>
          </ul>
        </>
      ),
    },
    {
      id: "termination",
      title: "9. Suspension and ending",
      body: (
        <p>
          We may suspend or end your access if you breach these Terms, if we reasonably suspect fraud
          or misuse, or if the law requires it. Where a challenge is affected, we will try to settle
          it fairly, and we will tell participants what happens to their rewards. You may stop using
          FitStake at any time, and you can ask us to delete your data under the Privacy Policy.
        </p>
      ),
    },
    {
      id: "ip",
      title: "10. Our content",
      body: (
        <p>
          FitStake’s software, design, text and branding belong to {LEGAL.operator} or its licensors.
          You may use the service only as these Terms allow.
        </p>
      ),
    },
    {
      id: "liability",
      title: "11. Liability",
      body: (
        <>
          <p>
            To the extent the law allows, we are not liable for indirect or consequential loss, or for
            loss of profit, data or opportunity, arising from your use of FitStake. Our total liability
            to you for any claim is limited to <Ph>S$[amount]</Ph>.
          </p>
          <p>
            Nothing in these Terms limits or excludes liability that cannot be excluded under Singapore
            law. This includes liability for death or personal injury caused by our negligence, for
            fraud, and any rights you have under the Consumer Protection (Fair Trading) Act 2003 or the
            Unfair Contract Terms Act (Cap. 396).
          </p>
        </>
      ),
    },
    {
      id: "availability",
      title: "12. Availability",
      body: (
        <p>
          We work to keep FitStake available, but we do not guarantee uninterrupted or error-free
          service. We may change, pause or discontinue features. If we discontinue a challenge we are
          running, we will settle it fairly and tell participants.
        </p>
      ),
    },
    {
      id: "changes",
      title: "13. Changes to these Terms",
      body: (
        <p>
          We may update these Terms and will show the new “last updated” date. For material changes,
          we will tell you before they take effect. Changes will not alter a challenge already in
          progress unless the law allows, or all participants agree.
        </p>
      ),
    },
    {
      id: "law",
      title: "14. Governing law and disputes",
      body: (
        <p>
          These Terms are governed by the laws of Singapore. The courts of Singapore have jurisdiction
          over disputes, without affecting any rights you have as a consumer under Singapore law. Please
          contact us first to try to resolve any concern.
        </p>
      ),
    },
    {
      id: "contact",
      title: "15. Contact",
      body: (
        <p>
          <Ph>{LEGAL.legalEntity}</Ph>, UEN <Ph>{LEGAL.uen}</Ph>, <Ph>{LEGAL.address}</Ph>. Email{" "}
          <Ph>{LEGAL.dpoEmail}</Ph>.
        </p>
      ),
    },
  ],
};

const DATA: Doc = {
  title: "Data Policy",
  intro: (
    <>
      This Data Policy sets out how {LEGAL.operator} handles personal data in FitStake day to day:
      what we hold, where it is kept, who processes it, how long we keep it, and how we respond to
      incidents. It supports our <a href="#privacy">Privacy Policy</a>.
    </>
  ),
  sections: [
    {
      id: "status",
      title: "1. Current status",
      body: (
        <p>
          FitStake is a proof of concept. Activity data is simulated and reward purchases run in the
          payment provider’s sandbox. This policy sets the standards we apply, and we will review it
          before enabling real-money purchases or real activity data.
        </p>
      ),
    },
    {
      id: "inventory",
      title: "2. What we hold",
      body: (
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Purpose</th>
                <th>Where it is held</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Name, email</td>
                <td>Running your challenge and identifying you to your opponent</td>
                <td>Database (Turso, Tokyo region)</td>
              </tr>
              <tr>
                <td>Challenge, reward choices, activity entries, scores</td>
                <td>Scoring, leaderboard and results</td>
                <td>Database (Turso, Tokyo region)</td>
              </tr>
              <tr>
                <td>Enrolment reference, spending ceiling, approval status</td>
                <td>Setting up and approving reward purchases</td>
                <td>Database (Turso); card data held only by Reap</td>
              </tr>
              <tr>
                <td>Transaction records</td>
                <td>Recording purchases, reconciling and resolving disputes</td>
                <td>Database (Turso)</td>
              </tr>
              <tr>
                <td>Preference text</td>
                <td>Generating reward suggestions</td>
                <td>Sent to OpenAI; not stored by us after the suggestion is returned</td>
              </tr>
              <tr>
                <td>IP address, request logs</td>
                <td>Security, reliability and troubleshooting</td>
                <td>Hosting provider (Vercel)</td>
              </tr>
              <tr>
                <td>Session entry in browser local storage</td>
                <td>Keeping your challenge open on your device</td>
                <td>Your browser</td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: "retention",
      title: "3. Retention schedule",
      body: (
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>How long we keep it</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Name and email</td>
                <td>90 days after your last challenge settles, or on deletion request if sooner</td>
              </tr>
              <tr>
                <td>Challenge, activity, scores and reward choices</td>
                <td>12 months after the challenge settles, then deleted or anonymised</td>
              </tr>
              <tr>
                <td>Enrolment reference and spending ceiling</td>
                <td>Until the challenge settles, then 12 months, then deleted</td>
              </tr>
              <tr>
                <td>Transaction and payment records</td>
                <td>At least 5 years, as business and tax record-keeping requires <Ph>[confirm with accountant]</Ph></td>
              </tr>
              <tr>
                <td>Preference text</td>
                <td>Not stored by us; OpenAI keeps API inputs only as its data policy allows</td>
              </tr>
              <tr>
                <td>Hosting logs</td>
                <td>As set by our hosting provider, normally up to <Ph>[30]</Ph> days</td>
              </tr>
              <tr>
                <td>Browser local storage</td>
                <td>Until you choose “Back to start” or clear your site data</td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: "processors",
      title: "4. Service providers",
      body: (
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>What it receives</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Reap (payment provider)</td>
                <td>Name and email for enrolment, quotes and checkout references. Card details are entered only on Reap’s hosted page.</td>
                <td>Per Reap’s own notice <Ph>[confirm]</Ph></td>
              </tr>
              <tr>
                <td>OpenAI (AI suggestions)</td>
                <td>The reward catalogue and the preference text you enter. Not your name or email.</td>
                <td>United States</td>
              </tr>
              <tr>
                <td>Turso (database)</td>
                <td>All FitStake records listed in section 2</td>
                <td>Japan (AWS Asia Pacific, Tokyo region)</td>
              </tr>
              <tr>
                <td>Vercel (hosting)</td>
                <td>Web and API traffic, including IP addresses and request logs</td>
                <td>May process outside Singapore</td>
              </tr>
            </tbody>
          </table>
        </div>
      ),
    },
    {
      id: "transfers",
      title: "5. Overseas transfers",
      body: (
        <p>
          Because our providers operate outside Singapore, we transfer personal data overseas. We rely on
          contractual commitments from each provider to protect data to a standard comparable with the
          PDPA, and we review these arrangements as our providers change. Please tell us if you need a
          copy of the relevant safeguards.
        </p>
      ),
    },
    {
      id: "ai",
      title: "6. How we use AI",
      body: (
        <>
          <p>
            We use OpenAI’s API to explain and suggest rewards from a fixed catalogue. The AI cannot
            invent products or choose the winner. Do not enter health, medical or other sensitive
            information in the preference box.
          </p>
          <p>
            We send the catalogue and your preference text, not your name or email. OpenAI processes
            API inputs under its own data terms, which we review.
          </p>
        </>
      ),
    },
    {
      id: "security",
      title: "7. Security controls",
      body: (
        <ul>
          <li>HTTPS for all traffic between your browser and FitStake.</li>
          <li>Server-side secrets for database, AI and payment keys. None are shipped to the browser.</li>
          <li>No card numbers are stored or handled by FitStake.</li>
          <li>Access to production data is limited to people who need it for the service.</li>
          <li>Each reward purchase has an idempotency key, so duplicate settlement cannot charge twice.</li>
          <li>
            Other participants see only a name and challenge results, never an email address.
          </li>
        </ul>
      ),
    },
    {
      id: "cookies",
      title: "8. Cookies and local storage",
      body: (
        <p>
          FitStake does not use advertising, tracking or analytics cookies. It stores one entry in your
          browser’s local storage that records your challenge and participant reference, so the page
          reopens on the same device. Anyone who can use that browser can open the challenge, so clear
          it on shared devices with “Back to start”.
        </p>
      ),
    },
    {
      id: "incidents",
      title: "9. Incident response",
      body: (
        <ol>
          <li>Contain the incident and preserve evidence.</li>
          <li>Assess whether it is a notifiable data breach under the PDPA.</li>
          <li>Notify the PDPC within 3 calendar days of assessment, if notifiable.</li>
          <li>Notify affected individuals as soon as practicable where significant harm is likely.</li>
          <li>Record the incident, the response and lessons learned.</li>
        </ol>
      ),
    },
    {
      id: "deletion",
      title: "10. Deletion requests",
      body: (
        <p>
          On a valid deletion request, we delete or anonymise your personal data within the retention
          periods above, unless the law requires us to keep it. If you are in a challenge that is still
          active, deleting your data will end your participation.
        </p>
      ),
    },
    {
      id: "review",
      title: "11. Review",
      body: (
        <p>
          We review this Data Policy at least once a year, and whenever we add a provider, a new type of
          data or a new purpose. Last updated {LEGAL.lastUpdated}.
        </p>
      ),
    },
  ],
};

export const LEGAL_PAGES = {
  privacy: PRIVACY,
  terms: TERMS,
  "data-policy": DATA,
} as const;

export type LegalPageId = keyof typeof LEGAL_PAGES;

export function LegalPage({ id }: { id: LegalPageId }) {
  const doc = LEGAL_PAGES[id];
  return (
    <article className="legal">
      <h1>{doc.title}</h1>
      <p className="legal-updated">Last updated {LEGAL.lastUpdated}</p>
      <div className="legal-intro">{doc.intro}</div>
      <nav className="legal-index" aria-label="Legal documents">
        {(Object.keys(LEGAL_PAGES) as LegalPageId[]).map((key) => (
          <a
            key={key}
            href={`#${key}`}
            aria-current={key === id ? "page" : undefined}
          >
            {LEGAL_PAGES[key].title}
          </a>
        ))}
      </nav>
      {doc.sections.map((s) => (
        <section key={s.id} className="legal-section">
          <h2>{s.title}</h2>
          {s.body}
        </section>
      ))}
      <p className="legal-note">
        Questions? Contact {LEGAL.operator} at <span className="legal-placeholder">{LEGAL.dpoEmail}</span>.
      </p>
    </article>
  );
}

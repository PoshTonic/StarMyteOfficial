import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CSSStarField from "@/components/CSSStarField";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen px-4 py-12">
      <CSSStarField />
      <div className="relative z-10 mx-auto max-w-3xl">
        <h1 className="mb-2 font-display text-3xl font-bold tracking-wider text-primary glow-text">
          PRIVACY POLICY
        </h1>
        <p className="mb-8 text-sm text-muted-foreground font-body">
          Last updated: April 2026
        </p>

        <div className="space-y-6 text-sm text-foreground/90 font-body leading-relaxed">
          <section>
            <h2 className="mb-2 font-display text-lg text-primary">1. Introduction</h2>
            <p>
              This Privacy Policy explains how StarMyte ("we", "us") collects, uses, and
              protects your personal information when you use the Game. By creating an account
              you consent to the practices described below. You can browse the homepage and
              try Practice mode without an account; only persistent features (saving progress,
              purchases, leaderboards) require sign-in.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">2. Information We Collect</h2>
            <p>We collect the following categories of data:</p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>
                <strong>Account data:</strong> email address, display name (callsign), hashed
                password
              </li>
              <li>
                <strong>Sign-in via Google:</strong> if you choose Google Sign-In, we receive
                your email address, name, and profile picture from Google. We do not access
                your Google contacts, calendar, or any other Google data.
              </li>
              <li>
                <strong>Gameplay data:</strong> ship loadouts, battle results, trophies, XP,
                credits, quest progress, leaderboard rank
              </li>
              <li>
                <strong>Payment data:</strong> for VIP subscriptions, Stripe handles all
                payment information; we only store your subscription status and customer ID
              </li>
              <li>
                <strong>Technical data:</strong> error logs (URL, error type, stack trace),
                device type, browser, IP address (for rate-limiting and abuse prevention)
              </li>
              <li>
                <strong>Communications:</strong> emails we send (transactional + auth) and
                your unsubscribe preferences
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">3. How We Use Your Data</h2>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>To create and manage your account</li>
              <li>To run the Game (matchmaking, leaderboards, progression, rewards)</li>
              <li>To process VIP subscriptions and other purchases</li>
              <li>To send essential service emails (verification, password reset, receipts)</li>
              <li>To detect cheating, abuse, and security incidents</li>
              <li>To improve gameplay balance and fix bugs</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">4. Legal Basis (GDPR)</h2>
            <p>
              We process your data on the basis of (a) the contract to provide the Game,
              (b) your consent for optional features, (c) our legitimate interest in preventing
              fraud and abuse, and (d) compliance with legal obligations.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">5. Sharing Your Data</h2>
            <p>We share data only with the following service providers:</p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>
                <strong>Lovable Cloud</strong> — hosted database, authentication, and storage
              </li>
              <li>
                <strong>Stripe</strong> — payment processing for VIP subscriptions
              </li>
              <li>
                <strong>Resend</strong> — sending transactional and auth emails via{" "}
                <code>notify.starmyte.com</code>
              </li>
              <li>
                <strong>Google</strong> — only if you use Google Sign-In, for authentication
              </li>
            </ul>
            <p className="mt-2">
              We do not sell your personal data to third parties. We do not use your data for
              advertising.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">6. Data Retention</h2>
            <p>
              We keep your account data for as long as your account is active. Battle history,
              error logs, and analytics may be retained for up to 24 months for service
              improvement and abuse prevention. You can request deletion at any time
              (see Section 8).
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">7. Cookies & Local Storage</h2>
            <p>
              We use essential cookies and browser local storage for authentication sessions,
              audio preferences, and control settings. We do not use advertising or third-party
              tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent or unsubscribe from non-essential emails</li>
              <li>Lodge a complaint with your local data protection authority</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, email{" "}
              <a href="mailto:service@poshtonic.com" className="text-primary hover:underline">
                service@poshtonic.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">9. Children's Privacy</h2>
            <p>
              StarMyte is not directed at children under 13. We do not knowingly collect data
              from children under 13. If you believe a child has provided us data, contact us
              and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">10. Security</h2>
            <p>
              We use industry-standard measures including encryption in transit (HTTPS),
              hashed passwords, Row-Level Security on database tables, and server-side
              validation of all reward and purchase logic. No system is 100% secure; we cannot
              guarantee absolute security but commit to notifying affected users in the event
              of a breach as required by law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">11. International Transfers</h2>
            <p>
              Your data may be processed in countries other than your own (including the EU
              and US) by our service providers. We rely on standard contractual clauses and
              equivalent safeguards for international transfers.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be
              communicated via email or in-game notification.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">13. Contact</h2>
            <p>
              For privacy questions or to exercise your rights, contact{" "}
              <a href="mailto:service@poshtonic.com" className="text-primary hover:underline">
                service@poshtonic.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-10 flex justify-center">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="font-display tracking-wider"
          >
            BACK
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Privacy;

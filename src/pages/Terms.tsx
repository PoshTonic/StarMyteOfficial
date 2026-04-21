import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CSSStarField from "@/components/CSSStarField";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen px-4 py-12">
      <CSSStarField />
      <div className="relative z-10 mx-auto max-w-3xl">
        <h1 className="mb-2 font-display text-3xl font-bold tracking-wider text-primary glow-text">
          TERMS OF SERVICE
        </h1>
        <p className="mb-8 text-sm text-muted-foreground font-body">
          Last updated: April 2026
        </p>

        <div className="space-y-6 text-sm text-foreground/90 font-body leading-relaxed">
          <section>
            <h2 className="mb-2 font-display text-lg text-primary">1. Acceptance of Terms</h2>
            <p>
              By creating an account or playing StarMyte ("the Game", "we", "us"), you agree
              to these Terms of Service. If you do not agree, do not use the Game.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">2. Eligibility</h2>
            <p>
              You must be at least 13 years old (or the minimum digital-consent age in your
              country) to create an account. By registering you confirm that you meet this
              requirement.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">3. Your Account</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials
              and for all activity under your account. Notify us immediately of any unauthorized
              use. We may suspend or terminate accounts that breach these Terms, exploit bugs,
              cheat, harass other players, or attempt to manipulate game systems.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">4. Virtual Items & Purchases</h2>
            <p>
              StarMyte includes optional in-game purchases (Credits, VIP subscriptions, cosmetic
              items). All virtual items are licensed, not sold, and have no real-world monetary
              value. Purchases are processed by Stripe and are generally non-refundable except
              where required by law. VIP subscriptions auto-renew until cancelled via the
              customer portal.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">5. Acceptable Conduct</h2>
            <p>You agree not to:</p>
            <ul className="ml-6 mt-2 list-disc space-y-1">
              <li>Use cheats, bots, automation, or unauthorized third-party software</li>
              <li>Exploit bugs or game vulnerabilities for unfair advantage</li>
              <li>Harass, threaten, or abuse other players</li>
              <li>Impersonate other players or our staff</li>
              <li>Reverse-engineer, decompile, or attempt to extract source code</li>
              <li>Resell, trade, or transfer accounts or virtual items outside the Game</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">6. Intellectual Property</h2>
            <p>
              All game assets, artwork, audio, code, and the StarMyte name and branding are
              owned by us and protected by copyright and trademark laws. You receive a limited,
              non-exclusive, revocable licence to play the Game for personal, non-commercial use.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">7. Service Availability</h2>
            <p>
              The Game is provided "as is" and "as available". We do not guarantee uninterrupted
              service and may modify, suspend, or discontinue features at any time without
              liability.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, StarMyte and its operators shall not be
              liable for any indirect, incidental, special, or consequential damages arising
              from your use of the Game, including loss of progress, virtual items, or data.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">9. Termination</h2>
            <p>
              You may delete your account at any time by contacting us. We may terminate or
              suspend access immediately for breach of these Terms. Virtual items associated
              with terminated accounts are forfeited without refund.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">10. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated
              via email or in-game notification. Continued play after changes take effect
              constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-primary">11. Contact</h2>
            <p>
              Questions about these Terms? Contact us at{" "}
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

export default Terms;

import { createFileRoute } from "@tanstack/react-router";
import { PageHero, Section } from "@/components/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · MetaTwin" },
      { name: "description", content: "How MetaTwin and MetaGlobe Technologies Ltd collect, use and protect your data." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy">
        Last updated 15 October 2026. This policy explains what MetaTwin collects, why, and how you stay in control of it.
      </PageHero>
      <Section className="max-w-3xl space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <div>
          <p>
            MetaTwin (<strong>metatwin.metaglobetechnologies.co.ke</strong>) is operated by MetaGlobe Technologies Ltd (&ldquo;MetaGlobe&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy covers the MetaTwin web application only.
          </p>

          <h2>What we collect</h2>
          <p>When you create an account, we collect:</p>
          <ul>
            <li>Your email address and password (or, if you sign in with Google or GitHub, the email, name and profile photo that provider shares with us).</li>
            <li>Your birth year and a self-declared confirmation that you are 18 or older. We do not collect your full date of birth.</li>
          </ul>
          <p>As you use MetaTwin, you choose to add:</p>
          <ul>
            <li>Profile details: name, headline, institution, programme and year of study.</li>
            <li>Capabilities (skills you self-report or back with evidence), projects, and evidence items (a title, and optionally a link and a note).</li>
            <li>A public handle and visibility setting, if you choose to share a public page.</li>
          </ul>

          <h2>How we use it</h2>
          <p>
            Your data is used to build and display your MetaTwin: your dashboard, your public profile (if you make one public), and — where you have added matching capabilities — a view of how you compare against opportunities listed on the platform. We don't sell your data, and we don't use it for third-party advertising.
          </p>

          <h2>Who can see it</h2>
          <p>
            Your profile is <strong>private by default</strong>. Only you can see your capabilities, projects and evidence unless you explicitly turn on "Make my profile public" from your dashboard. A public profile shows your name, headline, institution, programme, capabilities and projects (including each project's problem, solution, pitch deck, pitch video, write-up and project link) to anyone with your link; evidence links and notes are shown only if you separately opt in to "Also show my evidence links and evidence notes." A public profile never shows your email, birth year, age-confirmation status, or year of study.
          </p>

          <h2>If you give feedback on a student's project</h2>
          <p>
            Anyone can leave feedback on a project shown on a public MetaTwin. To do so we collect your <strong>rating, comment, name, role and (optionally) organisation</strong>, plus your <strong>email address and WhatsApp number</strong>. We email you a one-time link to confirm the feedback is really from you; feedback you don't confirm within 48 hours is deleted.
          </p>
          <ul>
            <li><strong>The student</strong> sees your rating, comment, name, role and organisation. They see your email only if you tick the box allowing it (MetaTwin may charge the student for this). They never see your WhatsApp number.</li>
            <li><strong>The student's school</strong> (verified staff at their institution) sees your rating, comment, name, role and organisation, never your contact details.</li>
            <li><strong>MetaTwin administrators</strong> can see your email and WhatsApp number to prevent spam and abuse.</li>
            <li>Feedback is never shown on the public profile.</li>
          </ul>
          <p>
            Your email and WhatsApp number are <strong>deleted 12 months</strong> after you confirm; the feedback itself is kept. To have your feedback or details removed sooner, email us at the address below.
          </p>
          <p>
            When someone opens a pitch deck on a public MetaTwin we count the view for the student. We don't store your IP address or browser details: only a code that changes every day (so a repeat view isn't double-counted) and your country. Students see totals, never who viewed. View records are deleted after 13 months.
          </p>

          <h2>Who we share it with</h2>
          <p>We use a small number of service providers to run MetaTwin, each only processing what's needed to provide their service:</p>
          <ul>
            <li><strong>Supabase</strong> — our database, authentication and backend host.</li>
            <li><strong>Resend</strong> — sends account emails (welcome, password reset) and feedback confirmation emails.</li>
            <li><strong>Cloudflare</strong> — hosts and serves the website, and runs the spam check (Turnstile) on the feedback form.</li>
            <li><strong>Google / GitHub</strong> — only if you choose to sign in with one of them, subject to their own privacy policies.</li>
          </ul>
          <p>We don't sell or rent your data to anyone else.</p>

          <h2>Security</h2>
          <p>
            Passwords are handled entirely by our authentication provider and are never visible to us in plain text. Access to your data is restricted at the database level so that, by default, only you can read or write your own records.
          </p>

          <h2>Your choices</h2>
          <p>
            You can edit or remove most of your profile data at any time from your dashboard, and turn your public profile on or off whenever you like. To request deletion of your account and associated data, email us at the address below — we don't yet have a self-service "delete my account" button, so for now this is handled manually.
          </p>

          <h2>Age</h2>
          <p>MetaTwin is currently for students aged 18 and over. We don't knowingly collect data from anyone under 18.</p>

          <h2>Changes</h2>
          <p>If we make a material change to this policy, we'll update the date at the top of this page.</p>

          <h2>Contact</h2>
          <p>
            Questions about this policy or your data: <a href="mailto:hello@metaglobetechnologies.co.ke" className="text-electric">hello@metaglobetechnologies.co.ke</a>.
          </p>
        </div>
      </Section>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { PageHero, Section } from "@/components/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · MetaTwin" },
      { name: "description", content: "The terms that apply when you use MetaTwin." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of Service">
        Last updated 11 October 2026. Please read these terms before using MetaTwin.
      </PageHero>
      <Section className="max-w-3xl space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <div>
          <p>
            These terms govern your use of MetaTwin (<strong>metatwin.metaglobetechnologies.co.ke</strong>), a product of MetaGlobe Technologies Ltd (&ldquo;MetaGlobe&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using the site, you agree to these terms.
          </p>

          <h2>Eligibility</h2>
          <p>
            MetaTwin is currently available to students aged 18 and older only. By signing up, you confirm you meet this requirement. We may ask you to reconfirm your age if we have reason to believe it wasn't accurately declared.
          </p>

          <h2>Your account</h2>
          <p>
            You're responsible for the accuracy of the information you provide and for keeping your login credentials secure. One account per person. You can sign in with email and password, or with Google or GitHub — these are alternative ways to access the same kind of account, not separate products.
          </p>

          <h2>Your content</h2>
          <p>
            You own the capabilities, projects, evidence, and other content you add to your MetaTwin. By adding it, you give MetaGlobe permission to store and display it back to you, and — only if and when you choose to make your profile public — to anyone who visits your public page, exactly as described in our <a href="/privacy" className="text-electric">Privacy Policy</a>.
          </p>
          <p>
            Evidence you add is self-reported. We don't independently verify it, and we say so on public pages. Don't submit evidence, projects, or claims about capabilities that are false, plagiarized, or that you don't have the right to share.
          </p>

          <h2>Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Impersonate another person or organisation, or create a profile under a name that isn't your own.</li>
            <li>Submit false, misleading, or fraudulent capability or evidence claims.</li>
            <li>Scrape, bulk-download, or systematically harvest data from public MetaTwin profiles.</li>
            <li>Attempt to bypass the platform's access controls, rate limits, or age-verification step.</li>
            <li>Use the service for anything unlawful or that infringes someone else's rights.</li>
          </ul>

          <h2>Opportunities and matching</h2>
          <p>
            Where MetaTwin shows you how your capabilities compare against a listed opportunity, that's a starting point to help you judge fit — it isn't a guarantee, endorsement, or prediction of outcome, and it isn't generated or reviewed by the organisations behind those opportunities unless stated otherwise.
          </p>

          <h2>Suspension and termination</h2>
          <p>
            We may suspend or terminate an account that violates these terms, including impersonation or fraudulent evidence. You can ask us to delete your account and data at any time — see our <a href="/privacy" className="text-electric">Privacy Policy</a> for how.
          </p>

          <h2>No warranty</h2>
          <p>
            MetaTwin is provided "as is." We're a small, actively developed product and don't guarantee the service will be uninterrupted, error-free, or permanently available. We'll do our best to give notice of anything that affects your data.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            To the extent permitted by law, MetaGlobe isn't liable for indirect or consequential losses arising from your use of MetaTwin, including decisions made by third parties (such as employers or partners) based on information shown on a public MetaTwin profile.
          </p>

          <h2>Changes</h2>
          <p>We may update these terms as the product evolves. Material changes will update the date at the top of this page.</p>

          <h2>Governing law</h2>
          <p>These terms are governed by the laws of Kenya.</p>

          <h2>Contact</h2>
          <p>
            Questions about these terms: <a href="mailto:hello@metaglobetechnologies.co.ke" className="text-electric">hello@metaglobetechnologies.co.ke</a>.
          </p>
        </div>
      </Section>
    </>
  );
}

import { LegalPage, LegalSection } from "@/components/legal-page";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="October 31, 2026"
      otherDocHref="/privacy"
      otherDocLabel="Privacy Policy"
    >
      <LegalSection heading="1. Agreement to these terms">
        <p>
          Welcome to TalentZify (&quot;TalentZify,&quot; &quot;we,&quot; &quot;us,&quot; or
          &quot;our&quot;). These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of the TalentZify website, app, and related services (together, the
          &quot;Service&quot;). By creating an account or using the Service, you agree to be
          bound by these Terms and our Privacy Policy. If you do not agree, please do not use
          the Service.
        </p>
      </LegalSection>

      <LegalSection heading="2. Who can use TalentZify">
        <p>
          TalentZify is built for students roughly 13 to 18 years old in India. If you are
          under 18, you should have your parent or legal guardian&apos;s awareness and
          permission to use the Service, and we&apos;d encourage them to review these Terms and
          our Privacy Policy with you. We may require a parent or guardian&apos;s consent for
          certain features where applicable law requires it, including India&apos;s Digital
          Personal Data Protection Act, 2023.
        </p>
      </LegalSection>

      <LegalSection heading="3. This is an experimental, evolving service">
        <p>
          TalentZify is currently in active development and testing. Features may change,
          break, be removed, or behave unexpectedly without notice. We do not guarantee the
          Service will always be available, free of errors, or that your content, messages,
          scores, or other data will always be preserved. Please keep that in mind, especially
          for anything you would not want to lose.
        </p>
      </LegalSection>

      <LegalSection heading="4. Your account">
        <p>
          You are responsible for keeping your login details secure and for everything that
          happens under your account. Tell us right away if you think someone else has
          accessed your account. You must provide accurate information when creating your
          account and keep it reasonably up to date.
        </p>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>While using TalentZify, you agree not to:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>Harass, bully, threaten, or demean anyone.</li>
          <li>
            Post illegal, hateful, sexually explicit, or otherwise inappropriate content for
            this community.
          </li>
          <li>Impersonate another person or misrepresent who you are.</li>
          <li>Share someone else&apos;s private information without their consent.</li>
          <li>
            Attempt to hack, disrupt, scrape, or reverse-engineer the Service, or circumvent
            any of its safety features.
          </li>
          <li>Use the Service for anything unlawful under Indian law.</li>
        </ul>
        <p>
          We may remove content, warn, suspend, or permanently close accounts that break these
          rules, at our discretion, including through the blocking and reporting tools built
          into the app.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your content">
        <p>
          You keep ownership of whatever you post (profile information, posts, comments,
          replies, achievements, messages, and similar). By posting content, you give
          TalentZify a limited, non-exclusive license to host, store, display, and distribute
          that content as needed to operate and improve the Service. You are responsible for
          making sure you have the right to post what you post, and that it does not violate
          anyone else&apos;s rights or applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="7. Not professional advice">
        <p>
          Nothing on TalentZify, including career guidance content, quiz results, community
          posts, or anything shared by other users, is professional career, legal, financial,
          medical, or mental health advice. Always check with a trusted adult, teacher,
          counselor, or qualified professional before making significant decisions.
        </p>
      </LegalSection>

      <LegalSection heading="8. Third-party services">
        <p>
          TalentZify relies on third-party providers to operate, including Supabase (database,
          authentication, and file storage), Amazon Web Services (text-to-speech via Amazon
          Polly), and Google (sign-in). Your use of features that rely on these providers may
          also be subject to their own terms.
        </p>
      </LegalSection>

      <LegalSection heading="9. Disclaimers and limitation of liability">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available,&quot; without
          warranties of any kind, express or implied, to the maximum extent permitted by law.
          To the maximum extent permitted under applicable law, TalentZify and its team will
          not be liable for any indirect, incidental, special, or consequential damages, or for
          any loss of data, content, or goodwill, arising from your use of the Service.
        </p>
      </LegalSection>

      <LegalSection heading="10. Termination">
        <p>
          You may stop using the Service and delete your account at any time from Account
          Settings. We may suspend or terminate your access if we reasonably believe
          you&apos;ve violated these Terms, applicable law, or put the safety of other users at
          risk.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to these terms">
        <p>
          We may update these Terms as the Service evolves, especially during this testing
          period. We&apos;ll update the &quot;Last updated&quot; date above whenever we do.
          Continuing to use the Service after changes take effect means you accept the updated
          Terms.
        </p>
      </LegalSection>

      <LegalSection heading="12. Governing law">
        <p>
          These Terms are governed by the laws of India. Any disputes will be subject to the
          exclusive jurisdiction of the courts in [City], India.
        </p>
      </LegalSection>

      <LegalSection heading="13. Grievance redressal">
        <p>
          In accordance with the Information Technology Act, 2000 and the Information
          Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the
          details of our Grievance Officer are:
        </p>
        <p>
          Name: [Grievance Officer Name]
          <br />
          Email: [grievance email]
          <br />
          Address: [Registered Address]
        </p>
        <p>We will acknowledge and address complaints within the timelines required by law.</p>
      </LegalSection>

      <LegalSection heading="14. Contact us">
        <p>Questions about these Terms? Reach us at [contact email].</p>
      </LegalSection>
    </LegalPage>
  );
}

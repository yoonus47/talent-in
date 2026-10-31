import { LegalPage, LegalSection } from "@/components/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="October 31, 2026"
      otherDocHref="/terms"
      otherDocLabel="Terms of Service"
    >
      <LegalSection heading="1. Overview">
        <p>
          This Privacy Policy explains what personal data TalentZify collects, how we use it,
          and the choices you have. It applies to everyone who uses the TalentZify website and
          app.
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            Account information: name, username, email, grade, school, and city or state, if
            you choose to share them.
          </li>
          <li>
            Profile content: bio, photo, interests, skills, achievements, and similar
            self-expression fields.
          </li>
          <li>
            Things you create: posts, comments, community threads and replies, messages
            (including voice messages), and quiz answers.
          </li>
          <li>
            Usage information: device and browser type, approximate activity timestamps, and
            pages you visit within the app.
          </li>
          <li>Anything else you choose to share with us, such as support requests.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Children's information">
        <p>
          TalentZify is built for students roughly 13 to 18 years old. Under India&apos;s
          Digital Personal Data Protection Act, 2023, everyone under 18 is treated as a child,
          and processing a child&apos;s personal data generally requires verifiable consent
          from a parent or legal guardian. We do not knowingly use children&apos;s data for
          behavioral tracking or targeted advertising. If you are a parent or guardian and
          believe your child has provided personal data without your consent, please contact
          us using the details below so we can address it.
        </p>
      </LegalSection>

      <LegalSection heading="4. How we use your information">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            To provide and improve the Service, such as showing your feed, connecting you with
            relevant people and content, and syncing messages in real time.
          </li>
          <li>
            To keep the platform safe, such as detecting abuse, enforcing our Terms, and
            responding to reports and blocks.
          </li>
          <li>To communicate with you, such as notifications and account-related emails.</li>
          <li>To understand how the Service is used so we can make it better.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. How we share your information">
        <p>We do not sell your personal data. We share information with:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            Service providers that help us run the Service: Supabase (database, authentication,
            and file storage), Amazon Web Services (text-to-speech for voice features), and
            Google (only if you choose to sign in with Google).
          </li>
          <li>
            Other users: your profile and public posts are visible to other users according to
            your settings, and blocking and privacy controls are available to you at any time.
          </li>
          <li>
            Authorities, when required by law, such as to comply with a valid legal request
            from Indian authorities.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="6. Data storage and security">
        <p>
          Your data is stored with our infrastructure providers, with reasonable technical and
          organizational measures in place to protect it. No system is perfectly secure, and we
          cannot guarantee absolute security, especially during this testing phase.
        </p>
      </LegalSection>

      <LegalSection heading="7. How long we keep your data">
        <p>
          We keep your information for as long as your account is active. If you delete your
          account, available at any time from Account Settings, we delete your associated
          data, except where we are required to retain it for legal reasons.
        </p>
      </LegalSection>

      <LegalSection heading="8. Your rights and choices">
        <p>
          You can access and update most of your information directly in the app (Edit Profile,
          Account Settings). You can block or report other users, and delete your account at
          any time. You can also contact us to ask about, correct, or request deletion of your
          data.
        </p>
      </LegalSection>

      <LegalSection heading="9. Cookies and similar technology">
        <p>
          We use essential cookies and local storage to keep you signed in and remember
          preferences like your theme. We do not currently use third-party advertising or
          tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to this policy">
        <p>
          We may update this Privacy Policy as the Service evolves. We&apos;ll update the
          &quot;Last updated&quot; date above whenever we do.
        </p>
      </LegalSection>

      <LegalSection heading="11. Grievance Officer and contact">
        <p>For privacy questions, concerns, or complaints, contact our Grievance Officer:</p>
        <p>
          Name: [Grievance Officer Name]
          <br />
          Email: [grievance email]
          <br />
          Address: [Registered Address]
        </p>
      </LegalSection>

      <LegalSection heading="12. Governing law">
        <p>This Policy is governed by the laws of India.</p>
      </LegalSection>
    </LegalPage>
  );
}

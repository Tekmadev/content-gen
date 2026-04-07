import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Content Manager',
  description: 'Privacy Policy for Content Manager by Tekmadev Innovation Inc.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 inline-block">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Privacy Policy</h1>
          <p className="text-sm text-[var(--muted)] mt-2">
            Effective date: April 6, 2026 &nbsp;·&nbsp; Last updated: April 6, 2026
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--border)] p-8 sm:p-10 flex flex-col gap-8 text-sm text-[var(--foreground)] leading-relaxed">

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">1. Introduction</h2>
            <p>
              <strong>Tekmadev Innovation Inc.</strong> ("we", "us", "our"), incorporated in Ontario, Canada, operates <strong>Content Manager</strong> at <strong>content.tekmadev.com</strong> (the "Service"). This Privacy Policy explains how we collect, use, disclose, and protect your personal information in accordance with the <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA) and applicable Ontario privacy laws.
            </p>
            <p>
              By using the Service, you consent to the practices described in this Policy.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">2. Information We Collect</h2>

            <h3 className="font-medium text-xs uppercase tracking-wide text-[var(--muted)] mt-1">2.1 Information you provide directly</h3>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li><strong>Account information:</strong> email address, password (hashed), name (if provided via Google OAuth)</li>
              <li><strong>Brand settings:</strong> brand name, colors, font preferences</li>
              <li><strong>API credentials:</strong> your Blotato API key (stored encrypted)</li>
              <li><strong>Content inputs:</strong> URLs, text, PDFs you submit for post generation</li>
              <li><strong>Generated content:</strong> AI-generated posts, images, and carousels created through the Service</li>
              <li><strong>Billing information:</strong> handled entirely by Stripe — we never store raw card numbers</li>
            </ul>

            <h3 className="font-medium text-xs uppercase tracking-wide text-[var(--muted)] mt-1">2.2 Information collected automatically</h3>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li><strong>Usage data:</strong> features used, generation counts, session activity</li>
              <li><strong>Log data:</strong> IP address, browser type, pages visited, timestamps</li>
              <li><strong>Cookies and sessions:</strong> authentication tokens managed by Supabase</li>
            </ul>

            <h3 className="font-medium text-xs uppercase tracking-wide text-[var(--muted)] mt-1">2.3 Information from third parties</h3>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li><strong>Google OAuth:</strong> name, email, profile picture if you sign in with Google</li>
              <li><strong>Stripe:</strong> subscription status, payment method type (e.g., "Visa ending 4242")</li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Create and manage your account and authenticate your identity</li>
              <li>Provide, operate, and improve the Service</li>
              <li>Process your content inputs through AI models (Anthropic Claude, Google Gemini) to generate posts and visuals</li>
              <li>Publish content to social media platforms via Blotato using your API key</li>
              <li>Process billing and manage your subscription via Stripe</li>
              <li>Track usage against your plan limits</li>
              <li>Send transactional emails (account confirmation, billing receipts, service notices)</li>
              <li>Respond to support requests</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p>We do not use your content to train AI models. We do not sell your personal information to third parties.</p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">4. How We Share Your Information</h2>
            <p>We share your information only as described below:</p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-[var(--border)] rounded-lg overflow-hidden">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold border-b border-[var(--border)]">Third Party</th>
                    <th className="text-left px-3 py-2 font-semibold border-b border-[var(--border)]">What is shared</th>
                    <th className="text-left px-3 py-2 font-semibold border-b border-[var(--border)]">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Supabase (USA)', 'Account data, content, usage logs', 'Database and authentication hosting'],
                    ['Anthropic (USA)', 'Content inputs for post generation', 'AI text generation'],
                    ['Google (USA)', 'Content inputs for image generation', 'AI image generation (Gemini)'],
                    ['Blotato', 'Post content, media URLs', 'Social media publishing'],
                    ['Stripe (USA)', 'Email, billing details', 'Payment processing'],
                  ].map(([party, shared, purpose], i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-[var(--surface)]'}>
                      <td className="px-3 py-2 border-b border-[var(--border)] font-medium">{party}</td>
                      <td className="px-3 py-2 border-b border-[var(--border)]">{shared}</td>
                      <td className="px-3 py-2 border-b border-[var(--border)]">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              We may also disclose your information if required by law, court order, or government authority, or to protect the rights and safety of our users or the public.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">5. Data Storage and Security</h2>
            <p>
              Your data is stored on Supabase infrastructure hosted in the United States. We implement industry-standard security measures including:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Encryption of data in transit (TLS/HTTPS)</li>
              <li>Encryption of sensitive fields (API keys) at rest</li>
              <li>Row-level security (RLS) policies ensuring users can only access their own data</li>
              <li>Service-role restricted access for storage operations</li>
            </ul>
            <p>
              No method of transmission or storage is 100% secure. We cannot guarantee absolute security but are committed to using commercially reasonable measures to protect your information.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">6. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide the Service. Specifically:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li><strong>Account data:</strong> retained until you delete your account</li>
              <li><strong>Generated content and posts:</strong> retained until deleted by you or account closure</li>
              <li><strong>Billing records:</strong> retained for 7 years as required by Canadian tax law</li>
              <li><strong>Usage logs:</strong> retained for 90 days</li>
            </ul>
            <p>
              Upon account deletion, your personal data is permanently deleted within 30 days, except where retention is required by law.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">7. Your Rights Under PIPEDA</h2>
            <p>As a Canadian resident, you have the right to:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li><strong>Access:</strong> request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> request correction of inaccurate or incomplete information</li>
              <li><strong>Withdrawal of consent:</strong> withdraw consent to the collection or use of your information (note: this may prevent us from providing the Service)</li>
              <li><strong>Deletion:</strong> request deletion of your account and associated data</li>
              <li><strong>Complaint:</strong> file a complaint with the Office of the Privacy Commissioner of Canada (OPC) if you believe we have violated your privacy rights</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at <a href="mailto:info@tekmadev.com" className="text-[var(--primary)] underline">info@tekmadev.com</a>. We will respond within 30 days.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">8. Cookies</h2>
            <p>
              The Service uses essential cookies for authentication and session management via Supabase. We do not use advertising or tracking cookies. You can disable cookies in your browser settings, but this may prevent you from logging in.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">9. Children's Privacy</h2>
            <p>
              The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that a minor has provided us with personal information, we will delete it promptly.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">10. Cross-Border Data Transfers</h2>
            <p>
              Your information is transferred to and stored in the United States (Supabase, Anthropic, Google, Stripe). These countries may have different privacy laws than Canada. By using the Service, you consent to this transfer. We ensure our service providers maintain adequate data protection standards.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of material changes via email at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the updated Policy.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">12. Contact and Privacy Officer</h2>
            <p>
              For privacy-related questions, requests, or complaints, contact our Privacy Officer:
            </p>
            <div className="bg-[var(--surface)] rounded-xl p-4 flex flex-col gap-1">
              <p className="font-medium">Privacy Officer — Tekmadev Innovation Inc.</p>
              <p>Ontario, Canada</p>
              <p><a href="mailto:info@tekmadev.com" className="text-[var(--primary)] underline">info@tekmadev.com</a></p>
              <p><a href="https://content.tekmadev.com" className="text-[var(--primary)] underline">content.tekmadev.com</a></p>
            </div>
            <p className="text-xs text-[var(--muted)]">
              If you are not satisfied with our response, you may contact the{' '}
              <a href="https://www.priv.gc.ca" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline">
                Office of the Privacy Commissioner of Canada
              </a>.
            </p>
          </section>

        </div>

        <p className="text-xs text-center text-[var(--muted)] mt-6">
          © {new Date().getFullYear()} Tekmadev Innovation Inc. All rights reserved.
        </p>
      </div>
    </div>
  )
}

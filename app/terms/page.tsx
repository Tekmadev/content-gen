import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Content Manager',
  description: 'Terms of Service for Content Manager by Tekmadev Innovation Inc.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 inline-block">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Terms of Service</h1>
          <p className="text-sm text-[var(--muted)] mt-2">
            Effective date: April 6, 2026 &nbsp;·&nbsp; Last updated: April 6, 2026
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--border)] p-8 sm:p-10 flex flex-col gap-8 text-sm text-[var(--foreground)] leading-relaxed">

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">1. Agreement to Terms</h2>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement between you ("User", "you") and <strong>Tekmadev Innovation Inc.</strong>, a corporation incorporated in Ontario, Canada ("Company", "we", "us"), governing your access to and use of <strong>Content Manager</strong> (the "Service"), accessible at <strong>content.tekmadev.com</strong>.
            </p>
            <p>
              By creating an account, clicking "I agree", or otherwise using the Service, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, you must not use the Service.
            </p>
            <p>
              You must be at least 18 years old and have the legal capacity to enter into contracts in your jurisdiction to use the Service.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">2. Description of Service</h2>
            <p>
              Content Manager is an AI-powered social media content generation and publishing platform. The Service enables users to:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Generate social media posts using artificial intelligence (Claude by Anthropic)</li>
              <li>Create AI-generated visual content (via Google Gemini)</li>
              <li>Connect and publish to social media platforms via the Blotato API</li>
              <li>Manage brand settings, content history, and publishing workflows</li>
            </ul>
            <p>
              The Service relies on third-party APIs including Anthropic (Claude), Google (Gemini), Blotato, and Stripe. Availability and functionality of the Service may be affected by the availability of these third-party services.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">3. User Accounts</h2>
            <p>
              You must create an account to use the Service. You agree to:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain the security of your password and account credentials</li>
              <li>Notify us immediately at <a href="mailto:info@tekmadev.com" className="text-[var(--primary)] underline">info@tekmadev.com</a> of any unauthorized access or security breach</li>
              <li>Accept responsibility for all activity that occurs under your account</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms, engage in fraudulent activity, or pose a security risk.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">4. Subscriptions and Billing</h2>
            <p>
              Access to certain features of the Service requires a paid subscription. Subscriptions are billed in advance on a monthly basis in Canadian dollars (CAD) via Stripe. Available plans are:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li><strong>Starter:</strong> $19 CAD/month</li>
              <li><strong>Pro:</strong> $50 CAD/month</li>
              <li><strong>Agency:</strong> $120 CAD/month</li>
            </ul>
            <p>
              All prices are exclusive of applicable taxes. You are responsible for any taxes, duties, or levies imposed by your jurisdiction.
            </p>
            <p>
              Subscriptions automatically renew unless cancelled before the renewal date. You may cancel at any time through the billing portal — cancellation takes effect at the end of the current billing period. We offer a prorated refund of your first subscription payment within 7 days of purchase if you&apos;re unsatisfied; contact info@tekmadev.com to request one. No refunds are issued for subsequent renewals or for one-time credit pack purchases once credits have been added to your account.
            </p>
            <p>
              We reserve the right to modify pricing with at least 30 days' written notice via email. Continued use after a price change constitutes acceptance of the new pricing.
            </p>
            <p>
              Each plan includes a monthly usage limit for post generations, visual generations, and carousel generations. Unused limits do not roll over to the following month. Exceeding plan limits will block further generation until the next billing cycle or an upgrade.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Generate or publish content that is unlawful, defamatory, harassing, hateful, obscene, or fraudulent</li>
              <li>Violate any applicable laws, including Canadian federal and provincial laws</li>
              <li>Infringe upon the intellectual property rights of any third party</li>
              <li>Distribute spam, misinformation, or deceptive content on social media platforms</li>
              <li>Attempt to circumvent, reverse-engineer, or otherwise interfere with the Service</li>
              <li>Use automated scripts or bots to access the Service beyond its intended API usage</li>
              <li>Resell or sublicense access to the Service without our written consent</li>
            </ul>
            <p>
              You are solely responsible for the content you create, edit, and publish using the Service. AI-generated content is provided as a starting point — you must review and take responsibility for any content published under your social media accounts.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">6. AI-Generated Content</h2>
            <p>
              The Service uses large language models (Claude by Anthropic) and image generation models (Google Gemini) to produce content. You acknowledge that:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>AI-generated content may contain inaccuracies, errors, or unintended outputs</li>
              <li>You are responsible for reviewing all AI-generated content before publishing</li>
              <li>We make no warranties regarding the accuracy, completeness, or suitability of AI-generated content</li>
              <li>You own the output of AI generation performed through your account, subject to the terms of the underlying model providers</li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">7. Third-Party Integrations</h2>
            <p>
              The Service integrates with third-party platforms including Blotato, LinkedIn, Instagram, X (Twitter), Facebook, Google, Anthropic, and Stripe. Your use of these platforms is subject to their respective terms of service and privacy policies. We are not responsible for the actions, outages, or policy changes of these third parties.
            </p>
            <p>
              When you provide a Blotato API key or connect social accounts, you authorize the Service to act on your behalf to publish content to those platforms. You are responsible for ensuring your use complies with the terms of each platform.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">8. Intellectual Property</h2>
            <p>
              The Service, including its software, design, branding, and underlying technology, is owned exclusively by Tekmadev Innovation Inc. and protected by Canadian and international intellectual property laws. Nothing in these Terms grants you ownership of or license to our intellectual property beyond the right to use the Service as described herein.
            </p>
            <p>
              You retain ownership of all original content you input into the Service (source URLs, text, brand assets). You grant us a limited, non-exclusive license to process this content solely for the purpose of delivering the Service to you.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">9. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TEKMADEV INNOVATION INC. SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>
              OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO US IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE CLAIM, OR (B) CAD $100.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">11. Termination</h2>
            <p>
              Either party may terminate your account at any time. You may close your account through the settings page or by emailing <a href="mailto:info@tekmadev.com" className="text-[var(--primary)] underline">info@tekmadev.com</a>. We may suspend or terminate your access immediately for violation of these Terms.
            </p>
            <p>
              Upon termination, your right to use the Service ceases immediately. We may retain certain data as required by law or for legitimate business purposes as described in our Privacy Policy.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">12. Governing Law and Dispute Resolution</h2>
            <p>
              These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict of law principles.
            </p>
            <p>
              Any dispute arising from these Terms shall first be attempted to be resolved through good-faith negotiation. If unresolved within 30 days, disputes shall be subject to the exclusive jurisdiction of the courts of Ontario, Canada.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">13. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of material changes via email at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">14. Contact</h2>
            <p>
              For questions about these Terms, contact us at:
            </p>
            <div className="bg-[var(--surface)] rounded-xl p-4 flex flex-col gap-1">
              <p className="font-medium">Tekmadev Innovation Inc.</p>
              <p>Ontario, Canada</p>
              <p><a href="mailto:info@tekmadev.com" className="text-[var(--primary)] underline">info@tekmadev.com</a></p>
              <p><a href="https://content.tekmadev.com" className="text-[var(--primary)] underline">content.tekmadev.com</a></p>
            </div>
          </section>

        </div>

        <p className="text-xs text-center text-[var(--muted)] mt-6">
          © {new Date().getFullYear()} Tekmadev Innovation Inc. All rights reserved.
        </p>
      </div>
    </div>
  )
}

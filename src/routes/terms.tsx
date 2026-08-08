import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions — DiamondHub" },
      { name: "description", content: "Terms and Conditions for using DiamondHub Mobile Legends diamond top up service." },
      { property: "og:title", content: "Terms and Conditions — DiamondHub" },
      { property: "og:description", content: "Rules, payment, refund, and privacy policies for using DiamondHub." },
    ],
  }),
  component: TermsPage,
});

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card-premium rounded-xl p-5 md:p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg btn-gold font-display text-sm">{n}</span>
        <h2 className="font-display text-lg md:text-xl">{title}</h2>
      </div>
      <div className="space-y-2 text-sm md:text-[0.95rem] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function TermsPage() {
  const updated = "July 5, 2026";
  const loggedIn = useSession();
  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">

      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs text-gold">
          <ShieldCheck className="h-3.5 w-3.5" /> Legal
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          Terms and <span className="gold-text">Conditions</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      </div>

      <div className="space-y-4">
        <Section n={1} title="Introduction">
          <p>
            Welcome to DiamondHub. By accessing or using our website and services, you agree to be bound by these
            Terms and Conditions. Please read them carefully before making a purchase. DiamondHub provides
            Mobile Legends: Bang Bang diamond top up services for customers worldwide.
          </p>
        </Section>

        <Section n={2} title="Use of Website">
          <ul className="list-disc pl-5 space-y-1">
            <li>You must be at least 13 years old, or have the consent of a parent or legal guardian, to use this service.</li>
            <li>You agree to use the website only for lawful purposes and not to engage in fraudulent activity.</li>
            <li>You are responsible for the accuracy of the information you provide, including User ID and Server ID.</li>
            <li>DiamondHub reserves the right to suspend accounts that violate these terms.</li>
          </ul>
        </Section>

        <Section n={3} title="Diamond Purchase">
          <ul className="list-disc pl-5 space-y-1">
            <li>Diamond prices are listed in Indonesian Rupiah (IDR) and may change without prior notice.</li>
            <li>Please double-check your Mobile Legends User ID and Server ID before completing the payment.</li>
            <li>Diamonds are usually delivered automatically within a few minutes after payment is confirmed.</li>
            <li>Delivery may be delayed during maintenance periods on the Mobile Legends server.</li>
          </ul>
        </Section>

        <Section n={4} title="Payment Policy">
          <ul className="list-disc pl-5 space-y-1">
            <li>We accept payments via E-Wallet, Virtual Account, Bank Transfer, and QRIS (as listed on the checkout page).</li>
            <li>Payment must be completed within the invoice countdown time; otherwise, the order will be marked as failed automatically.</li>
            <li>All prices already include the applicable payment method fee, which is shown transparently on the checkout page.</li>
            <li>DiamondHub does not store your payment credentials. Payments are processed by our payment partners.</li>
          </ul>
        </Section>

        <Section n={5} title="Order Cancellation">
          <ul className="list-disc pl-5 space-y-1">
            <li>Pending orders may be cancelled by the customer before payment is completed.</li>
            <li>Orders that are already paid and delivered cannot be cancelled.</li>
            <li>Orders that expire without payment will be automatically cancelled by the system.</li>
          </ul>
        </Section>

        <Section n={6} title="Refund Policy">
          <ul className="list-disc pl-5 space-y-1">
            <li>Refunds are only available if diamonds fail to be delivered due to a system error on our side.</li>
            <li>No refund will be given for wrong User ID or Server ID inputted by the customer.</li>
            <li>Refund requests must be submitted through our WhatsApp support within 24 hours of the transaction.</li>
            <li>Approved refunds will be returned to the original payment method within 3–7 business days.</li>
          </ul>
        </Section>

        <Section n={7} title="Customer Responsibility">
          <ul className="list-disc pl-5 space-y-1">
            <li>You are solely responsible for entering the correct User ID and Server ID.</li>
            <li>You are responsible for keeping your account credentials secure.</li>
            <li>Any loss caused by incorrect information provided by the customer is not our liability.</li>
          </ul>
        </Section>

        <Section n={8} title="Privacy of Customer Data">
          <ul className="list-disc pl-5 space-y-1">
            <li>We only collect data necessary to process your top up transaction (name, email, WhatsApp, and game account information).</li>
            <li>Your data will not be sold or shared with third parties except for payment processing purposes.</li>
            <li>We use industry-standard security practices to protect your information.</li>
            <li>You may request the deletion of your personal data by contacting our support team.</li>
          </ul>
        </Section>

        <Section n={9} title="Closing">
          <p>
            By using DiamondHub, you acknowledge that you have read, understood, and agreed to these Terms and
            Conditions. DiamondHub reserves the right to update these terms at any time, and continued use of the
            service constitutes acceptance of any changes. For questions, please contact us through our official
            WhatsApp or Instagram channels.
          </p>
        </Section>

        <div className="pt-4 text-center">
          <Link to="/" className="text-sm text-gold underline">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}

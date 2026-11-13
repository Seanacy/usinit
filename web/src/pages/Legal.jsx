const Draft = () => (
  <div className="mb-6 rounded-xl border border-orange bg-orange/10 px-4 py-3 font-bold">Draft — under legal review</div>
)

function Page({ title, children }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Draft />
      <h1 className="h1 mb-2">{title}</h1>
      <p className="muted mb-6 text-sm">Us In It is run by Many Ways Up LLC, Minneapolis, Minnesota. Last updated November 2026.</p>
      <div className="space-y-5 leading-relaxed [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </div>
  )
}

export function Terms() {
  return (
    <Page title="Terms of Service">
      <p>These terms cover everyone who uses Us In It (UsInIt.com): people who scan codes, holders, advertisers, supporters, and anyone who gives money through the site. By using the site you agree to these terms.</p>
      <h2>What Us In It is</h2>
      <p>Us In It is a business that connects local advertisers and supporters with people ("holders") who carry a personal QR code. When someone scans a holder's code from inside an approved Us In It area, they see a message, and the holder earns money for that verified scan. Us In It is not a charity, and nothing you pay through the site is tax-deductible.</p>
      <h2>Scanning</h2>
      <li>You don't need an account to scan.</li>
      <li>We ask for your location after you open a scan link, only to check that the scan happened inside an approved area. Location is not saved with your identity.</li>
      <li>Only one scan per phone per holder per day counts. Fake, forced, or automated scans are not allowed and may be voided.</li>
      <li>Do not use your phone while driving.</li>
      <h2>Tips, gifts, and supporter plans</h2>
      <li>Tips go to the holder you choose, after card processing fees and an Us In It platform fee shown before you pay.</li>
      <li>Community Fund gifts and Founding Supporter plans go into the Us In It Community Fund, which pays holders for scans when no paid messages are running. Each fund-paid scan pays the holder share shown on the site, and the rest keeps Us In It running.</li>
      <li>Weekly supporter plans charge the amount you chose once a week and end on their own after the length you chose. You can cancel anytime using the link in your receipt email.</li>
      <li>Payments are processed by Stripe. Us In It never stores full card or bank numbers.</li>
      <li>Payments are generally non-refundable once a scan has been paid out. Contact us if something went wrong.</li>
      <h2>Holders</h2>
      <p>Holders must create their own account and accept the <a className="underline" href="/holder-agreement">Holder Agreement</a>. Holders are independent people using the platform, not employees of Us In It.</p>
      <h2>Advertisers</h2>
      <p>Advertisers accept the <a className="underline" href="/advertiser-agreement">Advertiser Agreement</a>. Every ad is reviewed before it runs.</p>
      <h2>Content rules</h2>
      <p>No hateful, harassing, sexual, or illegal content, and nothing from these categories: payday loans, gambling, alcohol, cannabis, vape, adult content. We may remove any content or account that breaks these rules.</p>
      <h2>Limits</h2>
      <p>The site is provided as is. To the extent the law allows, Us In It is not liable for indirect damages, and our total liability is limited to the amount you paid us in the last 3 months. Minnesota law governs these terms.</p>
    </Page>
  )
}

export function Privacy() {
  return (
    <Page title="Privacy Policy">
      <h2>What we collect</h2>
      <li><b>Scanners:</b> a random ID stored on your phone (to count one scan per phone per day), the scan's location, and a scrambled version of your network address for fraud checks. Your location is used to verify your scan. It isn't saved with your identity. We don't ask scanners for names or accounts.</li>
      <li><b>Holders:</b> email, first name, optional photo, story, general area, earnings, and payout records.</li>
      <li><b>Advertisers:</b> business name, contact name, email, phone, ads, and spending.</li>
      <li><b>Payers:</b> Stripe handles card details. We receive your email and first name for receipts and plan management, never full card numbers.</li>
      <h2>What's public</h2>
      <p>A holder's first name, photo, story, general area (never an exact or live location), and daily scan count. Holder dollar earnings and payment handles are never shown publicly.</p>
      <h2>Holder location sharing</h2>
      <p>When the shared Many Ways Up location feature is turned on, the general area of a holder's verified scans (blurred to about 500 feet, delayed, and deleted after 90 days) may be shared with TentCity, BridgeWork, and OSAAT to connect holders with work and resources. The person who scanned is never identified in that shared data. Holders can ask us to delete their shared location history.</p>
      <h2>How long we keep it</h2>
      <p>Scan and payment records are kept as long as needed for accounting, fraud prevention, and the law. You can ask us to delete your account.</p>
      <h2>Who we share with</h2>
      <p>Stripe (payments), Supabase (secure database hosting), and Vercel (website hosting). We don't sell personal information.</p>
    </Page>
  )
}

export function HolderAgreement() {
  return (
    <Page title="Holder Agreement">
      <p>This is written in plain words. Please read it before you become a holder.</p>
      <h2>Your account</h2>
      <li>You must make your own account. Nobody else can make one for you.</li>
      <li>Us In It checks every new holder before they can earn. Once approved, you get a 4-digit ID and your own QR code.</li>
      <li>You can quit anytime.</li>
      <h2>How you get paid</h2>
      <li>You earn money for every verified scan of your code. A scan is verified when the person scanning is inside an approved Us In It area and hasn't already scanned you today.</li>
      <li>Right now each verified scan pays you the holder share shown on the site (currently $0.40). Scans can be paid by local advertisers or by the Community Fund.</li>
      <li>Tips go to you after card fees and the Us In It fee.</li>
      <li>There may be a daily limit on scan earnings. Tips don't count toward it.</li>
      <li>Your earnings show in your account. For now, Us In It or a partner organization pays you out by hand (for example Cash App or cash). Instant cash-out to a debit card is coming. Any fees will always be shown before you confirm.</li>
      <li>You are not an employee of Us In It. You choose when and where you hold your code.</li>
      <h2>Standing and walking rules</h2>
      <li>You can stand or walk wherever it's legal. Stay on sidewalks.</li>
      <li>Never step into the street or walk up to cars.</li>
      <li>Never follow, block, or pressure anyone. Never ask anyone to scan more than once.</li>
      <li>Fake or forced scans are not allowed and can get your account turned off.</li>
      <h2>Your information</h2>
      <li>Your first name, photo, story, and general area can be public. Your earnings and payment details are private.</li>
      <li>When people scan your code, the general area of the scan is logged to you. When the shared Many Ways Up feature is on, it is shared with TentCity, BridgeWork, and OSAAT to connect you with work and resources. The person who scanned stays anonymous. You can ask us to delete your past shared locations.</li>
      <li>Partner nonprofits that fund your pay can see your holder ID, first name, and the amounts they paid you. Nothing else.</li>
    </Page>
  )
}

export function AdvertiserAgreement() {
  return (
    <Page title="Advertiser Agreement">
      <li>You pay a flat price per verified scan (currently $0.50). Your ad shows when the person scanning is inside one of the zones you drew for that ad.</li>
      <li>You draw your own zones. They are ready right away. The smallest zone is 75 feet from the center to the edge (150 feet across). Us In It may turn off any zone, for example one around a school.</li>
      <li><b>GPS buffer:</b> phone locations aren't exact. Scans within 50 feet of your zone's edge count toward your zone. Why 50 feet: in a city, phone GPS is often off by 30 to 50 feet because buildings bounce the signal. A smaller buffer would be smaller than that error, so real scans would be missed or counted in the wrong place. By creating a zone, you agree that scans inside this 50 foot buffer are billable scans for your zone.</li>
      <li>You see live scan counts for each of your zones. You never see which holder was scanned or where any holder is.</li>
      <li>You prepay your ad balance by card. The card processing fee is added on top at checkout, so the full amount you choose goes into your balance.</li>
      <li>Ads pause automatically when your balance or daily maximum runs out.</li>
      <li>Every ad is reviewed before it runs. We may reject or remove any ad.</li>
      <li>Not allowed: payday loans, gambling, alcohol, cannabis, vape, adult content, and anything illegal, hateful, or misleading.</li>
      <li>Event ads stop automatically when the event ends.</li>
      <li>Political ads must include the committee name and address, which we show as the Minnesota disclaimer: "Prepared and paid for by the [committee], [address]." Every political ad is verified before it runs, and every candidate or side pays the same price.</li>
      <li>Unused balance can be refunded on request, minus card processing fees already paid.</li>
      <li>Holders are not responsible for, and do not endorse, the ads shown when their code is scanned.</li>
      <li><b>The Plug for Nonprofits:</b> verified nonprofits (EIN or 501(c)(3) proof, approved by Us In It) can ask other verified nonprofits to carry their outreach message. The host chooses yes or no for every message. Each scan of a host's code costs the sender $0.05 from its prepaid balance: $0.04 to the host and $0.01 to Us In It. One paid scan per phone per code per day. This rate is only for nonprofits carrying each other's messages, never for street holder scans. Pay for messages from your own budget, not from grant money set aside for holders. Hosts cash out once they reach $50, or can give their earnings to the Community Fund. Public health and harm reduction services are allowed with approval; selling drugs is never allowed.</li>
    </Page>
  )
}

export const legalDocuments = {
  privacy: {
    title: "Privacy Policy",
    updated: "September 22, 2026",
    intro:
      "Dorm Mart is a marketplace for UB students, built and run by UB students. This policy explains what we collect, why we collect it, who can see it, and what you can do about it. The short version: we take what we need to run the marketplace and keep it safe, we don't sell your data to anyone, and you can delete your account whenever you want.",
    sections: [
      {
        title: "1. What this covers",
        paragraphs: [
          "This policy covers the Dorm Mart website and app. Using Dorm Mart means you accept this policy and our Terms of Service.",
          "Dorm Mart is student-run and is not an official University at Buffalo service. We use your UB email to confirm you're a student. It does not give us access to anything in university systems.",
        ],
      },
      {
        title: "2. What we collect",
        groups: [
          {
            title: "Account and profile",
            items: [
              "Your first and last name.",
              "Your UB email address (@buffalo.edu).",
              "Your password, stored as a one-way hash. We can't read it or recover it, which is why a reset replaces it instead of retrieving it.",
              "Your graduation month and year.",
              "A profile photo, if you upload one.",
              "A phone number, only if you add one and switch on contact sharing in Settings.",
            ],
          },
          {
            title: "What you create on the platform",
            items: [
              "Listings: photos, titles, descriptions, prices, categories, and pickup details.",
              "Messages you send other users.",
              "Reviews and ratings you write, and the ones you receive.",
              "Wishlist items, and the alerts they trigger.",
              "Scheduled purchases and completed transaction records.",
            ],
          },
          {
            title: "Sign-in and device records",
            items: [
              "Device type, browser, and operating system.",
              "IP address, and the approximate city it maps to.",
              "Sign-in times and active sessions, so you can see your own logged-in devices in Settings and sign out the ones you don't recognize.",
            ],
          },
          {
            title: "Usage and diagnostics",
            items: [
              "Which features you use and when.",
              "Server request logs and error reports, used to find bugs and keep the site up.",
            ],
          },
          {
            title: "Support and reports",
            items: [
              "Messages you send the team.",
              "Reports you file about another user, and reports filed about you.",
            ],
          },
        ],
        after: [
          "We don't collect your grades, class schedule, or anything else from university systems. We don't track your location in the background, read your contacts, or follow you around other websites.",
          "We never see or store full card numbers. If optional card payments are switched on, Stripe handles the payment form directly, and may ask sellers for identity, tax, or bank details in order to pay them out. That information goes to Stripe under Stripe's own privacy policy, not to us.",
        ],
      },
      {
        title: "3. Why we collect it",
        items: [
          "To create your account and confirm you're a current UB student.",
          "To run the marketplace: listings, search, chat, wishlist alerts, scheduled purchases, and reviews.",
          "To notify you about your own activity, like a new message, an accepted schedule, or a wishlisted item that came back in stock.",
          "To keep the place safe: rate limiting, fraud detection, investigating reports, and enforcing bans.",
          "To fix what's broken, using error logs and performance data.",
          "To respond when the law requires it, and to enforce our Terms.",
        ],
        groups: [
          {
            title: "Email you'll get from us",
            items: [
              "Account and transaction email you can't turn off: verification, password resets, security alerts, and notices about your own purchases.",
              "Promotional email only if you ask for it. You choose the frequency in Settings, and off is the default.",
            ],
          },
        ],
      },
      {
        title: "4. The legal basis, if you're asking",
        paragraphs: [
          "If you're covered by the GDPR or a similar law, here's what we rely on:",
        ],
        items: [
          "Performing our contract with you, which is running the Service you signed up for.",
          "Legitimate interests: keeping the platform secure, preventing fraud, and improving how it works.",
          "Your consent, for promotional email and any non-essential cookies.",
          "Legal obligations, when a law or a lawful request requires something of us.",
        ],
      },
      {
        title: "5. What other students can see",
        items: [
          "Your display name and profile photo.",
          "Your graduation year.",
          "Listings you post, including photos and descriptions.",
          "Reviews you've written, and the average rating you've earned.",
        ],
        after: [
          "Your phone number stays hidden unless you add one and turn on contact sharing yourself. Your messages go to the person you sent them to and nobody else.",
          "Moderators can read a reported conversation, but only the reported thread and only while they're looking into a report. They can't browse your messages for fun.",
        ],
      },
      {
        title: "6. Who else we share with",
        paragraphs: [
          "We don't sell your personal information, and we don't share it for advertising. Beyond what other students see, your data leaves Dorm Mart in four situations:",
        ],
        items: [
          "Service providers we need to operate: hosting, the database, email delivery, and error monitoring. They're contractually limited to the job we hired them for.",
          "Stripe, if optional card payments are switched on and you use them, so sellers can be paid and disputes can be handled.",
          "Safety and law enforcement, when there's a valid court order or subpoena, or when someone is in immediate danger. We'll tell you when this happens unless we're legally barred from telling you.",
          "A future owner, if Dorm Mart is ever transferred to one. You'd get notice before that happened.",
        ],
        after: [
          "What never leaves: your private messages beyond their recipient, your browsing patterns, and your transaction history.",
        ],
      },
      {
        title: "7. Cookies and local storage",
        items: [
          "Session and security cookies keep you signed in and block cross-site request forgery. These are required, and the site won't work without them.",
          "Local storage holds small preferences, like whether you're in dark mode.",
          "We don't run third-party advertising or tracking cookies. There are none to opt out of.",
        ],
        after: [
          "Some browsers send a “Do Not Track” signal. There's no agreed standard for honoring it, so we don't act on it specifically, but we also don't do the cross-site tracking it was invented to stop.",
        ],
      },
      {
        title: "8. How long we keep things",
        items: [
          "Account and profile data: as long as your account is open.",
          "Listings, messages, and reviews: while your account is open, plus a limited window afterward so we can finish investigations and meet audit needs.",
          "Sign-in and security logs: typically 12 to 24 months.",
          "Inactive accounts: deleted after two years with no sign-in.",
          "Transaction and payment records: kept as long as accounting, tax, and dispute rules require. Where Stripe was involved, Stripe keeps its own copy under its own schedule.",
          "Backups: they age out on a fixed rotation, so deleted data can sit in a backup for a short time before it's gone for good.",
        ],
      },
      {
        title: "9. How we protect it",
        paragraphs: [
          "On our side: traffic is encrypted in transit, passwords are hashed, database access is limited to the people who need it, and input is validated to block SQL injection and cross-site scripting. Sensitive actions require a CSRF token, and requests are rate limited.",
          "No system is perfectly secure, and we're not going to pretend otherwise. If we find a breach, we'll investigate it, shut it down, and notify you and the authorities as the New York SHIELD Act requires.",
        ],
        groups: [
          {
            title: "What you can do",
            items: [
              "Use a password you don't use anywhere else.",
              "Turn on two-factor authentication in Settings.",
              "Check your signed-in devices in Settings and end any session you don't recognize.",
              "Sign out on shared and lab computers.",
              "Tell us right away if something looks wrong with your account.",
            ],
          },
        ],
      },
      {
        title: "10. What you can control",
        items: [
          "Edit your profile, graduation year, and preferences in Settings.",
          "Turn promotional email on or off, and change how often it arrives.",
          "Show or hide your phone number.",
          "Review your sign-in history and end sessions you don't recognize.",
          "Change your password, and turn two-factor authentication on or off.",
          "Delete your account from Settings. You'll confirm with your password and by typing DELETE MY ACCOUNT. Your listings come down, your uploaded photos are removed, and anyone who wishlisted your items is told the listing is gone.",
        ],
        after: [
          "Deletion removes your personal data. We keep the minimum required for legal, tax, and fraud-prevention reasons, which is typically a stripped-down transaction record with no profile attached to it.",
          "If your local law gives you the right to a copy of your data, to correct it, to restrict how it's used, or to object to it, contact us and we'll handle it. We may ask you to confirm the account is really yours first.",
        ],
      },
      {
        title: "11. Where your data lives",
        paragraphs: [
          "Dorm Mart is hosted in the United States, and that's where your data is stored and processed.",
        ],
        groups: [
          {
            title: "International students",
            items: [
              "Your data is processed under U.S. law, which may protect it differently than the law where you're from.",
              "You get exactly the same privacy rights as every other user. Nothing about your citizenship or visa status changes what we collect or what you can control.",
              "If you have a specific concern about your data crossing borders, contact us and ask.",
            ],
          },
        ],
      },
      {
        title: "12. FERPA and your student records",
        paragraphs: [
          "We're a student-to-student marketplace, not an arm of the university and not a service provider handling education records on UB's behalf. FERPA doesn't apply to what you give us.",
          "Use some discretion anyway. Don't post grades, transcripts, or coursework here, because it isn't protected the way it would be in a university system.",
        ],
      },
      {
        title: "13. Age",
        paragraphs: [
          "Dorm Mart is for adults. You need to be 18 or older to hold an account. If we learn an account belongs to someone under 18, we'll close it.",
        ],
      },
      {
        title: "14. Third parties we don't control",
        paragraphs: [
          "If optional card payments are switched on, Stripe's payment form collects card details directly and Stripe may set its own cookies for security and fraud prevention. Read Stripe's privacy policy before you connect an account or pay through it.",
          "Anything that happens off Dorm Mart is outside this policy and outside our control: a payment app, a text thread, a meetup you arranged somewhere else. Check the privacy terms of whatever you're using before you share anything there.",
        ],
      },
      {
        title: "15. Changes to this policy",
        paragraphs: [
          "This policy will change as the platform does. The date at the top tells you when it last moved. If a change is significant, we'll post a notice in the app rather than hoping you noticed. Continuing to use Dorm Mart after a change means you accept it.",
        ],
      },
      {
        title: "16. Contact us",
        paragraphs: [
          "Questions, requests, or concerns about your data go to the Dorm Mart team. Our contact details are under Settings → About Us.",
          "For anything involving safety or another user's behavior, use the report button in the app. It reaches a moderator faster than email does.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "September 22, 2026",
    intro:
      "Dorm Mart is a marketplace where University at Buffalo students buy, sell, and trade with each other. These are the rules for using it. We've written them in plain English, because terms nobody reads protect nobody. If something here doesn't make sense, ask us before you agree to it.",
    sections: [
      {
        title: "1. Who can use Dorm Mart",
        paragraphs: ["Dorm Mart is for current UB students. To hold an account you need to:"],
        items: [
          "Have a working @buffalo.edu email address.",
          "Be 18 or older.",
          "Give accurate information about yourself.",
          "Keep one account. No duplicates, no accounts in someone else's name.",
        ],
        after: [
          "If you graduate, transfer, or otherwise stop being a UB student, your access ends. We can suspend or close accounts that don't meet these conditions.",
        ],
      },
      {
        title: "2. What Dorm Mart is, and what it isn't",
        paragraphs: [
          "We connect UB students to each other. We host listings, search, chat, scheduling, reviews, and an optional payment step when it's switched on. That's where our role stops.",
          "We are not:",
        ],
        items: [
          "The seller or the buyer in your transaction.",
          "An escrow service holding anyone's money.",
          "A delivery or shipping service.",
          "An inspector who verifies that items are real, working, or as described.",
          "A guarantor that anyone shows up, pays, or hands over what they promised.",
        ],
        after: [
          "Every deal on Dorm Mart is between two students. What you agree to is yours to honor, and what goes wrong is yours to sort out. We'll help with conduct and safety. We're not a party to your deal.",
        ],
      },
      {
        title: "3. What you can list",
        groups: [
          {
            title: "Fair game",
            items: [
              "Textbooks, notes, and course materials you're allowed to resell.",
              "Electronics, accessories, and chargers.",
              "Dorm and apartment furniture.",
              "Clothing, shoes, and personal items.",
              "Kitchen gear and small appliances.",
              "School and office supplies.",
              "Bikes, scooters, and other ways to get across campus.",
              "Sports gear and hobby equipment.",
            ],
          },
          {
            title: "Never allowed",
            items: [
              "Alcohol, tobacco, vapes, controlled substances, or paraphernalia.",
              "Prescription medication.",
              "Weapons, ammunition, or explosives.",
              "Stolen, counterfeit, or knockoff goods.",
              "Food, because nobody can verify how it was stored.",
              "Live animals.",
              "Adult content or materials.",
              "Anything that breaks UB housing rules, such as candles, space heaters, or hot plates.",
              "Coursework sold to be submitted as someone else's work. That's an academic integrity violation and we'll treat it as one.",
              "Accounts, licenses, or subscriptions you can't legally transfer.",
            ],
          },
        ],
        after: [
          "We take down listings that break these rules, and repeat offenders lose their accounts. If you're not sure whether something's allowed, ask a moderator before you post it.",
        ],
      },
      {
        title: "4. Your responsibilities",
        groups: [
          {
            title: "When you're selling",
            items: [
              "Describe the item honestly, including what's wrong with it.",
              "Use your own photos of the actual item, not stock images.",
              "Price it honestly. No fake markdowns from a price you invented.",
              "Answer messages within about 48 hours, or take the listing down.",
              "Show up when you said you would, with what you listed.",
              "Mark the item sold once it's gone, so nobody wastes a trip.",
            ],
          },
          {
            title: "When you're buying",
            items: [
              "Ask your questions before you agree, not after.",
              "Inspect the item in person before money changes hands.",
              "Pay what you agreed, when you agreed.",
              "Show up on time, or cancel early enough that the seller can re-list.",
              "Don't renegotiate the price at the meetup after they've already agreed to meet.",
            ],
          },
        ],
        after: [
          "Assume the other person is a student with class in twenty minutes. Be on time, be clear, and don't waste each other's day.",
        ],
      },
      {
        title: "5. Meeting up safely",
        paragraphs: [
          "Most of Dorm Mart happens in person. These aren't suggestions. They're the conditions that make a student marketplace workable at all.",
        ],
        items: [
          "Meet in a public campus space: a lobby, the library, the Student Union. Not a dorm room, not a parking garage, not an off-campus address.",
          "Meet in daylight when you can. When you can't, pick somewhere well-lit and busy.",
          "Bring a friend for anything expensive.",
          "Tell someone where you're going and when you expect to be back.",
          "Count cash before you walk away, and confirm a digital payment actually landed before you hand anything over.",
          "If it feels wrong, leave. You don't owe anyone a transaction or an explanation.",
        ],
        after: [
          "If you're ever in danger, call 911 or UB Police first. Report the account to us afterward so we can act on it, but make the call first.",
        ],
      },
      {
        title: "6. Messaging",
        items: [
          "Keep first contact on Dorm Mart. It's the only record we can review if something goes wrong later.",
          "No harassment, slurs, threats, or discrimination. Not once, not as a joke.",
          "No spam, no mass messaging, no pitching unrelated businesses.",
          "Don't keep messaging someone who has stopped replying.",
          "Never ask for a password, a bank login, or anything else you don't need to complete the deal.",
        ],
        after: [
          "Chat runs through a profanity filter, and any message can be sent to a moderator with the report button. Reports are reviewed by a person.",
        ],
      },
      {
        title: "7. Reviews and ratings",
        paragraphs: [
          "After a completed transaction you can leave a review. Reviews are most of what keeps this marketplace honest, so:",
        ],
        items: [
          "Review the transaction you actually had, not one you heard about.",
          "No reviews traded for discounts, and no reviews written about yourself from a second account.",
          "Don't put personal details in a review: no full names, phone numbers, addresses, or schedules.",
          "Disagreeing with a review isn't grounds for removing it. We take down reviews that are abusive, fabricated, or unrelated to the transaction.",
        ],
        after: [
          "Your average rating is public. It's the closest thing this platform has to a reputation, and we protect it from manipulation in both directions.",
        ],
      },
      {
        title: "8. Scheduled purchases",
        paragraphs: [
          "A seller can propose a time and place for a handoff, and the buyer accepts it. A scheduled purchase is a commitment between the two of you, not a contract with us.",
        ],
        items: [
          "Accepting a schedule means you intend to be there.",
          "Cancel through the app if plans change, as early as you can manage.",
          "Both sides confirm the handoff in the app afterward. That's what closes the transaction and unlocks reviews.",
          "No-shows and last-minute cancellations can be reported. A pattern of them can cost you your account.",
        ],
      },
      {
        title: "9. Payments and fees",
        paragraphs: [
          "Dorm Mart is free. No listing fees, no commission, no subscription.",
          "Built-in card payments are currently switched off, so every payment happens directly between you and the other student. Cash, or a payment app you both agree on. Your call and your risk. Treat any request to pay before you've seen the item as a red flag.",
        ],
        groups: [
          {
            title: "If built-in payments are switched back on",
            items: [
              "Payments are processed by Stripe and charged directly to the seller's own connected Stripe account. The money never passes through Dorm Mart, and we don't take a cut.",
              "The seller is the merchant of record, and owns the processing fees, refunds, chargebacks, disputes, and taxes that come with that.",
              "There's a fixed window to pay once the scheduled time arrives. Miss it and the purchase drops back to manual confirmation permanently.",
              "It isn't escrow and it isn't buyer protection. You still need to inspect the item.",
              "Stripe may require identity verification, and can restrict, delay, or deny accounts and payouts under its own rules. Those decisions are Stripe's, not ours.",
            ],
          },
        ],
        after: [
          "Taxes on what you sell are yours to handle. If you're selling enough for that to matter, talk to someone who does taxes for a living.",
        ],
      },
      {
        title: "10. Your content",
        items: [
          "Your photos, descriptions, and messages stay yours.",
          "By posting them, you give us permission to display, resize, and cache them so the platform can show them to other students. That permission ends when you delete the content, aside from copies sitting in backups or attached to a moderation record.",
          "Don't post anything you don't have the rights to. No photos lifted from a retailer's site, no copyrighted material.",
          "We can remove content that breaks these terms, and we don't have to warn you first when it's serious.",
        ],
      },
      {
        title: "11. Moderation and enforcement",
        paragraphs: [
          "If something goes wrong with another user, try to settle it with them directly first. Most problems turn out to be a misunderstanding about a meeting time. If that doesn't work, report it.",
          "Reports go to a moderator who reviews the account, the listing, and the reported messages. Enforcement escalates roughly like this:",
        ],
        items: [
          "First problem: a warning, or a short suspension if it was serious enough to warrant one.",
          "Repeat problems: a longer suspension.",
          "Serious problems such as threats, fraud, stolen goods, or harassment: a permanent ban, immediately.",
        ],
        after: [
          "We judge each case on what happened rather than on a rigid tally. Being new isn't a defense, and being popular isn't a shield. If you think we got a decision wrong, reply to the notice and we'll take another look.",
        ],
      },
      {
        title: "12. Don't break the platform",
        items: [
          "No probing for vulnerabilities, no injection attempts, no brute-forcing logins.",
          "No scraping listings or user data in bulk.",
          "No bots, automated posting, or fake accounts.",
          "No fake listings, fake interest, or coordinated pricing to make something look scarcer or pricier than it is.",
          "No using Dorm Mart as a storefront for an outside resale business. This is a student marketplace.",
          "No working around bans, blocks, filters, or the reporting system.",
        ],
        after: [
          "If you find a security bug, tell us instead of using it. Report it privately, don't exploit it, and don't publish it before we've fixed it. We'd rather hear it from you.",
        ],
      },
      {
        title: "13. Leaving, suspension, and termination",
        groups: [
          {
            title: "You can leave anytime",
            items: [
              "Delete your account from Settings. Your listings come down and your personal data is removed.",
              "Completed transaction records may be kept where the law requires it.",
              "Deleting your account doesn't cancel a deal you already agreed to.",
            ],
          },
          {
            title: "We may close an account for",
            items: [
              "Breaking these terms.",
              "Fraud, or activity that looks like fraud.",
              "No longer being a UB student.",
              "Two years of inactivity.",
            ],
          },
        ],
        after: [
          "When we suspend or close an account, we'll tell you why unless there's a legal or safety reason we can't.",
        ],
      },
      {
        title: "14. Disputes between users",
        paragraphs: [
          "A disagreement about an item, a price, or a no-show is between the two of you. We're not a court, and we don't arbitrate transactions. We can't determine who's telling the truth about a phone that stopped working a week later.",
          "What we do handle is conduct. Harassment, fraud, stolen goods, and threats are our business, and we'll act on the accounts involved.",
          "What you can do: report it to us, report it to UB Police if it's criminal, and leave an honest review.",
        ],
      },
      {
        title: "15. Our relationship with UB",
        items: [
          "Dorm Mart is student-built and student-run. It is not an official University at Buffalo service, and UB neither operates nor endorses it.",
          "UB's Student Code of Conduct and housing policies still apply to you, regardless of what happens here.",
          "We cooperate with UB administration and UB Police when there's a safety or legal reason to.",
          "We use the UB name to say who this is for, not to claim a partnership.",
        ],
      },
      {
        title: "16. What we're not liable for",
        paragraphs: [
          "Dorm Mart is provided as is. We build it carefully, but we don't warrant that it's error-free, always available, or that it will meet your expectations.",
          "We're not responsible for:",
        ],
        items: [
          "Anything that happens between users: bad items, no-shows, disputes, injuries, or money lost.",
          "What users post, including listings, messages, and reviews.",
          "Downtime, bugs, or data loss, though we work to prevent all three.",
          "Decisions made by third parties such as Stripe or your email provider.",
        ],
        after: [
          "To the extent the law allows, our total liability to you for anything connected to Dorm Mart is limited to what you've paid us, which on a free platform is nothing. Some jurisdictions don't permit limits like this, and where that's true, the local law wins.",
        ],
      },
      {
        title: "17. Changes to these terms",
        paragraphs: [
          "These terms will change as Dorm Mart does. The date at the top tells you when they last did. For significant changes we'll post a notice in the app instead of quietly swapping the page. Keep using Dorm Mart after a change and you've accepted it.",
        ],
      },
      {
        title: "18. Getting help",
        paragraphs: [
          "Use the in-app report button for anything involving another user's behavior or safety. It goes straight to a moderator.",
          "For account problems, technical issues, or questions about these terms, contact the team. Our details are under Settings → About Us.",
          "If someone is in immediate danger, call 911 or UB Police first, then tell us.",
        ],
      },
    ],
    closing:
      "By creating an account or using Dorm Mart, you're confirming that you've read these terms, you understand them, and you agree to them.",
  },
};

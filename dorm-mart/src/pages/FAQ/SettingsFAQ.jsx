import FAQItemList from "./FAQItemList";

const SETTINGS_FAQ_ITEMS = [
  {
    question: "How do I change my password?",
    answer:
      "Open Settings, then Change Password. Enter your current password, then type your new password twice to confirm it.",
  },
  {
    question: "How do I choose my interests?",
    answer:
      'Open Settings, then User Preferences and choose up to 3 categories. Your choices save automatically and help shape the listings you see in "For You".',
  },
  {
    question: "How do I switch between light and dark mode?",
    answer:
      "Open Settings, then User Preferences and choose Light or Dark. Your choice is saved to your account.",
  },
  {
    question: "How do I edit my profile?",
    answer:
      "Open Settings, then My Profile to update your bio, profile picture, or Instagram link. Your name comes from sign-up and can't be edited there.",
  },
  {
    question: "What if I forget my password?",
    answer:
      'Click "Forgot Password" on the login page, enter your email, and follow the reset link in your inbox.',
  },
  {
    question: "How do promotional emails work?",
    answer:
      "Open Settings, then User Preferences and set promotional emails to Daily or Weekly. You'll get new listings from your interest categories around 5 p.m. Eastern. If nothing new matches, there's no email that day. Set it to Off or use the unsubscribe link in any email to stop them.",
  },
  {
    question: "How do I turn on two-factor authentication?",
    answer:
      "Open Settings, then Two-Factor Authentication. Once it's on, every login asks for a code we email you. Codes expire after 10 minutes.",
  },
  {
    question: "How do I see where I'm logged in?",
    answer:
      "Open Settings, then Logged Devices to see your 50 most recent logins. If one isn't you, change your password. That signs out every other device.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "Open Settings, then Delete Account. Type your email and enter your password to confirm. This removes your profile and listings, and you can't undo it.",
  },
];

function SettingsFAQ() {
  return <FAQItemList items={SETTINGS_FAQ_ITEMS} />;
}

export default SettingsFAQ;

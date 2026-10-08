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
];

function SettingsFAQ() {
  return <FAQItemList items={SETTINGS_FAQ_ITEMS} />;
}

export default SettingsFAQ;

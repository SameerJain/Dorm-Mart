import FAQItemList from "./FAQItemList";

const SETTINGS_FAQ_ITEMS = [
  {
    question: "How do I change my password?",
    answer:
      "Go to Settings \u2192 Change Password. Enter your current password and your new one twice to confirm.",
  },
  {
    question: "How do I set my interested categories?",
    answer:
      'Go to Settings \u2192 User Preferences. Select up to 3 categories and save. These give the "For You" ranking an immediate signal.',
  },
  {
    question: "How do I switch between light and dark mode?",
    answer:
      "Open Settings \u2192 User Preferences and toggle the theme. Your choice is saved to your account.",
  },
  {
    question: "How do I edit my profile?",
    answer:
      "Go to Settings \u2192 User Profile to update your display name, bio, and profile picture.",
  },
  {
    question: "Let's say I forget my password. What do I do?",
    answer:
      'Click "Forgot Password" on the login page. Enter your email and follow the link sent to your inbox.',
  },
];

function SettingsFAQ() {
  return <FAQItemList items={SETTINGS_FAQ_ITEMS} />;
}

export default SettingsFAQ;

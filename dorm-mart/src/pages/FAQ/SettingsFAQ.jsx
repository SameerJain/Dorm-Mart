const SETTINGS_FAQ_ITEMS = [
  {
    question: "How do I change my password?",
    answer:
      "Go to Settings \u2192 Change Password. Enter your current password and your new one twice to confirm.",
  },
  {
    question: "How do I set my interested categories?",
    answer:
      'Go to Settings \u2192 User Preferences. Select up to 3 categories and save. These power the "For You" feed.',
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
  return (
    <div className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
      {SETTINGS_FAQ_ITEMS.map((item, index) => (
        <div
          key={index}
          className="pb-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
        >
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {item.question}
          </h3>
          <p className="mt-0.5">{item.answer}</p>
        </div>
      ))}
    </div>
  );
}

export default SettingsFAQ;

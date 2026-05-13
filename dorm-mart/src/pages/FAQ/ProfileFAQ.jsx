const PROFILE_FAQ_ITEMS = [
  {
    question: "What information is shown on a public profile?",
    answer:
      "Public profiles display a user's display name, avatar, active listings, and their average seller/buyer rating.",
  },
  {
    question: "How do I view another user's profile?",
    answer:
      "Click on a seller's name or avatar on any listing or in the chat to navigate to their public profile.",
  },
  {
    question: "Can I edit my public profile from this page?",
    answer:
      "No. To edit your name, avatar, or bio go to Settings → My Profile.",
  },
  {
    question: "Why don't I see any listings on a profile?",
    answer:
      "The user may not have any active listings, or all their listings may have been sold or removed.",
  },
];

function ProfileFAQ() {
  return (
    <div className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
      {PROFILE_FAQ_ITEMS.map((item, index) => (
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

export default ProfileFAQ;

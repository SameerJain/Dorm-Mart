import FAQItemList from "./FAQItemList";

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
  return <FAQItemList items={PROFILE_FAQ_ITEMS} />;
}

export default ProfileFAQ;
